import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AlertCircle } from 'lucide-react';

export default function ScheduleEditor({ budget, stages, items, onChange }) {
  const [months, setMonths] = useState(12);
  const [schedule, setSchedule] = useState({});

  useEffect(() => {
    // Inicializar schedule com as etapas
    const initialSchedule = {};
    stages.forEach(stage => {
      initialSchedule[stage.id] = {
        percentages: Array(months).fill(0),
        total: 0
      };
    });
    setSchedule(initialSchedule);
  }, [stages, months]);

  const handlePercentageChange = (stageId, monthIndex, value) => {
    const newSchedule = { ...schedule };
    const percentage = parseFloat(value) || 0;
    
    newSchedule[stageId].percentages[monthIndex] = percentage;
    newSchedule[stageId].total = newSchedule[stageId].percentages.reduce((sum, p) => sum + p, 0);
    
    if (newSchedule[stageId].total > 100) {
      toast.error(`A etapa não pode ultrapassar 100% de execução`);
      return;
    }
    
    setSchedule(newSchedule);
    onChange && onChange(newSchedule, months);
  };

  const handleMonthsChange = (value) => {
    const newMonths = parseInt(value) || 12;
    setMonths(newMonths);
    
    // Reajustar arrays de percentuais
    const newSchedule = { ...schedule };
    Object.keys(newSchedule).forEach(stageId => {
      const current = newSchedule[stageId].percentages;
      if (current.length > newMonths) {
        newSchedule[stageId].percentages = current.slice(0, newMonths);
      } else {
        newSchedule[stageId].percentages = [...current, ...Array(newMonths - current.length).fill(0)];
      }
      newSchedule[stageId].total = newSchedule[stageId].percentages.reduce((sum, p) => sum + p, 0);
    });
    setSchedule(newSchedule);
    onChange && onChange(newSchedule, newMonths);
  };

  const getStageValue = (stageId) => {
    return items
      .filter(item => item.stage_id === stageId)
      .reduce((sum, item) => sum + (item.subtotal || 0), 0);
  };

  const getMonthlyValue = (stageId, monthIndex) => {
    const stageValue = getStageValue(stageId);
    const percentage = schedule[stageId]?.percentages[monthIndex] || 0;
    return (stageValue * percentage) / 100;
  };

  const getCumulativeValue = (stageId, monthIndex) => {
    const stageValue = getStageValue(stageId);
    const cumulativePercentage = schedule[stageId]?.percentages
      .slice(0, monthIndex + 1)
      .reduce((sum, p) => sum + p, 0) || 0;
    return (stageValue * cumulativePercentage) / 100;
  };

  const getTotalMonthly = (monthIndex) => {
    return stages.reduce((sum, stage) => sum + getMonthlyValue(stage.id, monthIndex), 0);
  };

  const getTotalCumulative = (monthIndex) => {
    return stages.reduce((sum, stage) => sum + getCumulativeValue(stage.id, monthIndex), 0);
  };

  const renderStageRow = (stage, level = 0) => {
    const stageValue = getStageValue(stage.id);
    const stageData = schedule[stage.id];
    const isComplete = stageData?.total === 100;
    const isOverLimit = stageData?.total > 100;

    return (
      <React.Fragment key={stage.id}>
        <TableRow className={level > 0 ? 'bg-slate-50' : ''}>
          <TableCell className="font-medium sticky left-0 bg-white z-10">
            <div style={{ paddingLeft: `${level * 20}px` }}>
              {level > 0 && <span className="text-slate-400 mr-2">└─</span>}
              {stage.nome}
            </div>
          </TableCell>
          <TableCell className="text-right text-sm">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stageValue)}
          </TableCell>
          {Array.from({ length: months }).map((_, idx) => (
            <TableCell key={idx} className="p-1">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={stageData?.percentages[idx] || 0}
                onChange={(e) => handlePercentageChange(stage.id, idx, e.target.value)}
                className="h-8 w-16 text-xs text-center"
              />
            </TableCell>
          ))}
          <TableCell className={`text-right font-bold ${isOverLimit ? 'text-red-600' : isComplete ? 'text-green-600' : 'text-slate-600'}`}>
            {stageData?.total.toFixed(1)}%
            {isOverLimit && <AlertCircle className="inline h-4 w-4 ml-1" />}
          </TableCell>
        </TableRow>
        {/* Subetapas */}
        {stages
          .filter(s => s.parent_stage_id === stage.id)
          .map(subStage => renderStageRow(subStage, level + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração do Cronograma</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Duração do Projeto (meses):</Label>
              <Input
                type="number"
                min="1"
                max="60"
                value={months}
                onChange={(e) => handleMonthsChange(e.target.value)}
                className="w-20"
              />
            </div>
            <div className="text-sm text-slate-500">
              Defina os percentuais de execução mensais para cada etapa
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-10 min-w-[200px]">Etapa</TableHead>
                  <TableHead className="text-right min-w-[120px]">Valor Total</TableHead>
                  {Array.from({ length: months }).map((_, idx) => (
                    <TableHead key={idx} className="text-center min-w-[80px]">
                      Mês {idx + 1}
                    </TableHead>
                  ))}
                  <TableHead className="text-right min-w-[80px]">Total %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stages
                  .filter(stage => !stage.parent_stage_id)
                  .map(stage => renderStageRow(stage))}
                
                {/* Linha de Totais Mensais */}
                <TableRow className="bg-slate-100 font-bold border-t-2">
                  <TableCell className="sticky left-0 bg-slate-100 z-10">TOTAL MENSAL</TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(budget?.total_final || 0)}
                  </TableCell>
                  {Array.from({ length: months }).map((_, idx) => (
                    <TableCell key={idx} className="text-center text-xs">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(getTotalMonthly(idx))}
                    </TableCell>
                  ))}
                  <TableCell></TableCell>
                </TableRow>

                {/* Linha de Totais Acumulados */}
                <TableRow className="bg-slate-200 font-bold">
                  <TableCell className="sticky left-0 bg-slate-200 z-10">ACUMULADO</TableCell>
                  <TableCell></TableCell>
                  {Array.from({ length: months }).map((_, idx) => (
                    <TableCell key={idx} className="text-center text-xs">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(getTotalCumulative(idx))}
                    </TableCell>
                  ))}
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}