import React, { useMemo, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, Clock, TrendingUp, Loader2 } from 'lucide-react';

const HORAS_TRABALHO_MES = 176; // ~22 dias úteis * 8 horas

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
];


export default function StaffingCalculator({ schedule, stages, items, services, months, budget }) {
  const [expandedMonths, setExpandedMonths] = useState({});
  const [staffingData, setStaffingData] = useState({ monthlyData: [], allFunctions: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const calculateStaffing = async () => {
      setIsLoading(true);
      try {
        if (!budget?.id) {
          setStaffingData({ monthlyData: [], allFunctions: [] });
          setIsLoading(false);
          return;
        }

        // Carregar resumo de insumos pré-calculado (apenas MAO_OBRA)
        const allSummaries = await base44.entities.BudgetInputSummary.filter({ orcamento_id: budget.id });
        const maoObraSummaries = allSummaries.filter(s => s.categoria === 'MAO_OBRA');

        if (maoObraSummaries.length === 0) {
          setStaffingData({ monthlyData: [], allFunctions: [] });
          setIsLoading(false);
          return;
        }

        // Mapear insumo -> quantidade total por budget item
        // Como o resumo é agregado por orçamento, precisamos distribuir proporcionalmente por etapa/mês
        // Mapeamos: para cada budget item, qual % da quantidade total do orçamento ele representa
        const totalQtdByInput = {};
        for (const s of maoObraSummaries) {
          totalQtdByInput[s.insumo_id || s.codigo] = s.quantidade_total;
        }

        // Para cada item do orçamento, calcular o peso proporcional dos insumos MAO_OBRA
        // Usamos o custo_direto_total do item como proxy de proporção
        const totalCustoDireto = items.reduce((sum, i) => sum + (i.custo_direto_total || 0), 0);

        const monthlyData = [];
        const functionsSet = new Set();

        // Palavras a excluir (benefícios/custos indiretos)
        const palavrasExcluidas = ['alimentação', 'alimentacao', 'epi', 'exames', 'ferramentas', 'seguro', 'transporte'];

        for (let monthIdx = 0; monthIdx < months; monthIdx++) {
          const hoursByFunction = {};

          // Calcular percentual total executado neste mês (média ponderada por valor de etapa)
          let totalValorMes = 0;
          let totalValor = 0;

          for (const stage of stages) {
            const stageItems = items.filter(item => item.stage_id === stage.id);
            const percentage = schedule[stage.id]?.percentages[monthIdx] || 0;
            const stageValue = stageItems.reduce((sum, i) => sum + (i.custo_direto_total || 0), 0);
            totalValor += stageValue;
            totalValorMes += stageValue * (percentage / 100);
          }

          const percentualMes = totalValor > 0 ? totalValorMes / totalValor : 0;

          for (const s of maoObraSummaries) {
            const descricao = s.descricao || '';
            const deveExcluir = palavrasExcluidas.some(p => descricao.toLowerCase().includes(p));
            if (deveExcluir) continue;

            const funcao = descricao || 'Não Identificado';
            functionsSet.add(funcao);

            const horasMes = s.quantidade_total * percentualMes;
            hoursByFunction[funcao] = (hoursByFunction[funcao] || 0) + horasMes;
          }

          const workersByFunction = {};
          let totalWorkers = 0;
          let totalHours = 0;

          for (const funcao in hoursByFunction) {
            const workers = Math.ceil(hoursByFunction[funcao] / HORAS_TRABALHO_MES);
            workersByFunction[funcao] = workers;
            totalWorkers += workers;
            totalHours += hoursByFunction[funcao];
          }

          monthlyData.push({
            month: monthIdx + 1,
            monthName: `Mês ${monthIdx + 1}`,
            totalHours,
            totalWorkers,
            hoursByFunction,
            workersByFunction
          });
        }

        setStaffingData({
          monthlyData,
          allFunctions: Array.from(functionsSet).sort()
        });
      } catch (error) {
        console.error('Erro ao calcular recursos:', error);
        setStaffingData({ monthlyData: [], allFunctions: [] });
      } finally {
        setIsLoading(false);
      }
    };

    if (items.length > 0) {
      calculateStaffing();
    } else {
      setStaffingData({ monthlyData: [], allFunctions: [] });
      setIsLoading(false);
    }
  }, [budget?.id, schedule, stages, items, months]);

  const totalStats = useMemo(() => {
    if (!staffingData.monthlyData.length) return { totalHours: 0, maxWorkers: 0, avgWorkers: 0, functionPeaks: {} };

    const totalHours = staffingData.monthlyData.reduce((sum, m) => sum + m.totalHours, 0);
    const maxWorkers = Math.max(...staffingData.monthlyData.map(m => m.totalWorkers));
    const avgWorkers = staffingData.monthlyData.reduce((sum, m) => sum + m.totalWorkers, 0) / months;

    const functionPeaks = {};
    staffingData.allFunctions.forEach(funcao => {
      const peaks = staffingData.monthlyData.map(m => m.workersByFunction[funcao] || 0);
      functionPeaks[funcao] = Math.max(...peaks);
    });

    return {
      totalHours: totalHours.toFixed(0),
      maxWorkers,
      avgWorkers: avgWorkers.toFixed(1),
      functionPeaks
    };
  }, [staffingData, months]);

  const chartData = useMemo(() => {
    return staffingData.monthlyData.map(month => {
      const dataPoint = { monthName: month.monthName };
      staffingData.allFunctions.forEach(funcao => {
        dataPoint[funcao] = month.workersByFunction[funcao] || 0;
      });
      return dataPoint;
    });
  }, [staffingData]);

  const toggleMonth = (monthIdx) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthIdx]: !prev[monthIdx]
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!staffingData.allFunctions.length) {
    return (
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="text-sm text-amber-800">
            <strong>Atenção:</strong> Nenhum insumo de mão de obra encontrado.
            Para gerar este relatório, abra o orçamento e salve novamente — os insumos de mão de obra serão calculados e armazenados automaticamente.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo de Recursos */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <span className="text-sm text-slate-600">Total de Horas</span>
            </div>
            <div className="text-2xl font-bold">{totalStats.totalHours}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-green-600" />
              <span className="text-sm text-slate-600">Pico de Funcionários</span>
            </div>
            <div className="text-2xl font-bold">{totalStats.maxWorkers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              <span className="text-sm text-slate-600">Média de Funcionários</span>
            </div>
            <div className="text-2xl font-bold">{totalStats.avgWorkers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pico por Função */}
      <Card>
        <CardHeader>
          <CardTitle>Pico de Funcionários por Função</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {staffingData.allFunctions.map((funcao, idx) => (
              <div key={funcao} className="p-4 border rounded-lg bg-slate-50">
                <div className="text-xs text-slate-600 mb-1">{funcao}</div>
                <div className="text-2xl font-bold" style={{ color: COLORS[idx % COLORS.length] }}>
                  {totalStats.functionPeaks[funcao]}
                </div>
                <div className="text-xs text-slate-500">funcionários</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Recursos ao Longo do Tempo */}
      <Card>
        <CardHeader>
          <CardTitle>Necessidade de Funcionários por Função ao Longo do Projeto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthName" />
                <YAxis label={{ value: 'Funcionários', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                {staffingData.allFunctions.map((funcao, idx) => (
                  <Bar
                    key={funcao}
                    dataKey={funcao}
                    stackId="a"
                    fill={COLORS[idx % COLORS.length]}
                    name={funcao}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento Mensal de Recursos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Horas Totais</TableHead>
                <TableHead className="text-right">Funcionários Totais</TableHead>
                <TableHead className="text-right">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffingData.monthlyData.map((data, idx) => (
                <React.Fragment key={data.month}>
                  <TableRow 
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => toggleMonth(idx)}
                  >
                    <TableCell className="font-medium">{data.monthName}</TableCell>
                    <TableCell className="text-right">{data.totalHours.toFixed(0)}h</TableCell>
                    <TableCell className="text-right font-medium">{data.totalWorkers}</TableCell>
                    <TableCell className="text-right text-blue-600 text-sm">
                      {expandedMonths[idx] ? '▼ Ocultar' : '▶ Ver por função'}
                    </TableCell>
                  </TableRow>
                  {expandedMonths[idx] && (
                    <TableRow>
                      <TableCell colSpan={4} className="bg-slate-50 p-0">
                        <div className="p-4">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {staffingData.allFunctions.map((funcao, funcIdx) => {
                              const workers = data.workersByFunction[funcao] || 0;
                              const hours = data.hoursByFunction[funcao] || 0;
                              if (workers === 0) return null;
                              return (
                                <div key={funcao} className="p-3 border rounded bg-white">
                                  <div className="text-xs text-slate-600 mb-1">{funcao}</div>
                                  <div className="text-xl font-bold" style={{ color: COLORS[funcIdx % COLORS.length] }}>
                                    {workers}
                                  </div>
                                  <div className="text-xs text-slate-500">{hours.toFixed(0)}h</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="text-sm text-slate-700">
            <strong>Metodologia de Cálculo:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li>Horas de mão de obra extraídas das composições de serviços (campo "horas_por_unidade" dos insumos)</li>
              <li>Distribuição mensal baseada nos percentuais definidos no cronograma</li>
              <li>Funcionários por função calculados individualmente: Horas da Função ÷ {HORAS_TRABALHO_MES}h (arredondado para cima)</li>
              <li>Assumindo {HORAS_TRABALHO_MES} horas de trabalho efetivo por funcionário/mês (~22 dias úteis × 8h)</li>
              <li>As funções são identificadas pela descrição dos insumos do tipo "MAO_OBRA"</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}