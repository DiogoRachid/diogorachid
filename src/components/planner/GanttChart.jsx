import React, { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, ZoomIn, ZoomOut, ChevronDown, ChevronRight, AlertCircle, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#6366f1'
];

function pctToMonthSpan(percentages) {
  // Returns { start (0-indexed), end (0-indexed) } based on first and last non-zero months
  let first = -1, last = -1;
  percentages.forEach((p, i) => {
    if (p > 0) {
      if (first === -1) first = i;
      last = i;
    }
  });
  return { first, last };
}

export default function GanttChart({ budget, stages, items, onSaveSuccess }) {
  const [months, setMonths] = useState(budget?.duracao_meses || 12);
  const [itemPercentages, setItemPercentages] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedStages, setExpandedStages] = useState(new Set());
  const [cellWidth, setCellWidth] = useState(40); // px per month
  const [dragging, setDragging] = useState(null); // { itemId, type: 'move'|'resize-left'|'resize-right', startX, origFirst, origLast }
  const containerRef = useRef(null);

  // Load distributions from DB
  useEffect(() => {
    async function load() {
      if (!budget?.id || !items || items.length === 0) { setLoading(false); return; }
      const dur = budget?.duracao_meses || months;
      setMonths(dur);
      try {
        const distributions = await base44.entities.ServiceMonthlyDistribution.filter({ orcamento_id: budget.id });
        const loaded = {};
        items.forEach(item => { loaded[item.id] = Array(dur).fill(0); });
        distributions.forEach(dist => {
          if (dist.budget_item_id && dist.mes >= 1 && dist.mes <= dur && loaded[dist.budget_item_id]) {
            loaded[dist.budget_item_id][dist.mes - 1] = dist.percentual || 0;
          }
        });
        setItemPercentages(loaded);
        setExpandedStages(new Set(stages.map(s => s.id)));
      } catch (e) {
        console.error(e);
        toast.error('Erro ao carregar cronograma');
      }
      setLoading(false);
    }
    load();
  }, [budget?.id]);

  const getBar = useCallback((itemId) => {
    const pcts = itemPercentages[itemId] || Array(months).fill(0);
    return pctToMonthSpan(pcts);
  }, [itemPercentages, months]);

  const barStyle = (itemId, colorIdx) => {
    const { first, last } = getBar(itemId);
    if (first === -1) return null;
    return {
      left: first * cellWidth,
      width: (last - first + 1) * cellWidth - 2,
      backgroundColor: COLORS[colorIdx % COLORS.length],
    };
  };

  // Distribute percentage evenly across a range
  const applyRange = (itemId, first, last) => {
    const dur = months;
    const pcts = Array(dur).fill(0);
    if (first < 0 || last < 0 || first > last) {
      setItemPercentages(prev => ({ ...prev, [itemId]: pcts }));
      return;
    }
    const span = last - first + 1;
    const perMonth = 100 / span;
    for (let i = first; i <= last; i++) pcts[i] = parseFloat(perMonth.toFixed(4));
    // fix rounding
    const sum = pcts.reduce((a, b) => a + b, 0);
    if (sum > 0) pcts[last] += parseFloat((100 - sum).toFixed(4));
    setItemPercentages(prev => ({ ...prev, [itemId]: pcts }));
  };

  // Mouse drag handlers
  const onMouseDown = (e, itemId, type) => {
    e.preventDefault();
    const { first, last } = getBar(itemId);
    setDragging({ itemId, type, startX: e.clientX, origFirst: first === -1 ? 0 : first, origLast: last === -1 ? 0 : last });
  };

  const onMouseMove = useCallback((e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const dMonths = Math.round(dx / cellWidth);
    let { origFirst, origLast } = dragging;

    let newFirst = origFirst, newLast = origLast;
    if (dragging.type === 'move') {
      newFirst = Math.max(0, Math.min(months - 1, origFirst + dMonths));
      newLast = Math.max(0, Math.min(months - 1, origLast + dMonths));
      if (newFirst > newLast) return;
    } else if (dragging.type === 'resize-right') {
      newLast = Math.max(origFirst, Math.min(months - 1, origLast + dMonths));
    } else if (dragging.type === 'resize-left') {
      newFirst = Math.min(origLast, Math.max(0, origFirst + dMonths));
    }
    applyRange(dragging.itemId, newFirst, newLast);
  }, [dragging, cellWidth, months]);

  const onMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, onMouseMove, onMouseUp]);

  // Click on empty cell to set single-month bar
  const onCellClick = (itemId, monthIdx) => {
    if (dragging) return;
    applyRange(itemId, monthIdx, monthIdx);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.Budget.update(budget.id, { duracao_meses: months });

      const old = await base44.entities.ServiceMonthlyDistribution.filter({ orcamento_id: budget.id });
      for (const d of old) await base44.entities.ServiceMonthlyDistribution.delete(d.id);

      const newDist = [];
      for (const item of items) {
        const pcts = itemPercentages[item.id] || [];
        for (let mi = 0; mi < months; mi++) {
          const percentual = pcts[mi] || 0;
          if (percentual > 0) {
            newDist.push({
              orcamento_id: budget.id,
              budget_item_id: item.id,
              project_stage_id: item.stage_id,
              servico_id: item.servico_id,
              servico_codigo: item.codigo,
              servico_descricao: item.descricao,
              mes: mi + 1,
              quantidade: ((item.quantidade || 0) * percentual) / 100,
              percentual,
              valor_mes: ((item.subtotal || 0) * percentual) / 100
            });
          }
        }
      }
      if (newDist.length > 0) await base44.entities.ServiceMonthlyDistribution.bulkCreate(newDist);

      for (const stage of stages) {
        const si = items.filter(i => i.stage_id === stage.id);
        const dist = [];
        let valor_total = 0;
        for (let mes = 1; mes <= months; mes++) {
          let v = 0;
          si.forEach(item => {
            const pcts = itemPercentages[item.id] || [];
            v += ((item.subtotal || 0) * (pcts[mes - 1] || 0)) / 100;
          });
          valor_total += v;
          dist.push({ mes, percentual: 0 });
        }
        for (let i = 0; i < dist.length; i++) {
          let v = 0;
          si.forEach(item => {
            const pcts = itemPercentages[item.id] || [];
            v += ((item.subtotal || 0) * (pcts[i] || 0)) / 100;
          });
          dist[i].percentual = valor_total > 0 ? (v / valor_total) * 100 : 0;
        }
        await base44.entities.ProjectStage.update(stage.id, { distribuicao_mensal: dist, duracao_meses: months, valor_total });
      }

      toast.success('Diagrama de Gantt salvo! O Cronograma Detalhado e a Curva S foram atualizados.');
      if (onSaveSuccess) onSaveSuccess();
    } catch (e) {
      toast.error('Erro ao salvar: ' + e.message);
    }
    setSaving(false);
  };

  const mainStages = stages.filter(s => !s.parent_stage_id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  const renderStageRows = (stage, level = 0, colorBase = 0) => {
    const isExpanded = expandedStages.has(stage.id);
    const stageItems = items.filter(i => i.stage_id === stage.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const subStages = stages.filter(s => s.parent_stage_id === stage.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const hasContent = stageItems.length > 0 || subStages.length > 0;

    const rows = [];

    // Stage header row
    rows.push(
      <div key={`stage-${stage.id}`} className="flex border-b" style={{ minHeight: 36 }}>
        {/* Label */}
        <div
          className="flex-shrink-0 flex items-center gap-1 px-2 bg-slate-100 dark:bg-slate-800 border-r font-semibold text-xs text-slate-700 dark:text-slate-200 cursor-pointer select-none"
          style={{ width: 220, paddingLeft: 8 + level * 12 }}
          onClick={() => {
            const s = new Set(expandedStages);
            s.has(stage.id) ? s.delete(stage.id) : s.add(stage.id);
            setExpandedStages(s);
          }}
        >
          {hasContent && (isExpanded ? <ChevronDown className="h-3 w-3 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 flex-shrink-0" />)}
          <span className="truncate">{stage.nome}</span>
        </div>
        {/* Gantt row (stage - read only visual) */}
        <div className="flex relative" style={{ width: months * cellWidth }}>
          {Array.from({ length: months }).map((_, mi) => (
            <div key={mi} className="border-r border-slate-100 dark:border-slate-700 h-full" style={{ width: cellWidth }} />
          ))}
        </div>
      </div>
    );

    if (isExpanded) {
      stageItems.forEach((item, idx) => {
        const colorIdx = colorBase + idx;
        const bs = barStyle(item.id, colorIdx);
        const { first, last } = getBar(item.id);

        rows.push(
          <div key={item.id} className="flex border-b group" style={{ minHeight: 34 }}>
            {/* Label */}
            <div
              className="flex-shrink-0 flex items-center px-2 border-r text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 truncate"
              style={{ width: 220, paddingLeft: 16 + level * 12 }}
              title={item.descricao}
            >
              <span className="font-mono text-slate-400 mr-1">{item.codigo}</span>
              <span className="truncate">{item.descricao}</span>
            </div>
            {/* Gantt cells */}
            <div className="flex relative items-center" style={{ width: months * cellWidth, minHeight: 34 }}>
              {Array.from({ length: months }).map((_, mi) => (
                <div
                  key={mi}
                  className="border-r border-slate-100 dark:border-slate-700 h-full cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  style={{ width: cellWidth, position: 'absolute', left: mi * cellWidth, top: 0, bottom: 0 }}
                  onClick={() => onCellClick(item.id, mi)}
                />
              ))}
              {/* Draggable bar */}
              {bs && (
                <div
                  className="absolute flex items-center rounded select-none cursor-grab active:cursor-grabbing shadow-sm"
                  style={{ ...bs, top: 4, height: 26, opacity: 0.9, zIndex: 10 }}
                  onMouseDown={(e) => onMouseDown(e, item.id, 'move')}
                >
                  {/* Left resize handle */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-l"
                    style={{ background: 'rgba(0,0,0,0.15)' }}
                    onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, item.id, 'resize-left'); }}
                  />
                  <span className="text-white text-xs font-medium px-2 truncate w-full text-center pointer-events-none">
                    {first === last ? `M${first + 1}` : `M${first + 1}–M${last + 1}`}
                  </span>
                  {/* Right resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-r"
                    style={{ background: 'rgba(0,0,0,0.15)' }}
                    onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, item.id, 'resize-right'); }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      });

      subStages.forEach((sub, si) => {
        rows.push(...renderStageRows(sub, level + 1, colorBase + stageItems.length + si * 3));
      });
    }

    return rows;
  };

  if (loading) {
    return (
      <Card><CardContent className="pt-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-2" />
        <p className="text-slate-500">Carregando diagrama...</p>
      </CardContent></Card>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Card><CardContent className="pt-6 text-center">
        <p className="text-slate-500">Nenhum serviço encontrado neste orçamento.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Duração (meses):</Label>
                <Input
                  type="number" min="1" max="60"
                  value={months}
                  onChange={e => setMonths(parseInt(e.target.value) || 12)}
                  className="w-20 h-8"
                />
              </div>
              <div className="flex items-center gap-1 border rounded-md overflow-hidden">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCellWidth(w => Math.max(20, w - 10))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-slate-500 px-1">{cellWidth}px</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCellWidth(w => Math.min(100, w + 10))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Info className="h-3 w-3" />
                <span>Arraste as barras ou clique em uma célula para posicionar</span>
              </div>
              <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Salvando...' : 'Salvar Gantt'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gantt */}
      <Card>
        <CardContent className="p-0 overflow-hidden">
          <div className="overflow-x-auto" ref={containerRef}>
            {/* Header months */}
            <div className="flex border-b sticky top-0 z-20 bg-white dark:bg-slate-900">
              <div className="flex-shrink-0 border-r bg-slate-50 dark:bg-slate-800" style={{ width: 220 }}>
                <div className="h-8 flex items-center px-2 text-xs font-semibold text-slate-500">Etapa / Serviço</div>
              </div>
              <div className="flex">
                {Array.from({ length: months }).map((_, mi) => (
                  <div
                    key={mi}
                    className="flex-shrink-0 border-r border-slate-200 dark:border-slate-700 h-8 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800"
                    style={{ width: cellWidth }}
                  >
                    M{mi + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div className="select-none">
              {mainStages.map((stage, idx) => renderStageRows(stage, 0, idx * 5))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Sincronização bidirecional:</strong> Alterações feitas aqui são refletidas no Cronograma Detalhado e na Curva S ao salvar.
          Da mesma forma, alterações feitas no Cronograma Detalhado são refletidas aqui ao recarregar a página.
        </div>
      </div>
    </div>
  );
}