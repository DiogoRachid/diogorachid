import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, ExternalLink, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const STATUS_CONFIG = {
  aguardando:   { label: 'Aguardando',   bg: 'bg-indigo-100', text: 'text-indigo-700' },
  participando: { label: 'Participando', bg: 'bg-blue-100',   text: 'text-blue-700' },
  encerrada:    { label: 'Encerrada',    bg: 'bg-green-100',  text: 'text-green-700' },
  cancelada:    { label: 'Cancelada',    bg: 'bg-red-100',    text: 'text-red-700' },
};

const fmt = (v) => v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—';
const fmtPct = (v) => v != null ? `${parseFloat(v).toFixed(2)}%` : '—';

export default function LicitacaoTable({ licitacoes, isLoading, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
    </div>
  );

  if (licitacoes.length === 0) return (
    <Card><CardContent className="py-12 text-center text-slate-400">Nenhuma licitação cadastrada. Clique em "Nova Licitação" para começar.</CardContent></Card>
  );

  return (
    <div className="space-y-2">
      {licitacoes.map((l) => {
        const st = STATUS_CONFIG[l.status] || STATUS_CONFIG.aguardando;
        const isExp = expanded === l.id;

        return (
          <Card key={l.id} className="overflow-hidden">
            {/* Linha principal */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setExpanded(isExp ? null : l.id)}
            >
              {/* Indicador ganhou */}
              <div className="flex-shrink-0">
                {l.ganhou
                  ? <Trophy className="h-5 w-5 text-yellow-500" />
                  : <div className="h-5 w-5 rounded-full border-2 border-slate-200" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{l.nome_obra}</span>
                  {l.numero_licitacao && <span className="text-xs text-slate-400">#{l.numero_licitacao}</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{l.orgao_licitante} · {l.tipo}</div>
              </div>

              <div className="hidden sm:flex flex-col items-end text-right flex-shrink-0 mr-2">
                <span className="text-sm font-semibold">{fmt(l.valor_maximo)}</span>
                {l.percentual_desconto != null && (
                  <span className="text-xs text-green-600 font-medium">↓ {fmtPct(l.percentual_desconto)}</span>
                )}
              </div>

              <div className="hidden md:block flex-shrink-0 text-xs text-slate-500 mr-2">
                {l.data_abertura ? format(parseISO(l.data_abertura), 'dd/MM/yyyy') : '—'}
              </div>

              <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${st.bg} ${st.text}`}>
                {st.label}
              </span>

              {isExp ? <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />}
            </div>

            {/* Detalhes expandidos */}
            {isExp && (
              <div className="border-t px-4 py-4 bg-slate-50 dark:bg-slate-900/50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <Detail label="Valor Máximo" value={fmt(l.valor_maximo)} />
                  <Detail label="Nossa Proposta" value={fmt(l.nossa_proposta)} />
                  <Detail label="Desconto s/ Máximo" value={fmtPct(l.percentual_desconto)} highlight />
                  <Detail label="Valor Vencedor" value={fmt(l.valor_vencedor)} />
                  <Detail label="Empresa Vencedora" value={l.empresa_vencedora || '—'} />
                  <Detail label="Qtd. Empresas" value={l.qtd_empresas || '—'} />
                  <Detail label="Participou?" value={l.participou === true ? 'Sim' : l.participou === false ? 'Não' : '—'} />
                  {l.participou === false && l.justificativa_nao_participacao && (
                    <Detail label="Justificativa" value={l.justificativa_nao_participacao} colSpan />
                  )}
                </div>

                {l.observacoes && (
                  <p className="text-xs text-slate-500 mb-3"><span className="font-medium">Obs:</span> {l.observacoes}</p>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => onEdit(l)}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  {l.link_edital && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={l.link_edital} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" /> Edital
                      </a>
                    </Button>
                  )}
                  {confirmDelete === l.id ? (
                    <>
                      <Button size="sm" variant="destructive" onClick={() => { onDelete(l.id); setConfirmDelete(null); }}>
                        Confirmar Exclusão
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => setConfirmDelete(l.id)}>
                      <Trash2 className="h-3 w-3 mr-1" /> Excluir
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Detail({ label, value, highlight, colSpan }) {
  return (
    <div className={colSpan ? 'col-span-2' : ''}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-green-600' : 'text-slate-700 dark:text-slate-200'}`}>{value}</p>
    </div>
  );
}