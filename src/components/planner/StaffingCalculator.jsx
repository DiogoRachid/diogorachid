import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { Users, Clock, TrendingUp } from 'lucide-react';

const HORAS_TRABALHO_MES = 176; // ~22 dias úteis * 8 horas

export default function StaffingCalculator({ schedule, stages, items, services, months }) {
  const staffingData = useMemo(() => {
    const monthlyData = [];
    
    for (let monthIdx = 0; monthIdx < months; monthIdx++) {
      let totalHoursMonth = 0;
      
      stages.forEach(stage => {
        const stageItems = items.filter(item => item.stage_id === stage.id);
        const percentage = schedule[stage.id]?.percentages[monthIdx] || 0;
        
        stageItems.forEach(budgetItem => {
          const service = services.find(s => s.id === budgetItem.servico_id);
          if (!service || !service.items_snapshot) return;
          
          // Calcular horas de mão de obra
          service.items_snapshot.forEach(serviceItem => {
            if (serviceItem.categoria === 'MAO_OBRA') {
              const horasPorUnidade = serviceItem.horas_por_unidade || 1;
              const quantidadeMensal = (budgetItem.quantidade * percentage) / 100;
              const horasMes = quantidadeMensal * horasPorUnidade;
              totalHoursMonth += horasMes;
            }
          });
        });
      });
      
      const funcionariosNecessarios = Math.ceil(totalHoursMonth / HORAS_TRABALHO_MES);
      const equipesNecessarias = Math.ceil(funcionariosNecessarios / 5); // Assumindo equipes de 5 pessoas
      
      monthlyData.push({
        month: monthIdx + 1,
        monthName: `Mês ${monthIdx + 1}`,
        hours: totalHoursMonth,
        workers: funcionariosNecessarios,
        teams: equipesNecessarias
      });
    }
    
    return monthlyData;
  }, [schedule, stages, items, services, months]);

  const totalStats = useMemo(() => {
    const totalHours = staffingData.reduce((sum, m) => sum + m.hours, 0);
    const maxWorkers = Math.max(...staffingData.map(m => m.workers));
    const maxTeams = Math.max(...staffingData.map(m => m.teams));
    const avgWorkers = staffingData.reduce((sum, m) => sum + m.workers, 0) / months;
    
    return {
      totalHours: totalHours.toFixed(0),
      maxWorkers,
      maxTeams,
      avgWorkers: avgWorkers.toFixed(1)
    };
  }, [staffingData, months]);

  return (
    <div className="space-y-6">
      {/* Resumo de Recursos */}
      <div className="grid grid-cols-4 gap-4">
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
              <Users className="h-5 w-5 text-orange-600" />
              <span className="text-sm text-slate-600">Média de Funcionários</span>
            </div>
            <div className="text-2xl font-bold">{totalStats.avgWorkers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <span className="text-sm text-slate-600">Equipes Necessárias</span>
            </div>
            <div className="text-2xl font-bold">{totalStats.maxTeams}</div>
            <div className="text-xs text-slate-500 mt-1">Pico (5 pessoas/equipe)</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Recursos ao Longo do Tempo */}
      <Card>
        <CardHeader>
          <CardTitle>Necessidade de Recursos ao Longo do Projeto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={staffingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthName" />
                <YAxis yAxisId="left" label={{ value: 'Funcionários', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Horas', angle: 90, position: 'insideRight' }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="workers" fill="#3b82f6" name="Funcionários Necessários" />
                <Line yAxisId="right" type="monotone" dataKey="hours" stroke="#f59e0b" strokeWidth={2} name="Horas Totais" />
              </ComposedChart>
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
                <TableHead className="text-right">Funcionários</TableHead>
                <TableHead className="text-right">Equipes (5 pessoas)</TableHead>
                <TableHead className="text-right">Média H/Funcionário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffingData.map((data) => (
                <TableRow key={data.month}>
                  <TableCell className="font-medium">{data.monthName}</TableCell>
                  <TableCell className="text-right">{data.hours.toFixed(0)}h</TableCell>
                  <TableCell className="text-right font-medium">{data.workers}</TableCell>
                  <TableCell className="text-right">{data.teams}</TableCell>
                  <TableCell className="text-right text-sm text-slate-600">
                    {data.workers > 0 ? (data.hours / data.workers).toFixed(0) : 0}h
                  </TableCell>
                </TableRow>
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
              <li>Assumindo {HORAS_TRABALHO_MES} horas de trabalho efetivo por funcionário/mês (~22 dias úteis × 8h)</li>
              <li>Equipes calculadas considerando 5 pessoas por equipe</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}