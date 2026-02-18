import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { workId, abcFilter } = await req.json();



    // 1. Buscar projeto
    const projects = await base44.asServiceRole.entities.Project.filter({ id: workId });
    if (!projects || projects.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'Obra não encontrada' 
      }, { status: 404 });
    }
    const project = projects[0];


    // 2. Buscar orçamento da obra
    const budgets = await base44.asServiceRole.entities.Budget.filter({ obra_id: project.id });
    if (!budgets || budgets.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'Nenhum orçamento cadastrado para esta obra' 
      }, { status: 404 });
    }
    const budget = budgets[0];
    const months = budget.duracao_meses || 12;


    // 3. Buscar itens do orçamento (BudgetItems - serviços)
    const budgetItems = await base44.asServiceRole.entities.BudgetItem.filter({ 
      orcamento_id: budget.id 
    });
    if (!budgetItems || budgetItems.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'Orçamento sem serviços. Adicione serviços ao orçamento primeiro.' 
      }, { status: 404 });
    }


    // 4. Buscar distribuições mensais (cronograma salvo)
    const monthlyDist = await base44.asServiceRole.entities.ServiceMonthlyDistribution.filter({ 
      orcamento_id: budget.id 
    });
    if (!monthlyDist || monthlyDist.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'Cronograma não foi salvo. Vá em Planejamento, preencha os percentuais mensais e clique em Salvar.' 
      }, { status: 404 });
    }


    // Criar mapa: budget_item_id -> [{ mes, percentual }]
    const distMap = new Map();
    for (const dist of monthlyDist) {
      if (!dist.budget_item_id) continue;
      if (!distMap.has(dist.budget_item_id)) {
        distMap.set(dist.budget_item_id, []);
      }
      distMap.get(dist.budget_item_id).push({
        mes: dist.mes,
        percentual: dist.percentual || 0
      });
    }


    // 5. Buscar todos os ServiceItems (composição dos serviços)
    const allServiceItems = await base44.asServiceRole.entities.ServiceItem.list();
    const serviceItemsMap = new Map();
    for (const si of allServiceItems) {
      if (!serviceItemsMap.has(si.servico_id)) {
        serviceItemsMap.set(si.servico_id, []);
      }
      serviceItemsMap.get(si.servico_id).push(si);
    }


    // 6. Buscar todos os insumos
    const allInputs = await base44.asServiceRole.entities.Input.list();
    const inputsMap = new Map();
    for (const input of allInputs) {
      inputsMap.set(input.id, input);
    }


    // 7. Processar lista de compras
    const periodosMap = new Map(); // mes -> Map(insumo_id -> dados)
    const totalQtyMap = new Map(); // insumo_id -> quantidade total (para ABC)
    
    let servicosProcessados = 0;
    let servicosSemInsumos = [];
    let servicosSemDistribuicao = [];

    for (const budgetItem of budgetItems) {
      // Verificar se tem distribuição mensal
      const distribuicoes = distMap.get(budgetItem.id);
      if (!distribuicoes || distribuicoes.length === 0) {
        servicosSemDistribuicao.push(budgetItem.codigo || budgetItem.descricao);
        continue;
      }

      // Buscar insumos deste serviço
      const serviceItems = serviceItemsMap.get(budgetItem.servico_id) || [];
      const insumos = serviceItems.filter(si => si.tipo_item === 'INSUMO');
      
      if (insumos.length === 0) {
        servicosSemInsumos.push(budgetItem.codigo || budgetItem.descricao);
        continue;
      }

      servicosProcessados++;

      // Para cada insumo do serviço
      for (const serviceItem of insumos) {
        const insumo = inputsMap.get(serviceItem.item_id);
        if (!insumo) continue;

        const qtdTotalInsumo = budgetItem.quantidade * serviceItem.quantidade;

        // Distribuir por mês
        for (const dist of distribuicoes) {
          const qtdMes = (qtdTotalInsumo * dist.percentual) / 100;
          
          if (qtdMes <= 0) continue;

          // Inicializar mês se não existir
          if (!periodosMap.has(dist.mes)) {
            periodosMap.set(dist.mes, new Map());
          }

          const mesMap = periodosMap.get(dist.mes);
          
          if (!mesMap.has(insumo.id)) {
            mesMap.set(insumo.id, {
              insumo_id: insumo.id,
              codigo: insumo.codigo,
              descricao: insumo.descricao,
              unidade: insumo.unidade,
              valor_unitario: insumo.valor_unitario || 0,
              quantidade: 0
            });
          }

          mesMap.get(insumo.id).quantidade += qtdMes;
          
          // Acumular para ABC
          const totalAtual = totalQtyMap.get(insumo.id) || 0;
          totalQtyMap.set(insumo.id, totalAtual + qtdMes);
        }
      }
    }



    // 8. Calcular classificação ABC
    const abcMap = new Map();
    const qtdArray = Array.from(totalQtyMap.entries())
      .map(([id, qty]) => ({ id, qty }))
      .sort((a, b) => b.qty - a.qty);

    const totalQtd = qtdArray.reduce((sum, item) => sum + item.qty, 0);
    let acumulado = 0;

    for (const item of qtdArray) {
      acumulado += item.qty;
      const percentual = (acumulado / totalQtd) * 100;
      
      if (percentual <= 80) {
        abcMap.set(item.id, 'A');
      } else if (percentual <= 95) {
        abcMap.set(item.id, 'B');
      } else {
        abcMap.set(item.id, 'C');
      }
    }

    // 9. Formatar períodos
    const periodosFormatados = [];
    for (let mes = 1; mes <= months; mes++) {
      const mesMap = periodosMap.get(mes);
      
      let itens = [];
      if (mesMap) {
        itens = Array.from(mesMap.values())
          .map(item => ({
            ...item,
            abc_class: abcMap.get(item.insumo_id) || 'C'
          }))
          .filter(item => !abcFilter || item.abc_class === abcFilter)
          .sort((a, b) => {
            const order = { 'A': 1, 'B': 2, 'C': 3 };
            return order[a.abc_class] - order[b.abc_class];
          });
      }

      const totalValor = itens.reduce((sum, i) => sum + (i.quantidade * i.valor_unitario), 0);

      periodosFormatados.push({
        mes: mes,
        periodo: `Mês ${mes}`,
        itens: itens,
        total_itens: itens.length,
        total_valor: totalValor
      });
    }

    const totalGeralItens = periodosFormatados.reduce((sum, p) => sum + p.total_itens, 0);
    const totalGeralValor = periodosFormatados.reduce((sum, p) => sum + p.total_valor, 0);



    // Verificar se gerou algum item
    if (totalGeralItens === 0) {
      let errorMsg = 'Lista de compras vazia.\n\n';
      
      if (servicosSemInsumos.length > 0) {
        errorMsg += `${servicosSemInsumos.length} serviço(s) sem insumos:\n`;
        errorMsg += servicosSemInsumos.slice(0, 3).join(', ');
        if (servicosSemInsumos.length > 3) {
          errorMsg += ` e mais ${servicosSemInsumos.length - 3}...`;
        }
        errorMsg += '\n\nCadastre insumos em: Cadastros > Serviços';
      } else if (servicosSemDistribuicao.length > 0) {
        errorMsg += 'Todos os serviços estão sem distribuição mensal.\n';
        errorMsg += 'Vá em Planejamento > preencha os percentuais > Salvar.';
      } else {
        errorMsg += 'Verifique o cronograma e os insumos dos serviços.';
      }
      
      return Response.json({ 
        success: false, 
        error: errorMsg
      }, { status: 404 });
    }

    return Response.json({ 
      success: true,
      data: {
        obra_id: project.id,
        obra_nome: project.nome,
        total_meses: months,
        data_geracao: new Date().toISOString().split('T')[0],
        periodos: periodosFormatados,
        total_geral_itens: totalGeralItens,
        total_geral_valor: totalGeralValor
      }
    });

  } catch (error) {
    console.error('[ERROR]', error);
    return Response.json({ 
      success: false, 
      error: `Erro interno: ${error.message}` 
    }, { status: 500 });
  }
});