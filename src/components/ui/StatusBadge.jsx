import React from 'react';
import { cn } from "@/lib/utils";

const statusStyles = {
  ativo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inativo: 'bg-slate-50 text-slate-600 border-slate-200',
  em_aberto: 'bg-amber-50 text-amber-700 border-amber-200',
  pago: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  recebido: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  atrasado: 'bg-red-50 text-red-700 border-red-200',
  cancelado: 'bg-slate-50 text-slate-600 border-slate-200',
  planejamento: 'bg-blue-50 text-blue-700 border-blue-200',
  em_andamento: 'bg-amber-50 text-amber-700 border-amber-200',
  pausada: 'bg-orange-50 text-orange-700 border-orange-200',
  concluida: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ativa: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  entrada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  saida: 'bg-red-50 text-red-700 border-red-200',
  transferencia: 'bg-blue-50 text-blue-700 border-blue-200',
  pendente: 'bg-amber-50 text-amber-700 border-amber-200'
};

const statusLabels = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  em_aberto: 'Em Aberto',
  pago: 'Pago',
  recebido: 'Recebido',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
  planejamento: 'Planejamento',
  em_andamento: 'Em Andamento',
  pausada: 'Pausada',
  concluida: 'Concluída',
  ativa: 'Ativa',
  entrada: 'Entrada',
  saida: 'Saída',
  transferencia: 'Transferência',
  pendente: 'Pendente'
};

export default function StatusBadge({ status, className }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border",
      statusStyles[status] || 'bg-slate-50 text-slate-600 border-slate-200',
      className
    )}>
      {statusLabels[status] || status}
    </span>
  );
}