import { base44 } from '@/api/base44Client';

// Busca todos os registros paginados de uma entidade
const fetchAllRecords = async (entity) => {
  const limit = 1000;
  let all = [], skip = 0;
  while (true) {
    const batch = await entity.list('created_date', limit, skip);
    all = all.concat(batch);
    if (batch.length < limit) break;
    skip += limit;
  }
  return all;
};

// Recursivamente coleta todos os insumos de um serviço
const collectInputsFromService = (serviceId, services, serviceItems, inputs, multiplier = 1, visited = new Set()) => {
  if (visited.has(serviceId)) return [];
  visited.add(serviceId);

  const result = [];
  const items = serviceItems.filter(si => si.servico_id === serviceId);

  for (const item of items) {
    const qty = (item.quantidade || 0) * multiplier;

    if (item.tipo_item === 'INSUMO') {
      const input = inputs.find(inp => inp.id === item.item_id)
        || (item.item_codigo ? inputs.find(inp => inp.codigo === item.item_codigo) : null);
      if (input) {
        result.push({
          id: input.id,
          codigo: input.codigo,
          descricao: input.descricao,
          unidade: input.unidade,
          categoria: item.categoria || input.categoria,
          quantidade: qty,
          custo_unitario: item.custo_unitario_snapshot || input.valor_unitario || 0
        });
      }
    } else if (item.tipo_item === 'SERVICO') {
      const subService = services.find(s => s.id === item.item_id)
        || (item.item_codigo ? services.find(s => s.codigo === item.item_codigo) : null);
      if (subService) {
        const subInputs = collectInputsFromService(subService.id, services, serviceItems, inputs, qty, visited);
        result.push(...subInputs);
      }
    }
  }

  return result;
};

/**
 * Calcula e salva os insumos agregados do orçamento na entidade BudgetInputSummary.
 * Deve ser chamado após salvar o orçamento.
 */
export const recalcBudgetInputSummary = async (budgetId, budgetItems) => {
  // Carregar dados necessários em paralelo
  const [allInputs, serviceItems, allServices] = await Promise.all([
    fetchAllRecords(base44.entities.Input),
    fetchAllRecords(base44.entities.ServiceItem),
    fetchAllRecords(base44.entities.Service)
  ]);

  // Agregar insumos por código
  const inputMap = {};

  for (const budgetItem of budgetItems) {
    const service = allServices.find(s => s.id === budgetItem.servico_id)
      || (budgetItem.codigo ? allServices.find(s => s.codigo === budgetItem.codigo) : null);
    if (!service) continue;

    const inputs = collectInputsFromService(
      service.id,
      allServices,
      serviceItems,
      allInputs,
      budgetItem.quantidade || 0,
      new Set()
    );

    for (const inp of inputs) {
      const key = inp.id || inp.codigo;
      if (!inputMap[key]) {
        inputMap[key] = {
          orcamento_id: budgetId,
          insumo_id: inp.id,
          codigo: inp.codigo,
          descricao: inp.descricao,
          unidade: inp.unidade,
          categoria: inp.categoria,
          quantidade_total: 0,
          custo_unitario: inp.custo_unitario,
          valor_total: 0
        };
      }
      inputMap[key].quantidade_total += inp.quantidade;
      inputMap[key].valor_total += inp.quantidade * inp.custo_unitario;
    }
  }

  // Deletar resumo anterior
  const existing = await base44.entities.BudgetInputSummary.filter({ orcamento_id: budgetId });
  if (existing.length > 0) {
    await Promise.all(existing.map(r => base44.entities.BudgetInputSummary.delete(r.id)));
  }

  // Salvar novo resumo
  const records = Object.values(inputMap);
  if (records.length > 0) {
    await base44.entities.BudgetInputSummary.bulkCreate(records);
  }
};