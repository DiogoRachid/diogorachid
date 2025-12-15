const confirmImport = async () => {
    if (!file) return;
    
    // Validation
    const requiredFields = config.tipo === 'INSUMOS' 
      ? ['codigo', 'descricao', 'valor_referencia'] 
      : ['codigo_servico', 'codigo_item', 'quantidade'];
    
    const missing = requiredFields.filter(f => mappedColumns[f] === undefined);

    if (missing.length > 0) {
      toast.error(`Colunas obrigatórias não identificadas: ${missing.join(', ')}. Por favor, mapeie manualmente.`);
      return;
    }

    setProcessing(true);
    setProgress('Lendo arquivo...');
    
    const logEntries = [];
    let processed = 0;
    let inserted = 0;
    let updated = 0;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n');
        const separator = lines[0].includes(';') ? ';' : ',';

        if (config.tipo === 'INSUMOS') {
          setProgress('Processando linhas de insumos...');
          
          // 1. Parse all lines to memory
          const parsedItems = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            const cols = line.split(separator).map(c => c.replace(/"/g, '').trim());
            
            const codigo = cols[mappedColumns['codigo']];
            const descricao = cols[mappedColumns['descricao']];
            
            if (!codigo || !descricao) continue;

            let valorStr = cols[mappedColumns['valor_referencia']];
            if (valorStr) {
               valorStr = valorStr.replace('R$', '').trim();
               if (valorStr.includes(',') && valorStr.includes('.')) {
                  valorStr = valorStr.replace(/\./g, '').replace(',', '.');
               } else if (valorStr.includes(',')) {
                  valorStr = valorStr.replace(',', '.');
               }
            }
            const valor = parseFloat(valorStr) || 0;
            const unidade = mappedColumns['unidade'] !== undefined ? cols[mappedColumns['unidade']] : 'UN';

            parsedItems.push({
               codigo,
               descricao: descricao.slice(0, 500),
               unidade: unidade || 'UN',
               valor_referencia: valor,
               fonte: config.origem,
               data_base: config.data_base,
               data_atualizacao: new Date().toISOString()
            });
          }

          // 2. Fetch existing items
          setProgress(`Verificando existência de ${parsedItems.length} insumos...`);
          const allCodes = parsedItems.map(i => i.codigo);
          const existingItems = await fetchByCodes('Input', allCodes);
          const existingMap = new Map(existingItems.map(i => [i.codigo, i]));

          // 3. Split
          const toCreate = [];
          const toUpdate = [];
          
          for (const item of parsedItems) {
             const existing = existingMap.get(item.codigo);
             if (existing) {
                toUpdate.push({ id: existing.id, data: item });
             } else {
                toCreate.push(item);
             }
             processed++;
          }

          // 4. Execute
          if (toCreate.length > 0) {
            setProgress(`Criando ${toCreate.length} novos insumos...`);
            // Bulk create in chunks of 50
            for (let i = 0; i < toCreate.length; i += 50) {
               await base44.entities.Input.bulkCreate(toCreate.slice(i, i + 50));
               inserted += Math.min(50, toCreate.length - i);
               setProgress(`Criando insumos... ${inserted}/${toCreate.length}`);
            }
          }

          if (toUpdate.length > 0) {
            setProgress(`Atualizando ${toUpdate.length} insumos...`);
            await processBatches(toUpdate, 10, async (item) => {
               await base44.entities.Input.update(item.id, item.data);
               updated++;
            });
          }

        } else if (config.tipo === 'COMPOSICOES') {
          setProgress('Processando arquivo de composições...');
          
          // 1. Group by Service
          const serviceGroups = {};
          const allItemCodes = new Set();
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            const cols = line.split(separator).map(c => c.replace(/"/g, '').trim());
            
            const codServ = cols[mappedColumns['codigo_servico']];
            if (!codServ) continue;
            
            if (!serviceGroups[codServ]) {
              serviceGroups[codServ] = {
                descricao: mappedColumns['descricao_servico'] ? cols[mappedColumns['descricao_servico']] : `Serviço ${codServ}`,
                unidade: mappedColumns['unidade_servico'] ? cols[mappedColumns['unidade_servico']] : 'UN',
                items: []
              };
            }
            
            let qtdStr = cols[mappedColumns['quantidade']];
            if (qtdStr) qtdStr = qtdStr.replace(',', '.');
            const quantidade = parseFloat(qtdStr) || 0;
            
            const codItem = cols[mappedColumns['codigo_item']];
            if (codItem) allItemCodes.add(codItem);

            serviceGroups[codServ].items.push({
              codItem,
              quantidade,
              unidade: mappedColumns['unidade_item'] ? cols[mappedColumns['unidade_item']] : ''
            });
          }

          const serviceCodes = Object.keys(serviceGroups);
          setProgress(`Encontrados ${serviceCodes.length} serviços com composições.`);

          // 2. Fetch Context Data (Services & Inputs)
          setProgress('Carregando dados relacionados...');
          
          const existingServices = await fetchByCodes('Service', serviceCodes);
          const servicesMap = new Map(existingServices.map(s => [s.codigo, s]));
          
          // Fetch inputs referenced in items
          // If 55k items, allItemCodes might be large.
          const existingInputs = await fetchByCodes('Input', Array.from(allItemCodes));
          const inputsMap = new Map(existingInputs.map(i => [i.codigo, i]));
          
          // We also need to check if items are sub-services.
          // We can fetch services by item codes too.
          const potentialSubServices = await fetchByCodes('Service', Array.from(allItemCodes));
          const subServicesMap = new Map(potentialSubServices.map(s => [s.codigo, s]));

          // 3. Create missing Services Headers first
          const missingServices = serviceCodes.filter(c => !servicesMap.has(c));
          if (missingServices.length > 0) {
             setProgress(`Criando ${missingServices.length} serviços ausentes...`);
             const newServicesData = missingServices.map(code => ({
                codigo: code,
                descricao: serviceGroups[code].descricao,
                unidade: serviceGroups[code].unidade,
                fonte: config.origem,
                custo_material: 0, 
                custo_mao_obra: 0,
                custo_total: 0,
                data_base: config.data_base
             }));
             
             // Create in batches and update map
             for (let i = 0; i < newServicesData.length; i += 50) {
                const batch = newServicesData.slice(i, i + 50);
                // bulkCreate returns array of created items? Assuming yes or we fetch them.
                // Base44 bulkCreate returns the created items usually.
                try {
                  const created = await base44.entities.Service.bulkCreate(batch);
                  if (created) {
                     created.forEach(s => servicesMap.set(s.codigo, s));
                  }
                } catch(e) {
                   // Fallback if bulk fails or not supported (it is supported per instructions)
                   console.error('Bulk create failed', e);
                }
                inserted += batch.length;
             }
             // Re-fetch to be sure we have IDs if bulkCreate didn't return them properly
             // (Optimistic approach: assume it worked. If map missing, we fail later)
             const reFetch = await fetchByCodes('Service', missingServices);
             reFetch.forEach(s => servicesMap.set(s.codigo, s));
          }

          // 4. Process Compositions per Service
          let processedCount = 0;
          
          // Chunk services to process
          const serviceCodeChunks = [];
          for (let i = 0; i < serviceCodes.length; i += 20) {
             serviceCodeChunks.push(serviceCodes.slice(i, i + 20));
          }

          for (const chunk of serviceCodeChunks) {
             // Fetch all existing compositions for these services to delete them
             const serviceIds = chunk.map(c => servicesMap.get(c)?.id).filter(Boolean);
             
             if (serviceIds.length > 0) {
                try {
                   // This $in might be heavy if many comps, but usually manageable for 20 services
                   const oldComps = await base44.entities.ServiceComposition.filter({
                      servico_id: { "$in": serviceIds }
                   }, null, 10000); 
                   
                   // Delete old comps in parallel
                   if (oldComps.length > 0) {
                      await processBatches(oldComps, 20, c => base44.entities.ServiceComposition.delete(c.id));
                   }
                } catch (e) { console.error('Error clearing old comps', e); }
             }

             // Build new compositions
             const newCompsToCreate = [];
             const serviceUpdates = [];

             for (const code of chunk) {
                const service = servicesMap.get(code);
                if (!service) continue;
                const group = serviceGroups[code];
                
                let totalMat = 0;
                let totalMO = 0;

                for (const item of group.items) {
                   let itemId;
                   let itemType = 'INSUMO';
                   let itemCost = 0;
                   let itemName = '';

                   let input = inputsMap.get(item.codItem);
                   if (input) {
                      itemId = input.id;
                      itemCost = input.valor_referencia;
                      itemName = input.descricao;
                   } else {
                      let sub = subServicesMap.get(item.codItem);
                      if (sub) {
                         itemId = sub.id;
                         itemType = 'SERVICO';
                         itemCost = sub.custo_total;
                         itemName = sub.descricao;
                      } else {
                         // Missing item -> Create Placeholder Input?
                         // To avoid async creation inside this loop, we should have detected missing items before.
                         // But simple fallback:
                         // We skip or log?
                         // Let's create a placeholder object to CREATE later? 
                         // No, we need ID.
                         // For 55k lines, this edge case is painful.
                         // Let's Log and Skip to keep it fast.
                         logEntries.push(`Item ${item.codItem} não encontrado para o serviço ${code}`);
                         continue;
                      }
                   }

                   // Cost Type
                   let costType = 'MATERIAL';
                   const u = (item.unidade || (input ? input.unidade : 'UN')).toUpperCase();
                   if (u.includes('H') || u.includes('HORA')) costType = 'MAO_DE_OBRA';

                   const totalItem = Math.round((item.quantidade * itemCost) * 100) / 100;

                   newCompsToCreate.push({
                      servico_id: service.id,
                      tipo_item: itemType,
                      item_id: itemId,
                      item_nome: itemName || (itemType === 'SERVICO' ? 'Serviço Auxiliar' : 'Insumo'),
                      unidade: item.unidade || u,
                      quantidade: item.quantidade,
                      custo_unitario: itemCost,
                      custo_total_item: totalItem,
                      tipo_custo: costType
                   });

                   if (costType === 'MATERIAL') totalMat += totalItem;
                   else totalMO += totalItem;
                }

                // Prepare service update
                serviceUpdates.push({
                   id: service.id,
                   data: {
                      custo_material: totalMat,
                      custo_mao_obra: totalMO,
                      custo_total: totalMat + totalMO,
                      data_base: config.data_base
                   }
                });
                
                processed++;
                processedCount++;
             }

             // Execute Bulk Create Comps
             if (newCompsToCreate.length > 0) {
                // Chunk to 100
                for (let k = 0; k < newCompsToCreate.length; k += 100) {
                   await base44.entities.ServiceComposition.bulkCreate(newCompsToCreate.slice(k, k+100));
                }
             }

             // Execute Service Updates
             await processBatches(serviceUpdates, 10, s => base44.entities.Service.update(s.id, s.data));
             
             updated += serviceUpdates.length;
             setProgress(`Processando serviços... ${processedCount}/${serviceCodes.length}`);
          }
        }

        // 5. Finalize
        await base44.entities.ImportLog.create({
          data_importacao: new Date().toISOString(),
          origem: config.origem,
          tipo: config.tipo,
          nome_arquivo: file.name,
          linhas_processadas: processed,
          linhas_inseridas: inserted,
          linhas_atualizadas: updated,
          usuario_responsavel: (await base44.auth.me())?.full_name || 'Usuário',
          log_inconsistencias: logEntries.join('\n').slice(0, 5000)
        });

        setProcessing(false);
        setProgress('Importação concluída com sucesso!');
        toast.success('Importação finalizada!');
        setLogs(logEntries);
        setFile(null);
        setPreviewData([]);
        if (fileInputRef.current) fileInputRef.current.value = '';

      } catch (err) {
        console.error(err);
        toast.error('Erro na importação: ' + err.message);
        setProcessing(false);
      }
    };
    
    reader.onerror = () => { toast.error('Erro ao ler arquivo'); setProcessing(false); };
    reader.readAsText(file, 'ISO-8859-1');
  };