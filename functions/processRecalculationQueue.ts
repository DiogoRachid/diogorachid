import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função auxiliar para adicionar dependentes à fila - CORRIGIDA
const enqueueDependents = async (base44, serviceId) => {
  // Buscar todos os serviços que usam este serviço
  const dependentItems = await base44.asServiceRole.entities.ServiceItem.filter({
    tipo_item: 'SERVICO',
    item_id: serviceId
  });

  // Obter IDs únicos dos serviços pais
  const parentServiceIds = [...new Set(dependentItems.map(d => d.servico_id))];
  
  if (parentServiceIds.length === 0) {
    console.log(`ℹ️ Nenhum dependente encontrado para serviço ${serviceId}`);
    return;
  }

  console.log(`📋 Encontrados ${parentServiceIds.length} serviços dependentes de ${serviceId}`);
  
  // Buscar os serviços para obter a prioridade
  const parentServices = await base44.asServiceRole.entities.Service.filter({
    id: { $in: parentServiceIds }
  });
  
  // Verificar quais já estão na fila
  const existingQueueItems = await base44.asServiceRole.entities.RecalculationQueue.filter({
    service_id: { $in: parentServiceIds }
  });
  
  const existingServiceIds = new Set(existingQueueItems.map(q => q.service_id));
  
  // Adicionar apenas os que NÃO estão na fila
  for (const parentService of parentServices) {
    if (!existingServiceIds.has(parentService.id)) {
      try {
        await base44.asServiceRole.entities.RecalculationQueue.create({
          service_id: parentService.id,
          priority: parentService.nivel_max_dependencia || 0,
          status: 'pending',
          retry_count: 0
        });
        console.log(`➕ Adicionado à fila: serviço ${parentService.id} (prioridade: ${parentService.nivel_max_dependencia || 0})`);
      } catch (e) {
        console.warn(`⚠️ Erro ao adicionar serviço ${parentService.id} à fila:`, e.message);
      }
    } else {
      console.log(`⏭️ Serviço ${parentService.id} já está na fila, pulando`);
    }
  }
};

// Função de recálculo otimizada
const recalculateService = async (base44, serviceId) => {
  const items = await base44.asServiceRole.entities.ServiceItem.filter({ servico_id: serviceId });
  
  if (items.length === 0) {
    console.log(`ℹ️ Serviço ${serviceId} não tem itens, definindo custos como 0`);
    await base44.asServiceRole.entities.Service.update(serviceId, {
      custo_material: 0,
      custo_mao_obra: 0,
      custo_total: 0,
      nivel_max_dependencia: 0,
      data_base: null
    });
    return { custo_total: 0, custo_material: 0, custo_mao_obra: 0 };
  }
  
  // Buscar todos os IDs únicos necessários
  const insumoIds = [...new Set(items.filter(i => i.tipo_item === 'INSUMO').map(i => i.item_id))];
  const serviceIds = [...new Set(items.filter(i => i.tipo_item === 'SERVICO').map(i => i.item_id))];
  
  console.log(`📦 Serviço ${serviceId}: ${items.length} itens (${insumoIds.length} insumos, ${serviceIds.length} sub-serviços)`);
  
  // Buscar todos os dados necessários em paralelo
  const [allInsumos, allSubServices] = await Promise.all([
    insumoIds.length > 0 
      ? base44.asServiceRole.entities.Input.filter({ id: { $in: insumoIds } })
      : Promise.resolve([]),
    serviceIds.length > 0 
      ? base44.asServiceRole.entities.Service.filter({ id: { $in: serviceIds } })
      : Promise.resolve([])
  ]);
  
  // Criar Maps para lookup rápido
  const insumoMap = new Map(allInsumos.map(i => [i.id, i]));
  const serviceMap = new Map(allSubServices.map(s => [s.id, s]));
  
  let custoMaterial = 0;
  let custoMaoObra = 0;
  let maxNivelDep = 0;
  let dataBaseMaisAntiga = null;
  
  const parseDate = (str) => {
    if (!str) return null;
    const [mes, ano] = str.split('/');
    if (!mes || !ano) return null;
    return new Date(parseInt(ano), parseInt(mes) - 1, 1);
  };
  
  // Preparar atualizações de ServiceItems
  const itemUpdates = [];

  for (const item of items) {
    let unitCost = 0;

    if (item.tipo_item === 'INSUMO') {
      const insumo = insumoMap.get(item.item_id);
      if (!insumo) {
        console.warn(`⚠️ Insumo ${item.item_id} não encontrado`);
      }
      unitCost = insumo ? insumo.valor_unitario : 0;
      
      // Calcular data_base
      if (insumo?.data_base) {
        const dataItem = parseDate(insumo.data_base);
        if (dataItem && (!dataBaseMaisAntiga || dataItem < dataBaseMaisAntiga)) {
          dataBaseMaisAntiga = dataItem;
        }
      }
      
      // Calcular custos baseado na categoria do INSUMO
      if (insumo) {
        const totalItem = item.quantidade * unitCost;
        if (insumo.categoria === 'MAO_OBRA') {
          custoMaoObra += totalItem;
        } else {
          custoMaterial += totalItem;
        }
      }
    } else {
      // Tipo SERVICO
      const subService = serviceMap.get(item.item_id);
      if (!subService) {
        console.warn(`⚠️ Sub-serviço ${item.item_id} não encontrado`);
      }
      unitCost = subService ? subService.custo_total : 0;
      
      if (subService && subService.nivel_max_dependencia >= maxNivelDep) {
        maxNivelDep = subService.nivel_max_dependencia + 1;
      }
      
      // Calcular custos proporcionalmente
      const totalItem = item.quantidade * unitCost;
      if (subService && subService.custo_total > 0) {
        const matRatio = subService.custo_material / subService.custo_total;
        const laborRatio = subService.custo_mao_obra / subService.custo_total;
        custoMaterial += totalItem * matRatio;
        custoMaoObra += totalItem * laborRatio;
      }
    }

    const totalItem = item.quantidade * unitCost;
    
    itemUpdates.push({
      id: item.id,
      data: {
        custo_unitario_snapshot: unitCost,
        custo_total_item: totalItem
      }
    });
  }
  
  // Atualizar todos os ServiceItems em paralelo (lotes de 10)
  const batchSize = 10;
  for (let i = 0; i < itemUpdates.length; i += batchSize) {
    const batch = itemUpdates.slice(i, i + batchSize);
    await Promise.all(
      batch.map(update => 
        base44.asServiceRole.entities.ServiceItem.update(update.id, update.data)
          .catch(e => console.warn(`⚠️ Falha ao atualizar item ${update.id}:`, e.message))
      )
    );
  }

  const custoTotal = custoMaterial + custoMaoObra;

  let dataBaseStr = null;
  if (dataBaseMaisAntiga) {
    const mes = String(dataBaseMaisAntiga.getMonth() + 1).padStart(2, '0');
    const ano = dataBaseMaisAntiga.getFullYear();
    dataBaseStr = `${mes}/${ano}`;
  }

  await base44.asServiceRole.entities.Service.update(serviceId, {
    custo_material: custoMaterial,
    custo_mao_obra: custoMaoObra,
    custo_total: custoTotal,
    nivel_max_dependencia: maxNivelDep,
    data_base: dataBaseStr
  });

  console.log(`💰 Custos calculados: Material=${custoMaterial.toFixed(2)}, Mão de Obra=${custoMaoObra.toFixed(2)}, Total=${custoTotal.toFixed(2)}`);

  return { custo_total: custoTotal, custo_material: custoMaterial, custo_mao_obra: custoMaoObra };
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('🔄 Iniciando processamento da fila...');

    // Buscar itens pendentes da fila ordenados por prioridade (menor = mais prioritário = folhas da árvore)
    const queueItems = await base44.asServiceRole.entities.RecalculationQueue.filter({
      status: 'pending'
    });

    console.log(`📊 Itens pendentes encontrados: ${queueItems.length}`);

    if (queueItems.length === 0) {
      return Response.json({ message: 'Nenhum item na fila', processed: 0, failed: 0 });
    }

    // Ordenar por prioridade (menor primeiro = folhas primeiro)
    queueItems.sort((a, b) => a.priority - b.priority);
    const batch = queueItems.slice(0, 5);

    console.log(`🎯 Processando lote de ${batch.length} itens`);

    let processed = 0;
    let failed = 0;

    for (const item of batch) {
      try {
        console.log(`⚙️ Processando serviço: ${item.service_id} (prioridade: ${item.priority})`);
        
        // Marcar como processando
        await base44.asServiceRole.entities.RecalculationQueue.update(item.id, {
          status: 'processing'
        });

        // Recalcular o serviço
        const result = await recalculateService(base44, item.service_id);

        // Adicionar serviços dependentes à fila
        await enqueueDependents(base44, item.service_id);

        // Remover da fila (sucesso)
        await base44.asServiceRole.entities.RecalculationQueue.delete(item.id);
        processed++;
        console.log(`✔️ Serviço ${item.service_id} processado com sucesso`);

      } catch (error) {
        console.error(`❌ Erro ao processar serviço ${item.service_id}:`, error.message);
        console.error('Stack:', error.stack);
        
        // Incrementar retry_count
        const newRetryCount = (item.retry_count || 0) + 1;
        
        if (newRetryCount >= 3) {
          // Marcar como falhou após 3 tentativas
          await base44.asServiceRole.entities.RecalculationQueue.update(item.id, {
            status: 'failed',
            retry_count: newRetryCount,
            error_message: error.message
          });
          console.error(`💀 Serviço ${item.service_id} falhou após 3 tentativas`);
        } else {
          // Voltar para pending para tentar novamente
          await base44.asServiceRole.entities.RecalculationQueue.update(item.id, {
            status: 'pending',
            retry_count: newRetryCount,
            error_message: null
          });
          console.log(`🔄 Serviço ${item.service_id} voltou para fila (tentativa ${newRetryCount}/3)`);
        }
        failed++;
      }

      // Aguardar 500ms entre cada recálculo
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`🏁 Processamento finalizado: ${processed} processados, ${failed} falharam`);

    return Response.json({
      success: true,
      processed,
      failed,
      remaining: queueItems.length - batch.length
    });

  } catch (error) {
    console.error('❌ Erro crítico ao processar fila:', error.message);
    console.error('Stack:', error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});