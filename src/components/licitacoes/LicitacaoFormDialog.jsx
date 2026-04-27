import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Loader2, Calculator } from 'lucide-react';

const TIPOS = [
  'Concorrência', 'Tomada de Preços', 'Convite',
  'Pregão Presencial', 'Pregão Eletrônico', 'RDC', 'Dispensa', 'Inexigibilidade'
];

const EMPTY = {
  nome_obra: '', orgao_licitante: '', numero_licitacao: '', tipo: '',
  data_abertura: '', valor_maximo: '', status: 'aguardando',
  participou: null, justificativa_nao_participacao: '',
  nossa_proposta: '', qtd_empresas: '', empresa_vencedora: '',
  valor_vencedor: '', ganhou: false, observacoes: '', link_edital: ''
};

const fmt = (v) => v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : null;

export default function LicitacaoFormDialog({ open, onClose, onSubmit, initialData, isLoading }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (initialData) {
      setForm({ ...EMPTY, ...initialData });
    } else {
      setForm(EMPTY);
    }
  }, [initialData, open]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Cálculo de desconto em tempo real (preview)
  const desconto = form.nossa_proposta && form.valor_maximo
    ? ((Number(form.valor_maximo) - Number(form.nossa_proposta)) / Number(form.valor_maximo) * 100).toFixed(2)
    : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form };
    // Converte tipos
    if (payload.valor_maximo) payload.valor_maximo = Number(payload.valor_maximo);
    if (payload.nossa_proposta) payload.nossa_proposta = Number(payload.nossa_proposta);
    if (payload.valor_vencedor) payload.valor_vencedor = Number(payload.valor_vencedor);
    if (payload.qtd_empresas) payload.qtd_empresas = parseInt(payload.qtd_empresas);
    onSubmit(payload);
  };

  const isEncerrada = form.status === 'encerrada';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Licitação' : 'Nova Licitação'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* DADOS BÁSICOS */}
          <Section title="Dados Básicos">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nome da Obra *" colSpan>
                <Input value={form.nome_obra} onChange={e => set('nome_obra', e.target.value)} required placeholder="Ex: Construção do Bloco A" />
              </Field>
              <Field label="Órgão Licitante *">
                <Input value={form.orgao_licitante} onChange={e => set('orgao_licitante', e.target.value)} required placeholder="Ex: Prefeitura de Londrina" />
              </Field>
              <Field label="Nº da Licitação">
                <Input value={form.numero_licitacao} onChange={e => set('numero_licitacao', e.target.value)} placeholder="Ex: 001/2025" />
              </Field>
              <Field label="Modalidade">
                <Select value={form.tipo} onValueChange={v => set('tipo', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data de Abertura *">
                <Input type="date" value={form.data_abertura} onChange={e => set('data_abertura', e.target.value)} required />
              </Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aguardando">Aguardando</SelectItem>
                    <SelectItem value="participando">Participando</SelectItem>
                    <SelectItem value="encerrada">Encerrada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Valor Máximo (R$) *">
                <Input type="number" step="0.01" value={form.valor_maximo} onChange={e => set('valor_maximo', e.target.value)} required placeholder="0,00" />
              </Field>
              <Field label="Link do Edital">
                <Input value={form.link_edital} onChange={e => set('link_edital', e.target.value)} placeholder="https://..." />
              </Field>
            </div>
          </Section>

          {/* PARTICIPAÇÃO */}
          <Section title="Participação">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Participou?">
                <Select
                  value={form.participou === null ? '' : form.participou ? 'sim' : 'nao'}
                  onValueChange={v => set('participou', v === 'sim' ? true : v === 'nao' ? false : null)}
                >
                  <SelectTrigger><SelectValue placeholder="Não definido" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Nossa Proposta (R$)">
                <Input type="number" step="0.01" value={form.nossa_proposta} onChange={e => set('nossa_proposta', e.target.value)} placeholder="0,00" />
              </Field>

              {/* Preview do desconto */}
              {desconto !== null && (
                <div className="sm:col-span-2 flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                  <Calculator className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-green-700">
                    Desconto calculado sobre o valor máximo: <strong>{desconto}%</strong>
                    {form.valor_maximo && form.nossa_proposta && (
                      <span className="text-green-600 ml-2">
                        (economia de {fmt(Number(form.valor_maximo) - Number(form.nossa_proposta))})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {form.participou === false && (
                <Field label="Justificativa de Não Participação" colSpan>
                  <Textarea
                    value={form.justificativa_nao_participacao}
                    onChange={e => set('justificativa_nao_participacao', e.target.value)}
                    placeholder="Ex: falta de acervo técnico, custo superior ao teto, curto prazo de execução..."
                    rows={2}
                  />
                </Field>
              )}
            </div>
          </Section>

          {/* PÓS-ABERTURA */}
          {isEncerrada && (
            <Section title="Pós-Abertura">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Qtd. de Empresas">
                  <Input type="number" value={form.qtd_empresas} onChange={e => set('qtd_empresas', e.target.value)} placeholder="0" />
                </Field>
                <Field label="Empresa Vencedora">
                  <Input value={form.empresa_vencedora} onChange={e => set('empresa_vencedora', e.target.value)} placeholder="Nome da empresa" />
                </Field>
                <Field label="Valor Vencedor (R$)">
                  <Input type="number" step="0.01" value={form.valor_vencedor} onChange={e => set('valor_vencedor', e.target.value)} placeholder="0,00" />
                </Field>
                <Field label="Nossa empresa venceu?">
                  <Select value={form.ganhou ? 'sim' : 'nao'} onValueChange={v => set('ganhou', v === 'sim')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim 🏆</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Section>
          )}

          {/* OBSERVAÇÕES */}
          <Field label="Observações">
            <Textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Informações adicionais..." rows={2} />
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {initialData ? 'Salvar Alterações' : 'Cadastrar Licitação'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 pb-1 border-b">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children, colSpan }) {
  return (
    <div className={colSpan ? 'sm:col-span-2' : ''}>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}