import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Tabela de Curva S (valores percentuais acumulados para 50% no meio do tempo)
// Baseada na tabela fornecida da imagem
const SCURVE_TABLE = {
  1: [100.0],
  2: [29.3, 100.0],
  3: [16.9, 50.0, 100.0],
  4: [11.5, 34.3, 68.5, 100.0],
  5: [12.6, 37.7, 66.3, 90.0, 100.0],
  6: [9.3, 28.5, 52.1, 75.2, 92.9, 100.0],
  7: [7.5, 23.2, 42.9, 64.3, 84.0, 96.1, 100.0],
  8: [6.3, 19.5, 36.3, 55.3, 74.2, 89.5, 98.0, 100.0],
  9: [5.4, 16.8, 31.5, 48.2, 66.0, 82.8, 94.6, 99.2, 100.0],
  10: [4.7, 14.7, 27.8, 42.7, 59.1, 75.9, 89.8, 97.8, 99.6, 100.0],
  11: [4.2, 13.0, 24.8, 38.3, 53.4, 69.6, 84.5, 95.2, 99.1, 99.9, 100.0],
  12: [3.7, 11.6, 22.3, 34.7, 48.6, 63.9, 79.1, 91.4, 97.7, 99.6, 99.9, 100.0],
  15: [2.9, 9.1, 17.6, 27.6, 38.9, 51.4, 64.8, 78.1, 89.1, 96.1, 98.9, 99.7, 99.9, 100.0, 100.0],
  18: [2.4, 7.5, 14.5, 22.9, 32.5, 43.2, 54.8, 66.9, 78.6, 88.7, 95.5, 98.6, 99.5, 99.8, 99.9, 100.0, 100.0, 100.0],
  20: [2.2, 6.7, 13.1, 20.7, 29.4, 39.0, 49.5, 60.6, 71.8, 82.3, 90.7, 96.2, 98.8, 99.6, 99.9, 99.9, 100.0, 100.0, 100.0, 100.0],
  24: [1.8, 5.6, 10.9, 17.3, 24.7, 32.9, 41.9, 51.5, 61.4, 71.4, 80.7, 88.6, 94.5, 97.9, 99.3, 99.7, 99.9, 99.9, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0],
  30: [1.4, 4.5, 8.7, 13.8, 19.8, 26.5, 34.0, 42.1, 50.7, 59.6, 68.6, 77.3, 85.3, 91.8, 96.3, 98.7, 99.5, 99.8, 99.9, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0],
  36: [1.2, 3.7, 7.2, 11.5, 16.5, 22.2, 28.5, 35.4, 42.8, 50.5, 58.5, 66.6, 74.6, 82.1, 88.7, 94.0, 97.4, 99.1, 99.7, 99.9, 99.9, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0],
  40: [1.1, 3.4, 6.5, 10.4, 14.9, 20.1, 25.8, 32.1, 38.8, 45.9, 53.4, 61.0, 68.6, 76.1, 83.2, 89.5, 94.5, 97.8, 99.3, 99.8, 99.9, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0],
  48: [0.9, 2.8, 5.4, 8.6, 12.4, 16.8, 21.6, 27.0, 32.8, 38.9, 45.4, 52.1, 59.0, 65.9, 72.7, 79.3, 85.4, 90.7, 94.8, 97.6, 99.1, 99.7, 99.9, 99.9, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0],
  50: [0.9, 2.7, 5.2, 8.3, 12.0, 16.2, 20.9, 26.0, 31.6, 37.5, 43.7, 50.2, 56.9, 63.7, 70.4, 77.0, 83.3, 88.9, 93.6, 97.0, 98.9, 99.6, 99.9, 99.9, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0]
};

// Função para buscar valores da tabela com interpolação para durações não tabeladas
const calculateSCurve = (months) => {
  // Se temos valor exato na tabela, usar
  if (SCURVE_TABLE[months]) {
    return SCURVE_TABLE[months];
  }
  
  // Se excede tabela, usar o maior disponível (50 meses)
  if (months > 50) {
    const base = SCURVE_TABLE[50];
    const extended = [...base];
    // Extender mantendo 100% nos meses extras
    for (let i = base.length; i < months; i++) {
      extended.push(100.0);
    }
    return extended;
  }
  
  // Interpolar entre valores tabelados mais próximos
  const keys = Object.keys(SCURVE_TABLE).map(Number).sort((a, b) => a - b);
  const lower = keys.reverse().find(k => k < months);
  const upper = keys.find(k => k > months);
  
  if (!lower || !upper) {
    // Fallback para linear
    return Array.from({ length: months }, (_, i) => ((i + 1) / months) * 100);
  }
  
  // Interpolação linear entre lower e upper
  const lowerData = SCURVE_TABLE[lower];
  const upperData = SCURVE_TABLE[upper];
  const ratio = (months - lower) / (upper - lower);
  
  const result = [];
  for (let i = 0; i < months; i++) {
    const lowerIdx = Math.floor((i / months) * lowerData.length);
    const upperIdx = Math.floor((i / months) * upperData.length);
    const interpolated = lowerData[lowerIdx] + (upperData[upperIdx] - lowerData[lowerIdx]) * ratio;
    result.push(interpolated);
  }
  
  return result;
};

const calculateIdealCurve = (months) => {
  const data = [];
  for (let i = 1; i <= months; i++) {
    data.push((i / months) * 100);
  }
  return data;
};

const calculateScheduleCurve = (schedule, stages, items, months) => {
  const data = [];
  const totalValue = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  
  for (let monthIdx = 0; monthIdx < months; monthIdx++) {
    let cumulativeValue = 0;
    
    stages.forEach(stage => {
      const stageValue = items
        .filter(item => item.stage_id === stage.id)
        .reduce((sum, item) => sum + (item.subtotal || 0), 0);
      
      const cumulativePercentage = schedule[stage.id]?.percentages
        ?.slice(0, monthIdx + 1)
        .reduce((sum, p) => sum + p, 0) || 0;
      
      cumulativeValue += (stageValue * cumulativePercentage) / 100;
    });
    
    data.push(totalValue > 0 ? (cumulativeValue / totalValue) * 100 : 0);
  }
  
  return data;
};

export default function SCurveChart({ schedule, stages, items, months }) {
  const chartData = useMemo(() => {
    const idealCurve = calculateIdealCurve(months);
    const projectedCurve = calculateSCurve(months);
    const scheduleCurve = calculateScheduleCurve(schedule, stages, items, months);
    
    return Array.from({ length: months }).map((_, idx) => ({
      month: `Mês ${idx + 1}`,
      ideal: idealCurve[idx],
      projetada: projectedCurve[idx],
      cronograma: scheduleCurve[idx]
    }));
  }, [schedule, stages, items, months]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Curva S - Análise de Progresso</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis 
                domain={[0, 100]}
                label={{ value: 'Avanço Físico (%)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value) => `${Number(value).toFixed(2)}%`}
                labelStyle={{ color: '#000' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="ideal" 
                stroke="#94a3b8" 
                strokeWidth={2}
                name="Curva Ideal (Linear)"
                strokeDasharray="5 5"
              />
              <Line 
                type="monotone" 
                dataKey="projetada" 
                stroke="#f59e0b" 
                strokeWidth={2}
                name="Curva S Projetada (Fórmula)"
              />
              <Line 
                type="monotone" 
                dataKey="cronograma" 
                stroke="#3b82f6" 
                strokeWidth={3}
                name="Curva do Cronograma"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-0.5 bg-slate-400" style={{ borderTop: '2px dashed' }}></div>
              <span className="font-medium text-sm">Curva Ideal</span>
            </div>
            <p className="text-xs text-slate-600">Distribuição linear uniforme ao longo do tempo</p>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-0.5 bg-orange-500"></div>
              <span className="font-medium text-sm">Curva S Projetada</span>
            </div>
            <p className="text-xs text-slate-600">Baseada em tabela de referência (50% no meio do tempo)</p>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-0.5 bg-blue-600"></div>
              <span className="font-medium text-sm">Curva do Cronograma</span>
            </div>
            <p className="text-xs text-slate-600">Calculada com base nos percentuais mensais definidos</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}