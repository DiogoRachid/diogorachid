import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

export default function StaffingCalculator({ schedule, stages, items, services, months }) {
  const [expandedMonths, setExpandedMonths] = useState({});

  // Carregar todos os inputs
  const { data: inputs = [], isLoading } = useQuery({
    queryKey: ['inputs'],
    queryFn: () => base44.entities.Input.list()
  });

  const inputMap = useMemo(() => {
    return new Map(inputs.map(input => [input.id, input]));
  }, [inputs]);

  const staffingData = useMemo(() => {
    if (!inputs.length) return { monthlyData: [], allFunctions: [] };

    const monthlyData = [];
    const functionsSet = new Set();

    for (let monthIdx = 0; monthIdx < months; monthIdx++) {
      const hoursByFunction = {};

      stages.forEach(stage => {
        const stageItems = items.filter(item => item.stage_id === stage.id);
        const percentage = schedule[stage.id]?.percentages[monthIdx] || 0;

        stageItems.forEach(budgetItem => {
          const service = services.find(s => s.id === budgetItem.servico_id);
          if (!service || !service.items_snapshot) return;

          service.items_snapshot.forEach(serviceItem => {
            if (serviceItem.categoria === 'MAO_OBRA' && serviceItem.item_id) {
              const inputDetails = inputMap.get(serviceItem.item_id);
              const funcao = inputDetails?.funcao || 'Não Atribuída';
              
              functionsSet.add(funcao);

              const horasPorUnidade = serviceItem.horas_por_unidade || 1;
              const quantidadeMensal = (budgetItem.quantidade * percentage) / 100;
              const horasMes = quantidadeMensal * horasPorUnidade;

              hoursByFunction[funcao] = (hoursByFunction[funcao] || 0) + horasMes;
            }
          });
        });
      });

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

    return {
      monthlyData,
      allFunctions: Array.from(functionsSet).sort()
    };
  }, [schedule, stages, items, services, inputs, inputMap, months]);

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
            <strong>Atenção:</strong> Nenhum insumo de mão de obra encontrado com função definida.
            Certifique-se de cadastrar insumos do tipo "MAO_OBRA" com o campo "função" preenchido.
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
              <li>As funções são definidas no cadastro de insumos do tipo "MAO_OBRA"</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}