import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Bar, ComposedChart } from 'recharts';

export default function MeasurementChart({ measurements, schedule, budget }) {
  // Preparar dados para o gráfico
  const chartData = [];
  
  // Obter número total de meses do cronograma
  const totalMonths = budget?.duracao_meses || schedule?.length || 12;
  
  // Criar array com todos os meses
  for (let month = 1; month <= totalMonths; month++) {
    const scheduleMonth = schedule?.find(s => s.mes === month);
    const measurement = measurements.find(m => m.mes_referencia === month);
    
    // Valor previsto acumulado
    const previstoAcum = schedule
      ?.filter(s => s.mes <= month)
      .reduce((sum, s) => sum + (s.valor_mensal || 0), 0) || 0;
    
    // Valor executado acumulado
    const executadoAcum = measurements
      ?.filter(m => m.mes_referencia <= month && m.status !== 'cancelada')
      .reduce((sum, m) => sum + (m.total_executado || 0), 0) || 0;
    
    chartData.push({
      mes: `Mês ${month}`,
      previsto: previstoAcum,
      executado: executadoAcum,
      previstoMensal: scheduleMonth?.valor_mensal || 0,
      executadoMensal: measurement?.total_executado || 0
    });
  }
  
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(v || 0);
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Curva de Avanço - Previsto x Executado (Acumulado)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(value) => fmt(value)} />
              <Tooltip 
                formatter={(value) => fmt(value)}
                labelStyle={{ color: '#333' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="previsto" 
                name="Previsto Acumulado"
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="executado" 
                name="Executado Acumulado"
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Comparativo Mensal - Previsto x Executado</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(value) => fmt(value)} />
              <Tooltip 
                formatter={(value) => fmt(value)}
                labelStyle={{ color: '#333' }}
              />
              <Legend />
              <Bar 
                dataKey="previstoMensal" 
                name="Previsto Mensal"
                fill="#93c5fd"
              />
              <Bar 
                dataKey="executadoMensal" 
                name="Executado Mensal"
                fill="#86efac"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}