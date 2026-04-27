import React from 'react';
import { CheckSquare, Square } from 'lucide-react';

export const WHATSAPP_MODULOS = [
  { key: 'contas_pagar_receber', label: 'Contas a Pagar/Receber', descricao: 'Vencimentos do dia e próximos 7 dias' },
  { key: 'patrimonio', label: 'Patrimônio / Investimentos', descricao: 'Valor total do patrimônio investido' },
  { key: 'documentos', label: 'Documentos / Certidões', descricao: 'Vencimentos de certidões e documentos' },
  { key: 'rh_contratos', label: 'RH – Contratos de Experiência', descricao: 'Contratos a vencer nos próximos 7 dias' },
  { key: 'logistica', label: 'Logística – Pedidos', descricao: 'Pedidos de material recebidos ontem' },
  { key: 'licitacoes', label: 'Licitações', descricao: 'Próximas aberturas e resultado das participações' },
];

const DEFAULT_MODULOS = WHATSAPP_MODULOS.map(m => m.key);

export function getModulosAtivos(saved) {
  if (!saved || saved.length === 0) return DEFAULT_MODULOS;
  return saved;
}

export default function WhatsAppModulosSelector({ value, onChange }) {
  const ativos = value && value.length > 0 ? value : DEFAULT_MODULOS;

  const toggle = (key) => {
    if (ativos.includes(key)) {
      onChange(ativos.filter(k => k !== key));
    } else {
      onChange([...ativos, key]);
    }
  };

  const toggleAll = () => {
    if (ativos.length === WHATSAPP_MODULOS.length) {
      onChange([]);
    } else {
      onChange(WHATSAPP_MODULOS.map(m => m.key));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-700">Selecione os módulos do alerta diário:</p>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          {ativos.length === WHATSAPP_MODULOS.length ? (
            <><CheckSquare className="h-3 w-3" /> Desmarcar todos</>
          ) : (
            <><Square className="h-3 w-3" /> Selecionar todos</>
          )}
        </button>
      </div>
      <div className="space-y-2">
        {WHATSAPP_MODULOS.map(mod => {
          const ativo = ativos.includes(mod.key);
          return (
            <button
              key={mod.key}
              type="button"
              onClick={() => toggle(mod.key)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                ativo
                  ? 'bg-blue-50 border-blue-300 text-blue-900'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {ativo
                ? <CheckSquare className="h-4 w-4 text-blue-600 flex-shrink-0" />
                : <Square className="h-4 w-4 text-slate-400 flex-shrink-0" />
              }
              <div className="min-w-0">
                <p className={`text-sm font-medium ${ativo ? 'text-blue-800' : 'text-slate-600'}`}>{mod.label}</p>
                <p className="text-xs text-slate-400">{mod.descricao}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}