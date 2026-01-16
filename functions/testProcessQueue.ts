import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const { serviceId } = await req.json();
    
    if (!serviceId) {
      return Response.json({ error: 'serviceId obrigatório' }, { status: 400 });
    }

    console.log(`\n========================================`);
    console.log(`TESTE: Processando serviço ${serviceId}`);
    console.log(`========================================\n`);

    // 1. Verificar se o serviço existe
    const allServices = await base44.asServiceRole.entities.Service.list();
    const service = allServices.find(s => s.id === serviceId);
    
    console.log('1. SERVIÇO ENCONTRADO?', service ? 'SIM' : 'NÃO');
    if (service) {
      console.log('   - Código:', service.codigo);
      console.log('   - Descrição:', service.descricao);
      console.log('   - Custo Atual:', service.custo_total);
    }

    // 2. Buscar itens do serviço
    const allServiceItems = await base44.asServiceRole.entities.ServiceItem.list();
    const serviceItems = allServiceItems.filter(item => item.servico_id === serviceId);
    
    console.log('\n2. ITENS DO SERVIÇO:', serviceItems.length);
    serviceItems.forEach(item => {
      console.log(`   - ${item.tipo_item}: ${item.item_id}, Qtd: ${item.quantidade}`);
    });

    // 3. Buscar dados dos insumos/serviços
    const allInputs = await base44.asServiceRole.entities.Input.list();
    const inputMap = new Map(allInputs.map(i => [i.id, i]));
    const serviceMap = new Map(allServices.map(s => [s.id, s]));

    console.log('\n3. DETALHAMENTO DOS ITENS:');
    let custoMaterial = 0;
    let custoMaoObra = 0;
    let maxNivelDep = 0;

    for (const item of serviceItems) {
      if (item.tipo_item === 'INSUMO') {
        const insumo = inputMap.get(item.item_id);
        if (insumo) {
          const unitCost = insumo.valor_unitario || 0;
          const totalItem = item.quantidade * unitCost;
          console.log(`   INSUMO ${item.item_id}:`);
          console.log(`     - Descrição: ${insumo.descricao}`);
          console.log(`     - Valor Unit: R$ ${unitCost.toFixed(2)}`);
          console.log(`     - Quantidade: ${item.quantidade}`);
          console.log(`     - Total: R$ ${totalItem.toFixed(2)}`);
          console.log(`     - Categoria: ${insumo.categoria}`);
          
          if (insumo.categoria === 'MAO_OBRA') {
            custoMaoObra += totalItem;
          } else {
            custoMaterial += totalItem;
          }
        } else {
          console.log(`   ❌ INSUMO ${item.item_id} NÃO ENCONTRADO!`);
        }
      } else if (item.tipo_item === 'SERVICO') {
        const subService = serviceMap.get(item.item_id);
        if (subService) {
          const unitCost = subService.custo_total || 0;
          const totalItem = item.quantidade * unitCost;
          console.log(`   SERVIÇO ${item.item_id}:`);
          console.log(`     - Descrição: ${subService.descricao}`);
          console.log(`     - Custo Total: R$ ${unitCost.toFixed(2)}`);
          console.log(`     - Quantidade: ${item.quantidade}`);
          console.log(`     - Total: R$ ${totalItem.toFixed(2)}`);
          
          if (subService.custo_total > 0) {
            const matRatio = (subService.custo_material || 0) / subService.custo_total;
            const laborRatio = (subService.custo_mao_obra || 0) / subService.custo_total;
            custoMaterial += totalItem * matRatio;
            custoMaoObra += totalItem * laborRatio;
            console.log(`     - Material: R$ ${(totalItem * matRatio).toFixed(2)}`);
            console.log(`     - Mão de Obra: R$ ${(totalItem * laborRatio).toFixed(2)}`);
          }
          
          const depLevel = subService.nivel_max_dependencia || 0;
          if (depLevel >= maxNivelDep) {
            maxNivelDep = depLevel + 1;
          }
        } else {
          console.log(`   ❌ SERVIÇO ${item.item_id} NÃO ENCONTRADO!`);
        }
      }
    }

    const custoTotal = custoMaterial + custoMaoObra;

    console.log('\n4. TOTAIS CALCULADOS:');
    console.log(`   - Material: R$ ${custoMaterial.toFixed(2)}`);
    console.log(`   - Mão de Obra: R$ ${custoMaoObra.toFixed(2)}`);
    console.log(`   - TOTAL: R$ ${custoTotal.toFixed(2)}`);
    console.log(`   - Nível Dependência: ${maxNivelDep}`);

    // 5. Verificar item na fila
    const allQueueItems = await base44.asServiceRole.entities.RecalculationQueue.list();
    const queueItem = allQueueItems.find(q => q.service_id === serviceId);
    
    console.log('\n5. ITEM NA FILA?', queueItem ? 'SIM' : 'NÃO');
    if (queueItem) {
      console.log('   - ID da Fila:', queueItem.id);
      console.log('   - Status:', queueItem.status);
      console.log('   - Prioridade:', queueItem.priority);
      console.log('   - Tentativas:', queueItem.retry_count || 0);
    }

    // 6. Buscar dependentes
    const dependentItems = allServiceItems.filter(si => 
      si.tipo_item === 'SERVICO' && si.item_id === serviceId
    );
    const parentServiceIds = [...new Set(dependentItems.map(di => di.servico_id))];
    
    console.log('\n6. DEPENDENTES (serviços que usam este):');
    console.log(`   - ${parentServiceIds.length} serviços dependem deste`);
    parentServiceIds.forEach(pid => {
      const parent = allServices.find(s => s.id === pid);
      if (parent) {
        console.log(`     • ${parent.codigo} - ${parent.descricao}`);
      }
    });

    console.log('\n========================================');
    console.log('TESTE CONCLUÍDO');
    console.log('========================================\n');

    return Response.json({
      success: true,
      service: service ? {
        id: service.id,
        codigo: service.codigo,
        descricao: service.descricao,
        custo_atual: service.custo_total
      } : null,
      items_count: serviceItems.length,
      calculated: {
        material: custoMaterial,
        mao_obra: custoMaoObra,
        total: custoTotal,
        nivel_dependencia: maxNivelDep
      },
      in_queue: !!queueItem,
      queue_status: queueItem?.status,
      dependents: parentServiceIds.length
    });

  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
    console.error(error.stack);
    return Response.json({ 
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});