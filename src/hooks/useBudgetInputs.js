import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchAllRecords, collectInputsFromService } from '@/components/logic/BudgetInputsCalculator';

/**
 * Hook que calcula os insumos agregados de um orçamento diretamente,
 * sem depender do BudgetInputSummary pré-calculado.
 *
 * Retorna: { inputs: Array, isLoading, error }
 * Cada item: { id, codigo, descricao, unidade, categoria, quantidade_total, custo_unitario, valor_total }
 */
export function useBudgetInputs(budgetItems = []) {
  const [inputs, setInputs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!budgetItems || budgetItems.length === 0) {
      setInputs([]);
      return;
    }

    let cancelled = false;
    const calculate = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [allInputs, serviceItems, allServices] = await Promise.all([
          fetchAllRecords(base44.entities.Input),
          fetchAllRecords(base44.entities.ServiceItem),
          fetchAllRecords(base44.entities.Service),
        ]);

        const inputMap = {};

        for (const budgetItem of budgetItems) {
          const service =
            allServices.find(s => s.id === budgetItem.servico_id) ||
            (budgetItem.codigo ? allServices.find(s => s.codigo === budgetItem.codigo) : null);
          if (!service) continue;

          const collected = collectInputsFromService(
            service.id,
            allServices,
            serviceItems,
            allInputs,
            budgetItem.quantidade || 0,
            new Set()
          );

          for (const inp of collected) {
            const key = inp.id || inp.codigo;
            if (!inputMap[key]) {
              inputMap[key] = {
                id: inp.id,
                codigo: inp.codigo,
                descricao: inp.descricao,
                unidade: inp.unidade,
                categoria: inp.categoria,
                quantidade_total: 0,
                custo_unitario: inp.custo_unitario,
                valor_total: 0,
              };
            }
            inputMap[key].quantidade_total += inp.quantidade;
            inputMap[key].valor_total += inp.quantidade * inp.custo_unitario;
          }
        }

        if (!cancelled) setInputs(Object.values(inputMap));
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    calculate();
    return () => { cancelled = true; };
  }, [JSON.stringify(budgetItems.map(i => ({ id: i.id, servico_id: i.servico_id, quantidade: i.quantidade })))]);

  return { inputs, isLoading, error };
}