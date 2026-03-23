import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Users, Save, X, Plus, Trash2, Upload, FileText, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from '@/components/ui/PageHeader';
import { toast } from 'sonner';

// ─── Campo rótulo + input inline (layout ficha) ─────────────────────────────
function Field({ label, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

// ─── Seção com título ────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <Card>
      <CardHeader className="py-3 px-5 bg-slate-50 border-b">
        <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 pb-5 px-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-3">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

const EMPTY = {
  nome_completo: '', cpf: '', pis: '', rg: '', rg_data_emissao: '', rg_orgao_emissor: '',
  data_nascimento: '', naturalidade_cidade: '', naturalidade_estado: '',
  raca: '', grau_instrucao: '', pcd: false, pcd_descricao: '',
  estado_civil: '', conjuge_nome: '', conjuge_data_nascimento: '', conjuge_cpf: '',
  nome_pai: '', nome_mae: '',
  telefone: '', email: '', endereco: '', cidade: '', estado: '', cep: '',
  titulo_eleitoral: '', titulo_zona: '', titulo_secao: '',
  cnh_numero: '', cnh_data_emissao: '', cnh_vencimento: '', cnh_estado: '', cnh_categoria: '',
  ctps_numero: '', ctps_categoria: '', ctps_emissor: '', ctps_data_emissao: '',
  funcao: '', cbo: '', tipo_vinculo: 'clt', status: 'ativo', data_admissao: '',
  tipo_salario: 'mensal', salario: '',
  vale_transporte: false, vale_compras: '', cafe_manha_diario: '',
  banco_nome: '', banco_agencia: '', banco_tipo_conta: '', banco_numero_conta: '', banco_pix: '',
  dependentes: [],
  equipe_id: '', equipe_nome: '', obra_id: '', obra_nome: '',
  documentos: [], observacoes: ''
};

export default function EmployeeForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const employeeId = urlParams.get('id');
  const isEditing = !!employeeId;
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState(EMPTY);

  const { data: employee, isLoading: loadingEmployee } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => base44.entities.Employee.filter({ id: employeeId }),
    enabled: isEditing
  });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });

  useEffect(() => {
    if (employee?.[0]) {
      setFormData({ ...EMPTY, ...employee[0], salario: employee[0].salario || '' });
    }
  }, [employee]);

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data,
        salario: data.salario ? parseFloat(data.salario) : null,
        vale_compras: data.vale_compras ? parseFloat(data.vale_compras) : 0,
        cafe_manha_diario: data.cafe_manha_diario ? parseFloat(data.cafe_manha_diario) : 0
      };
      return isEditing
        ? base44.entities.Employee.update(employeeId, payload)
        : base44.entities.Employee.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      window.location.href = createPageUrl('Employees');
    },
    onError: () => toast.error('Erro ao salvar colaborador')
  });

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const formatCPF = (v) => v.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').slice(0, 14);

  // ─── Dependentes ────────────────────────────────────────────────────────────
  const addDependente = () => setFormData(prev => ({
    ...prev, dependentes: [...(prev.dependentes || []), { nome: '', data_nascimento: '', cpf: '' }]
  }));
  const removeDependente = (i) => setFormData(prev => ({
    ...prev, dependentes: prev.dependentes.filter((_, idx) => idx !== i)
  }));
  const setDep = (i, field, value) => setFormData(prev => ({
    ...prev,
    dependentes: prev.dependentes.map((d, idx) => idx === i ? { ...d, [field]: value } : d)
  }));

  // ─── Upload de documentos em lote ──────────────────────────────────────────
  const handleFilesUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    const newDocs = [...(formData.documentos || [])];
    for (const file of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        newDocs.push({ nome: file.name, url: file_url, data_upload: new Date().toISOString() });
      } catch {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }
    set('documentos', newDocs);
    setUploading(false);
    toast.success(`${files.length} documento(s) enviado(s)`);
    e.target.value = '';
  };

  const removeDoc = (i) => setFormData(prev => ({
    ...prev, documentos: prev.documentos.filter((_, idx) => idx !== i)
  }));

  if (isEditing && loadingEmployee) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title={isEditing ? 'Editar Colaborador' : 'Novo Colaborador'}
        subtitle={isEditing ? formData.nome_completo : 'Preencha os dados do colaborador'}
        icon={Users}
        backUrl={createPageUrl('Employees')}
      />

      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="space-y-4">

        {/* ── 1. DADOS PESSOAIS ─────────────────────────────────────────────── */}
        <Section title="1. Dados Pessoais">
          <Field label="Nome Completo *" className="col-span-2 lg:col-span-3">
            <Input value={formData.nome_completo} onChange={e => set('nome_completo', e.target.value)} required />
          </Field>
          <Field label="CPF *">
            <Input value={formData.cpf} onChange={e => set('cpf', formatCPF(e.target.value))} required maxLength={14} />
          </Field>
          <Field label="PIS">
            <Input value={formData.pis} onChange={e => set('pis', e.target.value)} />
          </Field>
          <Field label="Data de Nascimento">
            <Input type="date" value={formData.data_nascimento} onChange={e => set('data_nascimento', e.target.value)} />
          </Field>
          <Field label="Naturalidade (Cidade)">
            <Input value={formData.naturalidade_cidade} onChange={e => set('naturalidade_cidade', e.target.value)} />
          </Field>
          <Field label="Naturalidade (UF)">
            <Input value={formData.naturalidade_estado} onChange={e => set('naturalidade_estado', e.target.value)} maxLength={2} />
          </Field>
          <Field label="Raça">
            <Select value={formData.raca} onValueChange={v => set('raca', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="branca">Branca</SelectItem>
                <SelectItem value="parda">Parda</SelectItem>
                <SelectItem value="preta">Preta</SelectItem>
                <SelectItem value="amarela">Amarela</SelectItem>
                <SelectItem value="indigena">Indígena</SelectItem>
                <SelectItem value="nao_declarado">Não Declarado</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Grau de Instrução">
            <Select value={formData.grau_instrucao} onValueChange={v => set('grau_instrucao', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fundamental_incompleto">Fund. Incompleto</SelectItem>
                <SelectItem value="fundamental_completo">Fund. Completo</SelectItem>
                <SelectItem value="medio_incompleto">Médio Incompleto</SelectItem>
                <SelectItem value="medio_completo">Médio Completo</SelectItem>
                <SelectItem value="tecnico">Técnico</SelectItem>
                <SelectItem value="superior_incompleto">Superior Incompleto</SelectItem>
                <SelectItem value="superior_completo">Superior Completo</SelectItem>
                <SelectItem value="pos_graduacao">Pós-Graduação</SelectItem>
                <SelectItem value="mestrado">Mestrado</SelectItem>
                <SelectItem value="doutorado">Doutorado</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="PcD">
            <Select value={formData.pcd ? 'sim' : 'nao'} onValueChange={v => set('pcd', v === 'sim')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nao">Não</SelectItem>
                <SelectItem value="sim">Sim</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {formData.pcd && (
            <Field label="Descrição PcD" className="col-span-2">
              <Input value={formData.pcd_descricao} onChange={e => set('pcd_descricao', e.target.value)} />
            </Field>
          )}
          <Field label="Estado Civil">
            <Select value={formData.estado_civil} onValueChange={v => set('estado_civil', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                <SelectItem value="casado">Casado(a)</SelectItem>
                <SelectItem value="uniao_estavel">União Estável</SelectItem>
                <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                <SelectItem value="separado">Separado(a)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Telefone">
            <Input value={formData.telefone} onChange={e => set('telefone', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={formData.email} onChange={e => set('email', e.target.value)} />
          </Field>
          <Field label="Nome do Pai" className="col-span-2">
            <Input value={formData.nome_pai} onChange={e => set('nome_pai', e.target.value)} />
          </Field>
          <Field label="Nome da Mãe" className="col-span-2">
            <Input value={formData.nome_mae} onChange={e => set('nome_mae', e.target.value)} />
          </Field>
        </Section>

        {/* ── CÔNJUGE (só se casado / união estável) ───────────────────────── */}
        {(formData.estado_civil === 'casado' || formData.estado_civil === 'uniao_estavel') && (
          <Section title="2. Dados do Cônjuge">
            <Field label="Nome Completo" className="col-span-2 lg:col-span-3">
              <Input value={formData.conjuge_nome} onChange={e => set('conjuge_nome', e.target.value)} />
            </Field>
            <Field label="Data de Nascimento">
              <Input type="date" value={formData.conjuge_data_nascimento} onChange={e => set('conjuge_data_nascimento', e.target.value)} />
            </Field>
            <Field label="CPF">
              <Input value={formData.conjuge_cpf} onChange={e => set('conjuge_cpf', formatCPF(e.target.value))} maxLength={14} />
            </Field>
          </Section>
        )}

        {/* ── 3. ENDEREÇO ──────────────────────────────────────────────────── */}
        <Section title="3. Endereço">
          <Field label="Endereço" className="col-span-2 lg:col-span-3">
            <Input value={formData.endereco} onChange={e => set('endereco', e.target.value)} />
          </Field>
          <Field label="Cidade">
            <Input value={formData.cidade} onChange={e => set('cidade', e.target.value)} />
          </Field>
          <Field label="UF">
            <Input value={formData.estado} onChange={e => set('estado', e.target.value)} maxLength={2} />
          </Field>
          <Field label="CEP">
            <Input value={formData.cep} onChange={e => set('cep', e.target.value)} />
          </Field>
        </Section>

        {/* ── 4. DOCUMENTOS PESSOAIS ───────────────────────────────────────── */}
        <Section title="4. Documentos Pessoais">
          <Field label="RG">
            <Input value={formData.rg} onChange={e => set('rg', e.target.value)} />
          </Field>
          <Field label="Data Emissão RG">
            <Input type="date" value={formData.rg_data_emissao} onChange={e => set('rg_data_emissao', e.target.value)} />
          </Field>
          <Field label="Órgão Emissor RG">
            <Input value={formData.rg_orgao_emissor} onChange={e => set('rg_orgao_emissor', e.target.value)} />
          </Field>
          <Field label="Título Eleitoral">
            <Input value={formData.titulo_eleitoral} onChange={e => set('titulo_eleitoral', e.target.value)} />
          </Field>
          <Field label="Zona">
            <Input value={formData.titulo_zona} onChange={e => set('titulo_zona', e.target.value)} />
          </Field>
          <Field label="Seção">
            <Input value={formData.titulo_secao} onChange={e => set('titulo_secao', e.target.value)} />
          </Field>
        </Section>

        {/* ── 5. CNH ───────────────────────────────────────────────────────── */}
        <Section title="5. CNH">
          <Field label="Número CNH">
            <Input value={formData.cnh_numero} onChange={e => set('cnh_numero', e.target.value)} />
          </Field>
          <Field label="Data Emissão">
            <Input type="date" value={formData.cnh_data_emissao} onChange={e => set('cnh_data_emissao', e.target.value)} />
          </Field>
          <Field label="Vencimento">
            <Input type="date" value={formData.cnh_vencimento} onChange={e => set('cnh_vencimento', e.target.value)} />
          </Field>
          <Field label="UF CNH">
            <Input value={formData.cnh_estado} onChange={e => set('cnh_estado', e.target.value)} maxLength={2} />
          </Field>
          <Field label="Categoria">
            <Input value={formData.cnh_categoria} onChange={e => set('cnh_categoria', e.target.value)} placeholder="A, B, AB..." />
          </Field>
        </Section>

        {/* ── 6. CTPS ──────────────────────────────────────────────────────── */}
        <Section title="6. CTPS">
          <Field label="Número CTPS">
            <Input value={formData.ctps_numero} onChange={e => set('ctps_numero', e.target.value)} />
          </Field>
          <Field label="Categoria CTPS">
            <Input value={formData.ctps_categoria} onChange={e => set('ctps_categoria', e.target.value)} />
          </Field>
          <Field label="Emissor">
            <Input value={formData.ctps_emissor} onChange={e => set('ctps_emissor', e.target.value)} />
          </Field>
          <Field label="Data Emissão">
            <Input type="date" value={formData.ctps_data_emissao} onChange={e => set('ctps_data_emissao', e.target.value)} />
          </Field>
        </Section>

        {/* ── 7. DADOS PROFISSIONAIS ───────────────────────────────────────── */}
        <Section title="7. Dados Profissionais">
          <Field label="Função/Cargo *" className="col-span-2">
            <Input value={formData.funcao} onChange={e => set('funcao', e.target.value)} required />
          </Field>
          <Field label="CBO">
            <Input value={formData.cbo} onChange={e => set('cbo', e.target.value)} placeholder="Ex: 7171-05" />
          </Field>
          <Field label="Tipo de Vínculo *">
            <Select value={formData.tipo_vinculo} onValueChange={v => set('tipo_vinculo', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clt">CLT</SelectItem>
                <SelectItem value="pj">PJ</SelectItem>
                <SelectItem value="terceirizado">Terceirizado</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status *">
            <Select value={formData.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Data de Admissão">
            <Input type="date" value={formData.data_admissao} onChange={e => set('data_admissao', e.target.value)} />
          </Field>
          <Field label="Tipo de Salário">
            <Select value={formData.tipo_salario} onValueChange={v => set('tipo_salario', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="hora">Por Hora</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={formData.tipo_salario === 'hora' ? 'Valor/Hora (R$)' : 'Salário Mensal (R$)'}>
            <Input type="number" step="0.01" value={formData.salario} onChange={e => set('salario', e.target.value)} />
          </Field>
          <Field label="Equipe">
            <Select value={formData.equipe_id || ''} onValueChange={v => {
              const t = teams.find(x => x.id === v);
              setFormData(p => ({ ...p, equipe_id: v, equipe_nome: t?.nome || '' }));
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Obra">
            <Select value={formData.obra_id || ''} onValueChange={v => {
              const p = projects.find(x => x.id === v);
              setFormData(prev => ({ ...prev, obra_id: v, obra_nome: p?.nome || '' }));
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        {/* ── 8. BENEFÍCIOS ────────────────────────────────────────────────── */}
        <Section title="8. Benefícios">
          <Field label="Vale Transporte">
            <Select value={formData.vale_transporte ? 'sim' : 'nao'} onValueChange={v => set('vale_transporte', v === 'sim')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nao">Não</SelectItem>
                <SelectItem value="sim">Sim</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Vale Compras (R$/mês)">
            <Input type="number" step="0.01" value={formData.vale_compras} onChange={e => set('vale_compras', e.target.value)} />
          </Field>
          <Field label="Café da Manhã (R$/dia útil)">
            <Input type="number" step="0.01" value={formData.cafe_manha_diario} onChange={e => set('cafe_manha_diario', e.target.value)} />
          </Field>
        </Section>

        {/* ── 9. DADOS BANCÁRIOS ───────────────────────────────────────────── */}
        <Section title="9. Dados Bancários">
          <Field label="Banco" className="col-span-2">
            <Input value={formData.banco_nome} onChange={e => set('banco_nome', e.target.value)} placeholder="Ex: Banco do Brasil" />
          </Field>
          <Field label="Agência">
            <Input value={formData.banco_agencia} onChange={e => set('banco_agencia', e.target.value)} />
          </Field>
          <Field label="Tipo de Conta">
            <Select value={formData.banco_tipo_conta} onValueChange={v => set('banco_tipo_conta', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="corrente">Corrente</SelectItem>
                <SelectItem value="poupanca">Poupança</SelectItem>
                <SelectItem value="salario">Salário</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Número da Conta">
            <Input value={formData.banco_numero_conta} onChange={e => set('banco_numero_conta', e.target.value)} />
          </Field>
          <Field label="PIX" className="col-span-2">
            <Input value={formData.banco_pix} onChange={e => set('banco_pix', e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" />
          </Field>
        </Section>

        {/* ── 10. DEPENDENTES ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="py-3 px-5 bg-slate-50 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider">10. Dependentes (Filhos)</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={addDependente}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          </CardHeader>
          <CardContent className="pt-3 pb-4 px-5">
            {(formData.dependentes || []).length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">Nenhum dependente cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-3 py-2 text-left border font-semibold text-slate-600">#</th>
                      <th className="px-3 py-2 text-left border font-semibold text-slate-600">Nome Completo</th>
                      <th className="px-3 py-2 text-left border font-semibold text-slate-600">Data de Nascimento</th>
                      <th className="px-3 py-2 text-left border font-semibold text-slate-600">CPF</th>
                      <th className="px-3 py-2 border"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.dependentes.map((dep, i) => (
                      <tr key={i} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-1 border text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-2 py-1 border">
                          <Input value={dep.nome} onChange={e => setDep(i, 'nome', e.target.value)} className="h-7 text-xs" placeholder="Nome completo" />
                        </td>
                        <td className="px-2 py-1 border">
                          <Input type="date" value={dep.data_nascimento} onChange={e => setDep(i, 'data_nascimento', e.target.value)} className="h-7 text-xs" />
                        </td>
                        <td className="px-2 py-1 border">
                          <Input value={dep.cpf} onChange={e => setDep(i, 'cpf', formatCPF(e.target.value))} className="h-7 text-xs" maxLength={14} placeholder="000.000.000-00" />
                        </td>
                        <td className="px-2 py-1 border">
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeDependente(i)} className="h-7 w-7 text-red-400">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 11. DOCUMENTOS (UPLOAD EM LOTE) ─────────────────────────────── */}
        <Card>
          <CardHeader className="py-3 px-5 bg-slate-50 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider">11. Documentos</CardTitle>
            <div className="flex gap-2 items-center">
              {uploading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-3 w-3 mr-1" />
                {uploading ? 'Enviando...' : 'Upload em Lote'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFilesUpload}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-3 pb-4 px-5">
            {(formData.documentos || []).length === 0 ? (
              <div
                className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center text-slate-400 cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Clique ou arraste arquivos para enviar</p>
                <p className="text-xs mt-1">PDF, imagens, Word — múltiplos arquivos permitidos</p>
              </div>
            ) : (
              <div className="space-y-2">
                {formData.documentos.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 border rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate">{doc.nome}</a>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeDoc(i)} className="h-7 w-7 text-red-400 flex-shrink-0">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div
                  className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center text-slate-400 text-xs cursor-pointer hover:border-blue-300"
                  onClick={() => fileInputRef.current?.click()}
                >
                  + Adicionar mais documentos
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 12. OBSERVAÇÕES ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="py-3 px-5 bg-slate-50 border-b">
            <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider">12. Observações</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 pb-5 px-5">
            <Textarea value={formData.observacoes} onChange={e => set('observacoes', e.target.value)} rows={3} placeholder="Informações adicionais..." />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => window.location.href = createPageUrl('Employees')}>
            <X className="h-4 w-4 mr-2" /> Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending} className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />
            {mutation.isPending ? 'Salvando...' : 'Salvar Colaborador'}
          </Button>
        </div>
      </form>
    </div>
  );
}