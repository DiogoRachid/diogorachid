import React, { useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Loader2, Clock, Link2, SkipForward, AlertTriangle } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

const formatTime = (seconds) => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
};

const PHASE_LABEL = {
  parsing:    { label: 'Parse',     color: 'text-slate-500' },
  loading:    { label: 'Carga',     color: 'text-blue-500' },
  resolving:  { label: 'Resolve',   color: 'text-purple-500' },
  linking:    { label: 'Vincular',  color: 'text-green-600' },
  calculating:{ label: 'Calcular', color: 'text-orange-500' },
  done:       { label: 'OK',        color: 'text-green-600' },
  error:      { label: 'ERRO',      color: 'text-red-600' },
  skipped:    { label: 'SKIP',      color: 'text-slate-400' },
  pending:    { label: '...',       color: 'text-slate-300' },
};

export default function CompositionImportProgressPanel({ phase, progress, rows, startTime, totals, log }) {
  const listRef = useRef(null);

  const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;

  // Auto-scroll para última linha do log
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [log?.length]);

  const { parsed = 0, skipped = 0, newServices = 0, newInputs = 0, links = 0, duplicates = 0, errors = 0, calculated = 0 } = totals || {};

  return (
    <div className="border rounded-xl bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-purple-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="font-semibold text-sm">Importando composições...</span>
        </div>
        <div className="text-purple-100 text-xs flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(elapsed)}
          </span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="px-4 py-2 border-b bg-slate-50 dark:bg-slate-800">
        <div className="flex items-center gap-3">
          <Progress value={progress.percent} className="flex-1 h-2" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 w-10 text-right">{progress.percent}%</span>
        </div>
        <div className="text-xs text-slate-500 mt-1">{progress.message}</div>
      </div>

      {/* Contadores */}
      <div className="px-4 py-2 border-b flex flex-wrap gap-3 text-xs font-medium bg-white dark:bg-slate-900">
        {parsed > 0 && <span className="text-slate-600">{parsed.toLocaleString('pt-BR')} linhas</span>}
        {skipped > 0 && <span className="text-slate-400"><SkipForward className="inline h-3 w-3 mr-0.5" />{skipped.toLocaleString('pt-BR')} ignoradas</span>}
        {newServices > 0 && <span className="text-purple-600">+{newServices} serviços</span>}
        {newInputs > 0 && <span className="text-blue-600">+{newInputs} insumos</span>}
        {links > 0 && <span className="text-green-600"><Link2 className="inline h-3 w-3 mr-0.5" />{links.toLocaleString('pt-BR')} vínculos</span>}
        {duplicates > 0 && <span className="text-amber-500">{duplicates.toLocaleString('pt-BR')} duplic.</span>}
        {calculated > 0 && <span className="text-orange-500">{calculated} calc.</span>}
        {errors > 0 && <span className="text-red-600"><XCircle className="inline h-3 w-3 mr-0.5" />{errors} erros</span>}
      </div>

      {/* Log de atividade */}
      <div ref={listRef} className="max-h-64 overflow-y-auto font-mono text-xs p-3 space-y-0.5 bg-slate-950 text-slate-200">
        {(log || []).map((entry, i) => (
          <div
            key={i}
            className={`flex gap-2 items-start ${
              entry.type === 'error' ? 'text-red-400' :
              entry.type === 'warn' ? 'text-amber-400' :
              entry.type === 'success' ? 'text-green-400' :
              entry.type === 'phase' ? 'text-purple-300 font-bold' :
              'text-slate-400'
            }`}
          >
            <span className="text-slate-600 shrink-0 w-6 text-right">{i + 1}</span>
            <span>{entry.msg}</span>
          </div>
        ))}
        {(!log || log.length === 0) && (
          <div className="text-slate-600 text-center py-4">Aguardando...</div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 flex justify-between">
        <span>Fase: <strong>{phase || 'iniciando'}</strong></span>
        <span>Decorrido: {formatTime(elapsed)}</span>
      </div>
    </div>
  );
}