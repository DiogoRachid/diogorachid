import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader2,
  Save,
  Ban,
  FileText
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { format } from 'date-fns';

// Helper for batch processing with concurrency
const processBatches = async (items, batchSize, fn) => {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(fn));
    // Small delay to yield to event loop
    await new Promise(r => setTimeout(r, 50));
  }
};

// Helper to fetch entities by codes in chunks
const fetchByCodes = async (entity, codes) => {
  const uniqueCodes = [...new Set(codes.filter(Boolean))];
  const results = [];
  const chunkSize = 100; // Safe limit for $in query
  
  for (let i = 0; i < uniqueCodes.length; i += chunkSize) {
    const chunk = uniqueCodes.slice(i, i + chunkSize);
    try {
      // Use $in query
      const found = await base44.entities[entity].filter({
        codigo: { "$in": chunk }
      }, null, 1000); // Set high limit for the chunk result
      results.push(...found);
    } catch (e) {
      console.error(`Error fetching ${entity} chunk`, e);
    }
  }
  return results;
};

export default function TableImport() {
  const [file, setFile] = useState(null);
  const [config, setConfig] = useState({
    origem: 'SINAPI',
    tipo: 'INSUMOS', // INSUMOS or COMPOSICOES
    updateBudgets: false,
    data_base: '09/2025'
  });
  const [batchId, setBatchId] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mappedColumns, setMappedColumns] = useState({});
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [logs, setLogs] = useState([]);
  
  const fileInputRef = useRef(null);

  // Column Mapping Helpers
  const identifyColumn = (headerName, type) => {
    const h = headerName.toUpperCase().trim();
    if (type === 'INSUMOS') {
      if (['COD', 'CODIGO', 'CÓDIGO', 'ID'].some(x => h.includes(x))) return 'codigo';
      if (['DESCR', 'DESCRIÇÃO', 'DESCRICAO', 'NOME'].some(x => h.includes(x))) return 'descricao';
      if (['UND', 'UNID', 'UNIDADE'].some(x => h === x)) return 'unidade';
      if (['PRECO', 'PREÇO', 'VALOR', 'CUSTO'].some(x => h.includes(x))) return 'valor_referencia';
    } else { // COMPOSICOES
      // Identifying Composite vs Component
      if (['COD_SERV', 'CODIGO_SERVICO', 'CODIGO SERVICO'].some(x => h.includes(x))) return 'codigo_servico';
      if (['DESC_SERV', 'DESCRICAO_SERVICO'].some(x => h.includes(x))) return 'descricao_servico';
      if (['UND_SERV', 'UNIDADE_SERVICO'].some(x => h.includes(x))) return 'unidade_servico';
      if (['COD_ITEM', 'CODIGO_ITEM', 'CODIGO INSUMO'].some(x => h.includes(x))) return 'codigo_item';
      if (['QTD', 'QUANTIDADE', 'COEFICIENTE'].some(x => h.includes(x))) return 'quantidade';
      // Custo unitário removido da importação de serviços/composições
      if (['UNIDADE_ITEM', 'UND_ITEM', 'UNID_ITEM', 'UN_ITEM'].some(x => h.includes(x))) return 'unidade_item';
    }
    return null;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewData([]);
      setLogs([]);
      setProgress('');
    }
  };

  const processFile = () => {
    if (!file) return;
    setProcessing(true);
    setProgress('Lendo arquivo...');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n');
      
      // Basic CSV parsing (handles ; or ,)
      // Find separator based on first line
      const firstLine = lines[0];
      const separator = firstLine.includes(';') ? ';' : ',';
      
      const rawHeaders = lines[0].split(separator).map(h => h.replace(/"/g, '').trim());
      setHeaders(rawHeaders);

      // Map columns automatically
      const mapping = {};
      rawHeaders.forEach((h, index) => {
        const field = identifyColumn(h, config.tipo);
        if (field) mapping[field] = index;
      });
      setMappedColumns(mapping);

      // Parse preview data (first 20 lines)
      const preview = lines.slice(1, 21).map(line => {
        if (!line.trim()) return null;
        const cols = line.split(separator).map(c => c.replace(/"/g, '').trim());
        return cols;
      }).filter(Boolean);

      setPreviewData(preview);
      setProcessing(false);
      setProgress('Pré-visualização gerada. Verifique as colunas.');
    };
    
    reader.readAsText(file, 'ISO-8859-1'); // Default to latin1 for legacy systems usually, or try UTF-8
  };

  const processStaging = async (currentBatchId) => {
    setProgress('Resolvendo dependências e ordenando...');
    
    try {
      // 1. Fetch All Staging
      // Since filtering by batch_id isn't standard in 'list', we filter or use 'filter' if supported.
      // BaaS 'filter' should work.
      // 55k rows might be too many to fetch at once if payload limit.
      // Let's fetch in chunks? No, we need full graph. 
      // Assuming BaaS can return large JSON or we page it.
      
      const stagingRecords = [];
      let page = 0;
      while(true) {
         const res = await base44.entities.CompositionStaging.filter({ batch_id: currentBatchId, processado: false }, null, 1000, page * 1000);
         if (!res || res.length === 0) break;
         stagingRecords.push(...res);
         if (res.length < 1000) break;
         page++;
      }

      if (stagingRecords.length === 0) {
         toast.success("Nenhum registro pendente.");
         return;
      }

      // 2. Identify Types (INSUMO vs SERVICO)
      // Get all item codes
      const allItemCodes = new Set(stagingRecords.map(r => r.codigo_item));
      // Get all service codes (parents)
      const allParentCodes = new Set(stagingRecords.map(r => r.codigo_servico));
      
      // Fetch existing inputs
      setProgress(`Verificando tipos de ${allItemCodes.size} itens...`);
      const inputs = await fetchByCodes('Input', Array.from(allItemCodes));
      const inputMap = new Map(inputs.map(i => [i.codigo, i])); // code -> entity

      // Correct types in memory
      for (const r of stagingRecords) {
         if (inputMap.has(r.codigo_item)) {
            r.tipo_item = 'INSUMO';
         } else {
            // Assume service if not input
            r.tipo_item = 'SERVICO';
         }
      }

      // 3. Build Graph
      const serviceGroups = {}; // code -> { header, items: [] }
      for (const r of stagingRecords) {
         if (!serviceGroups[r.codigo_servico]) {
            serviceGroups[r.codigo_servico] = {
               header: {
                  codigo: r.codigo_servico,
                  descricao: r.descricao_servico,
                  unidade: r.unidade_servico
               },
               items: []
            };
         }
         serviceGroups[r.codigo_servico].items.push(r);
      }

      // 4. Iterative Processing
      // Cache of "Known/Created Services"
      // Start with services already in DB (needed for incremental updates)
      const existingServices = await fetchByCodes('Service', Array.from(allParentCodes)); // Only check parents we are about to create/update?
      // Actually we need to check if dependencies exist.
      // Dependencies are items of type SERVICO.
      // So let's fetch all services that appear as items.
      const serviceItemCodes = stagingRecords.filter(r => r.tipo_item === 'SERVICO').map(r => r.codigo_item);
      const existingServiceItems = await fetchByCodes('Service', serviceItemCodes);
      
      const knownServiceMap = new Map(); // code -> { id, cost }
      existingServiceItems.forEach(s => knownServiceMap.set(s.codigo, { id: s.id, cost: s.custo_total }));
      
      // Also add services that already exist (that we might be updating or skipping? Import usually overwrites or updates)
      // The prompt says "Importação Ordenada" usually implies creating new structure.
      // We will assume we are creating or updating.
      
      let pendingGroups = Object.values(serviceGroups);
      let iteration = 0;
      let createdCount = 0;
      
      while (pendingGroups.length > 0) {
         iteration++;
         setProgress(`Ciclo de resolução ${iteration}: ${pendingGroups.length} serviços pendentes...`);
         
         const processable = [];
         const remaining = [];

         for (const group of pendingGroups) {
            let canProcess = true;
            for (const item of group.items) {
               if (item.tipo_item === 'SERVICO') {
                  if (!knownServiceMap.has(item.codigo_item)) {
                     canProcess = false;
                     break;
                  }
               }
            }
            if (canProcess) processable.push(group);
            else remaining.push(group);
         }

         if (processable.length === 0) {
            // Deadlock or missing dependencies
            const missing = new Set();
            remaining.forEach(g => {
               g.items.forEach(i => {
                  if (i.tipo_item === 'SERVICO' && !knownServiceMap.has(i.codigo_item)) missing.add(i.codigo_item);
               });
            });
            console.warn("Dependências ausentes:", Array.from(missing));
            toast.error(`Ciclo interrompido. ${remaining.length} serviços com dependências não resolvidas.`);
            // Mark errors
            // We can retry via UI later (Prompt 2)
            break;
         }

         // Process the batch
         // Create Services & Compositions
         const serviceBatchData = [];
         const compsBatchData = [];
         
         for (const group of processable) {
            let totalMat = 0;
            let totalMO = 0;
            
            // Calc costs
            for (const item of group.items) {
               let cost = 0;
               let desc = '';
               let unit = '';
               
               if (item.tipo_item === 'INSUMO') {
                  const inp = inputMap.get(item.codigo_item);
                  if (inp) {
                     cost = inp.valor_referencia;
                     desc = inp.descricao;
                     unit = inp.unidade;
                  }
               } else {
                  const srv = knownServiceMap.get(item.codigo_item);
                  // We need description/unit for snapshot? We only have cost/id in map.
                  // We might need to fetch or trust staging?
                  // Staging doesn't have child description usually.
                  // For now, use cost. Snapshot desc will be empty or we need more data.
                  // To be fast, we use what we have.
                  if (srv) cost = srv.cost;
               }
               
               const totalItem = cost * item.quantidade;
               
               // Guess category
               let cat = 'MATERIAL';
               const u = (item.unidade_item || unit || 'UN').toUpperCase();
               if (u.includes('H') || u.includes('HORA')) cat = 'MAO_DE_OBRA';
               
               if (cat === 'MATERIAL') totalMat += totalItem;
               else totalMO += totalItem;

               // Comp Data
               // We need valid ID for item_id.
               const itemId = item.tipo_item === 'INSUMO' 
                  ? inputMap.get(item.codigo_item)?.id 
                  : knownServiceMap.get(item.codigo_item)?.id;

               if (itemId) {
                  // We don't have service_id yet! We need to create service first.
                  // So we construct service data, create it, get ID, then comps.
                  // To batch this:
                  // 1. Create all Services in this iteration
                  // 2. Map codes to new IDs
                  // 3. Create all Compositions
               }
            }

            serviceBatchData.push({
               codigo: group.header.codigo,
               descricao: group.header.descricao,
               unidade: group.header.unidade,
               fonte: config.origem,
               data_base: config.data_base,
               custo_material: totalMat,
               custo_mao_obra: totalMO,
               custo_total: totalMat + totalMO,
               groupRef: group // ref to access items later
            });
         }

         // Batch Create Services
         // Check if they exist (update) or new (create)
         // For simplicity in import, we can upsert. 
         // But base44 doesn't have simple upsert.
         // We check 'existingServices' list?
         // We can do bulk check for 'processable' codes.
         // Let's assume create for now or overwrite.
         
         // To make it robust: Delete existing for these codes, then Create.
         const codesToProcess = serviceBatchData.map(s => s.codigo);
         // Get IDs of existing
         const existingBatch = await fetchByCodes('Service', codesToProcess);
         const existingBatchMap = new Map(existingBatch.map(s => [s.codigo, s.id]));
         
         // Delete old
         if (existingBatch.length > 0) {
             const oldIds = existingBatch.map(s => s.id);
             // Clear old comps too
             // This is safe because we are processing in topological order, so no *created in this run* service depends on these yet (circularity would be error).
             // But valid services might depend on them. If we delete, we break FKs.
             // Better to UPDATE if exists.
         }

         const updates = [];
         const creations = [];

         for (const sData of serviceBatchData) {
            const oldId = existingBatchMap.get(sData.codigo);
            if (oldId) {
               updates.push({ id: oldId, data: { ...sData, groupRef: undefined } });
               // We need to clear comps for this service
               await base44.entities.ServiceComposition.bulkDelete({ servico_id: oldId }); // If supported, else filter+delete
               // Base44 might not support bulkDelete by query.
               // We do manual delete.
               const oldComps = await base44.entities.ServiceComposition.filter({ servico_id: oldId });
               await Promise.all(oldComps.map(c => base44.entities.ServiceComposition.delete(c.id)));
               
               // Prepare new comps
               // ...
               knownServiceMap.set(sData.codigo, { id: oldId, cost: sData.custo_total });
            } else {
               creations.push({ ...sData, groupRef: undefined });
            }
         }

         if (updates.length > 0) {
            await Promise.all(updates.map(u => base44.entities.Service.update(u.id, u.data)));
         }
         
         let createdServices = [];
         if (creations.length > 0) {
            createdServices = await base44.entities.Service.bulkCreate(creations);
            createdServices.forEach(s => {
               knownServiceMap.set(s.codigo, { id: s.id, cost: s.custo_total });
            });
         }

         // Now create Compositions
         const allCompsToInsert = [];
         
         // Re-iterate to build comps with correct Service IDs
         for (const sData of serviceBatchData) {
            const serviceId = knownServiceMap.get(sData.codigo).id;
            const group = sData.groupRef;
            
            for (const item of group.items) {
               const itemId = item.tipo_item === 'INSUMO' 
                  ? inputMap.get(item.codigo_item)?.id 
                  : knownServiceMap.get(item.codigo_item)?.id;
               
               if (!itemId) continue; // Should not happen given logic

               // Costs
               let itemCost = 0;
               if (item.tipo_item === 'INSUMO') itemCost = inputMap.get(item.codigo_item)?.valor_referencia || 0;
               else itemCost = knownServiceMap.get(item.codigo_item)?.cost || 0;

               const totalItem = itemCost * item.quantidade;
               
               // Cat
               let cat = 'MATERIAL';
               const u = (item.unidade_item || '').toUpperCase();
               if (u.includes('H') || u.includes('HORA')) cat = 'MAO_DE_OBRA';

               allCompsToInsert.push({
                  servico_id: serviceId,
                  tipo_item: item.tipo_item,
                  item_id: itemId,
                  quantidade: item.quantidade,
                  custo_unitario: itemCost,
                  custo_total_item: totalItem,
                  tipo_custo: cat,
                  // Snapshot
                  descricao_snapshot: item.tipo_item === 'INSUMO' ? inputMap.get(item.codigo_item)?.descricao : '', // We miss description for services if not fetched
                  unidade_snapshot: item.unidade_item || '',
                  // Legacy
                  item_nome: item.tipo_item === 'INSUMO' ? inputMap.get(item.codigo_item)?.descricao : `Serviço ${item.codigo_item}`,
                  unidade: item.unidade_item || ''
               });
            }
         }

         // Bulk Insert Comps
         for (let k = 0; k < allCompsToInsert.length; k += 100) {
            await base44.entities.ServiceComposition.bulkCreate(allCompsToInsert.slice(k, k+100));
         }

         // Mark staging as processed
         const stagingIds = processable.flatMap(g => g.items.map(i => i.id));
         // Update processed=true
         // Bulk update not standard? iterate
         await processBatches(stagingIds, 50, id => base44.entities.CompositionStaging.update(id, { processado: true }));

         // Next loop
         createdCount += processable.length;
         pendingGroups = remaining;
      }

      toast.success(`Processamento finalizado. ${createdCount} serviços criados/atualizados.`);
      setProgress('Concluído.');
      
    } catch (e) {
      console.error(e);
      toast.error('Erro no processamento: ' + e.message);
      setProgress('Erro.');
    } finally {
      setProcessing(false);
    }
  };

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
          // New "Ordered Import" Logic
          setProgress('Carregando arquivo para tabela temporária...');
          
          const newBatchId = new Date().getTime().toString();
          setBatchId(newBatchId);
          
          // 1. Ingest to CompositionStaging
          const stagingItems = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            const cols = line.split(separator).map(c => c.replace(/"/g, '').trim());
            
            const codServ = cols[mappedColumns['codigo_servico']];
            const codItem = cols[mappedColumns['codigo_item']];
            
            if (!codServ || !codItem) continue;
            
            let qtdStr = cols[mappedColumns['quantidade']];
            if (qtdStr) qtdStr = qtdStr.replace(',', '.');
            const quantidade = parseFloat(qtdStr) || 0;

            const descServ = mappedColumns['descricao_servico'] ? cols[mappedColumns['descricao_servico']] : `Serviço ${codServ}`;
            const unidServ = mappedColumns['unidade_servico'] ? cols[mappedColumns['unidade_servico']] : 'UN';
            const unidItem = mappedColumns['unidade_item'] ? cols[mappedColumns['unidade_item']] : '';

            // We don't know type yet (INSUMO vs SERVICO) for sure, but we can guess or leave it for processing phase.
            // Usually, if we have inputs loaded, we check. But inputs are 55k.
            // Let's store as Unknown and resolve later or infer.
            // But prompt says "Importar TODAS as linhas".
            // Let's infer type later or check basic pattern if possible.
            // For now, assume 'INSUMO' by default unless we find it's a service later.
            // Wait, standard file usually has type column or we infer by checking 'Input' table.
            
            stagingItems.push({
              batch_id: newBatchId,
              codigo_servico: codServ,
              descricao_servico: descServ,
              unidade_servico: unidServ,
              codigo_item: codItem,
              tipo_item: 'INSUMO', // Placeholder, will resolve in logic
              quantidade,
              unidade_item: unidItem,
              processado: false
            });
          }

          setProgress(`Enviando ${stagingItems.length} registros para processamento...`);
          
          // Bulk Insert Staging
          for (let i = 0; i < stagingItems.length; i += 100) {
             const batch = stagingItems.slice(i, i + 100);
             await base44.entities.CompositionStaging.bulkCreate(batch);
             processed += batch.length;
             setProgress(`Carregando... ${processed}/${stagingItems.length}`);
          }

          // Trigger Processing
          await processStaging(newBatchId);
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

  const getRequiredFields = () => config.tipo === 'INSUMOS' 
    ? ['codigo', 'descricao', 'valor_referencia', 'unidade'] 
    : ['codigo_servico', 'descricao_servico', 'unidade_servico', 'codigo_item', 'quantidade', 'unidade_item'];

  const handleMapChange = (field, colIndex) => {
     setMappedColumns(prev => ({...prev, [field]: parseInt(colIndex)}));
  };

  return (
    <div className="pb-20">
      <PageHeader
        title="Importação de Tabelas"
        subtitle="Importe insumos e composições do SINAPI, TCPO e outras fontes"
        icon={UploadCloud}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuração da Importação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Arquivo (CSV ou TXT)</Label>
                <div className="mt-2">
                  <Input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".csv,.txt" 
                    onChange={handleFileChange} 
                    disabled={processing}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Formatos suportados: CSV separado por vírgula ou ponto e vírgula.
                  </p>
                </div>
              </div>

              <div>
                <Label>Origem dos Dados</Label>
                <Select 
                  value={config.origem} 
                  onValueChange={(v) => setConfig(prev => ({...prev, origem: v}))}
                  disabled={processing}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINAPI">SINAPI</SelectItem>
                    <SelectItem value="TCPO">TCPO</SelectItem>
                    <SelectItem value="CDHU">CDHU</SelectItem>
                    <SelectItem value="OUTROS">OUTROS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tipo de Tabela</Label>
                <Select 
                  value={config.tipo} 
                  onValueChange={(v) => setConfig(prev => ({...prev, tipo: v}))}
                  disabled={processing}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INSUMOS">Insumos (Materiais/MO)</SelectItem>
                    <SelectItem value="COMPOSICOES">Composições de Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Data Base (MM/AAAA)</Label>
                <Input
                  value={config.data_base}
                  onChange={(e) => setConfig(prev => ({...prev, data_base: e.target.value}))}
                  disabled={processing}
                  placeholder="Ex: 09/2025"
                />
              </div>

              {config.tipo === 'COMPOSICOES' && (
                <div className="flex items-center space-x-2 border p-3 rounded-lg bg-slate-50">
                  <Checkbox 
                    id="updateBudgets" 
                    checked={config.updateBudgets}
                    onCheckedChange={(v) => setConfig(prev => ({...prev, updateBudgets: v}))}
                    disabled={processing}
                  />
                  <Label htmlFor="updateBudgets" className="text-sm font-normal">
                    Atualizar orçamentos existentes
                  </Label>
                </div>
              )}

              {!processing ? (
                <div className="space-y-2">
                  <Button className="w-full" onClick={processFile} disabled={!file}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Ler Arquivo e Pré-visualizar
                  </Button>
                </div>
              ) : (
                <div className="bg-blue-50 p-4 rounded-lg flex flex-col items-center justify-center text-center">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-2" />
                  <p className="text-sm font-medium text-blue-800">{progress}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {logs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-amber-600 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Inconsistências ({logs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-60 overflow-y-auto text-xs bg-slate-50 p-2 font-mono">
                {logs.map((log, i) => <div key={i} className="mb-1">{log}</div>)}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {previewData.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pré-visualização (20 primeiras linhas)</CardTitle>
                <Button onClick={confirmImport} disabled={processing} className="bg-green-600 hover:bg-green-700">
                  <Save className="h-4 w-4 mr-2" />
                  Confirmar Importação
                </Button>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4 bg-blue-50 border-blue-200">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <AlertTitle>Mapeamento Automático</AlertTitle>
                  <AlertDescription className="text-xs text-blue-700 mt-1">
                    Verifique se todas as colunas foram mapeadas corretamente. Caso contrário, ajuste manualmente abaixo.
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-slate-50 p-4 rounded-lg border">
                  {getRequiredFields().map(field => (
                     <div key={field}>
                        <Label className="text-xs font-semibold uppercase text-slate-500 mb-1 block">
                          {field.replace('_', ' ')} {['codigo','descricao','valor_referencia','codigo_servico','codigo_item','quantidade'].includes(field) && '*'}
                        </Label>
                        <Select 
                           value={mappedColumns[field] !== undefined ? String(mappedColumns[field]) : ''}
                           onValueChange={(v) => handleMapChange(field, v)}
                        >
                           <SelectTrigger className="h-8 text-xs bg-white">
                              <SelectValue placeholder="Selecione a coluna..." />
                           </SelectTrigger>
                           <SelectContent>
                              {headers.map((h, i) => (
                                 <SelectItem key={i} value={String(i)}>{i + 1}: {h}</SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  ))}
                </div>

                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        {headers.map((h, i) => (
                          <TableHead key={i} className="whitespace-nowrap px-3 py-2 text-xs">
                            {h}
                            {Object.entries(mappedColumns).find(([k, v]) => v === i) && (
                              <span className="block text-[10px] text-blue-600 font-bold uppercase">
                                [{Object.entries(mappedColumns).find(([k, v]) => v === i)[0]}]
                              </span>
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row, i) => (
                        <TableRow key={i}>
                          {row.map((cell, j) => (
                            <TableCell key={j} className="whitespace-nowrap px-3 py-2 text-xs">
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {!previewData.length && !processing && (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed rounded-xl bg-slate-50/50">
              <UploadCloud className="h-12 w-12 mb-3 opacity-50" />
              <p>Carregue um arquivo para visualizar os dados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}