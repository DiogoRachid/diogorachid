import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, Upload, Trash2, Download, Calendar,
  AlertTriangle, CheckCircle2, Clock, Search, Filter,
  MoreHorizontal, Eye, X, FolderOpen, Tag, ChevronUp, ChevronDown, ChevronsUpDown
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TIPOS = [
  { value: 'certidao', label: 'Certidão' },
  { value: 'balanco', label: 'Balanço' },
  { value: 'declaracao', label: 'Declaração' },
  { value: 'acervo', label: 'Acervo Técnico' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'alvara', label: 'Alvará' },
  { value: 'outro', label: 'Outro' },
];

const TIPO_LABELS = Object.fromEntries(TIPOS.map(t => [t.value, t.label]));

const TIPO_COLORS = {
  certidao: 'bg-blue-100 text-blue-700',
  balanco: 'bg-emerald-100 text-emerald-700',
  declaracao: 'bg-violet-100 text-violet-700',
  acervo: 'bg-amber-100 text-amber-700',
  contrato: 'bg-orange-100 text-orange-700',
  alvara: 'bg-cyan-100 text-cyan-700',
  outro: 'bg-slate-100 text-slate-700',
};

function getStatus(doc) {
  if (doc.sem_vencimento || !doc.data_vencimento) return 'sem_vencimento';
  const days = differenceInDays(parseISO(doc.data_vencimento), new Date());
  if (days < 0) return 'vencido';
  if (days <= 30) return 'a_vencer';
  return 'valido';
}

function StatusChip({ doc }) {
  const status = getStatus(doc);
  const configs = {
    valido: { label: 'Válido', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    a_vencer: { label: 'A Vencer', cls: 'bg-amber-100 text-amber-700', icon: Clock },
    vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-700', icon: AlertTriangle },
    sem_vencimento: { label: 'Sem Vencimento', cls: 'bg-slate-100 text-slate-600', icon: FileText },
  };
  const c = configs[status];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.cls}`}>
      <Icon className="h-3 w-3" /> {c.label}
    </span>
  );
}

const emptyForm = {
  nome: '', tipo: 'certidao', descricao: '', numero_documento: '',
  orgao_emissor: '', data_emissao: '', data_vencimento: '',
  sem_vencimento: false, observacoes: ''
};

export default function Documents() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list('-created_date', 500)
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['documents'])
  });

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 text-slate-400 inline" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1 text-indigo-500 inline" />
      : <ChevronDown className="h-3 w-3 ml-1 text-indigo-500 inline" />;
  };

  const filtered = useMemo(() => {
    const list = docs.filter(d => {
      const matchSearch = !search ||
        d.nome?.toLowerCase().includes(search.toLowerCase()) ||
        d.orgao_emissor?.toLowerCase().includes(search.toLowerCase()) ||
        d.numero_documento?.toLowerCase().includes(search.toLowerCase());
      const matchTipo = !filterTipo || d.tipo === filterTipo;
      const matchStatus = !filterStatus || getStatus(d) === filterStatus;
      return matchSearch && matchTipo && matchStatus;
    });

    if (!sortCol) return list;

    return [...list].sort((a, b) => {
      let va, vb;
      if (sortCol === 'nome') { va = a.nome || ''; vb = b.nome || ''; }
      else if (sortCol === 'tipo') { va = a.tipo || ''; vb = b.tipo || ''; }
      else if (sortCol === 'emissor') { va = a.orgao_emissor || ''; vb = b.orgao_emissor || ''; }
      else if (sortCol === 'vencimento') {
        va = a.data_vencimento || '9999';
        vb = b.data_vencimento || '9999';
      } else if (sortCol === 'status') {
        const order = { vencido: 0, a_vencer: 1, valido: 2, sem_vencimento: 3 };
        va = order[getStatus(a)] ?? 9;
        vb = order[getStatus(b)] ?? 9;
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const cmp = String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [docs, search, filterTipo, filterStatus, sortCol, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const all = docs.map(d => getStatus(d));
    return {
      total: docs.length,
      validos: all.filter(s => s === 'valido').length,
      aVencer: all.filter(s => s === 'a_vencer').length,
      vencidos: all.filter(s => s === 'vencido').length,
    };
  }, [docs]);

  const openNew = () => {
    setEditingDoc(null);
    setForm(emptyForm);
    setFileToUpload(null);
    setFilePreview(null);
    setShowForm(true);
  };

  const openEdit = (doc) => {
    setEditingDoc(doc);
    setForm({
      nome: doc.nome || '',
      tipo: doc.tipo || 'certidao',
      descricao: doc.descricao || '',
      numero_documento: doc.numero_documento || '',
      orgao_emissor: doc.orgao_emissor || '',
      data_emissao: doc.data_emissao || '',
      data_vencimento: doc.data_vencimento || '',
      sem_vencimento: doc.sem_vencimento || false,
      observacoes: doc.observacoes || '',
    });
    setFileToUpload(null);
    setFilePreview(doc.arquivo_url || null);
    setShowForm(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.includes('pdf')) {
      toast.error('Apenas arquivos PDF são aceitos.');
      return;
    }
    setFileToUpload(file);
    setFilePreview(URL.createObjectURL(file));
    // Auto-preenche nome se vazio
    if (!form.nome) {
      setForm(f => ({ ...f, nome: file.name.replace(/\.pdf$/i, '') }));
    }
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error('Informe o nome do documento.'); return; }
    setSaving(true);
    try {
      let arquivo_url = editingDoc?.arquivo_url || '';
      let arquivo_nome = editingDoc?.arquivo_nome || '';

      if (fileToUpload) {
        setUploading(true);
        const { file_url } = await base44.integrations.Core.UploadFile({ file: fileToUpload });
        arquivo_url = file_url;
        arquivo_nome = fileToUpload.name;
        setUploading(false);
      }

      const payload = { ...form, arquivo_url, arquivo_nome };

      if (editingDoc) {
        await base44.entities.Document.update(editingDoc.id, payload);
        toast.success('Documento atualizado.');
      } else {
        await base44.entities.Document.create(payload);
        toast.success('Documento salvo.');
      }
      queryClient.invalidateQueries(['documents']);
      setShowForm(false);
    } catch (e) {
      toast.error('Erro ao salvar documento.');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este documento?')) return;
    await deleteMut.mutateAsync(id);
    toast.success('Documento excluído.');
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(d => d.id)));
    }
  };

  const handleBulkDownload = async () => {
    const selected = filtered.filter(d => selectedIds.has(d.id) && d.arquivo_url);
    if (selected.length === 0) { toast.error('Nenhum documento com arquivo selecionado.'); return; }
    toast.info(`Iniciando download de ${selected.length} arquivo(s)...`);
    for (const doc of selected) {
      const a = document.createElement('a');
      a.href = doc.arquivo_url;
      a.download = doc.arquivo_nome || doc.nome + '.pdf';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise(r => setTimeout(r, 400));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Excluir ${selectedIds.size} documento(s) selecionado(s)?`)) return;
    for (const id of selectedIds) {
      await base44.entities.Document.delete(id);
    }
    queryClient.invalidateQueries(['documents']);
    setSelectedIds(new Set());
    toast.success('Documentos excluídos.');
  };

  const diasRestantes = (doc) => {
    if (!doc.data_vencimento || doc.sem_vencimento) return null;
    return differenceInDays(parseISO(doc.data_vencimento), new Date());
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center">
          <FolderOpen className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documentos</h1>
          <p className="text-slate-500 text-sm">Certidões, balanços, declarações e acervos técnicos</p>
        </div>
        <div className="ml-auto">
          <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" /> Novo Documento
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-xs text-slate-500 mt-1">Total</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.validos}</p>
            <p className="text-xs text-slate-500 mt-1">Válidos</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.aVencer}</p>
            <p className="text-xs text-slate-500 mt-1">A Vencer (30d)</p>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.vencidos}</p>
            <p className="text-xs text-slate-500 mt-1">Vencidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, emissor, número..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Todos os tipos</SelectItem>
            {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Todos os status</SelectItem>
            <SelectItem value="valido">Válido</SelectItem>
            <SelectItem value="a_vencer">A Vencer</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="sem_vencimento">Sem Vencimento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
          <span className="text-sm font-medium text-indigo-700">{selectedIds.size} selecionado(s)</span>
          <Button size="sm" variant="outline" onClick={handleBulkDownload} className="border-indigo-300 text-indigo-700 hover:bg-indigo-100">
            <Download className="h-4 w-4 mr-1" /> Baixar Selecionados
          </Button>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir Selecionados
          </Button>
          <button className="ml-auto text-slate-400 hover:text-slate-600" onClick={() => setSelectedIds(new Set())}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer select-none" onClick={() => handleSort('nome')}>Documento<SortIcon col="nome" /></th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 hidden md:table-cell cursor-pointer select-none" onClick={() => handleSort('tipo')}>Tipo<SortIcon col="tipo" /></th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 hidden lg:table-cell cursor-pointer select-none" onClick={() => handleSort('emissor')}>Emissor<SortIcon col="emissor" /></th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 hidden sm:table-cell cursor-pointer select-none" onClick={() => handleSort('vencimento')}>Vencimento<SortIcon col="vencimento" /></th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer select-none" onClick={() => handleSort('status')}>Status<SortIcon col="status" /></th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Nenhum documento encontrado
                  </td>
                </tr>
              ) : filtered.map(doc => {
                const dias = diasRestantes(doc);
                const status = getStatus(doc);
                return (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(doc.id)}
                        onCheckedChange={() => toggleSelect(doc.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-slate-900">{doc.nome}</p>
                          {doc.numero_documento && (
                            <p className="text-xs text-slate-400">{doc.numero_documento}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_COLORS[doc.tipo] || TIPO_COLORS.outro}`}>
                        {TIPO_LABELS[doc.tipo] || doc.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-600 text-xs">{doc.orgao_emissor || '—'}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {doc.sem_vencimento || !doc.data_vencimento ? (
                        <span className="text-xs text-slate-400">Sem vencimento</span>
                      ) : (
                        <div>
                          <p className="text-xs font-medium">{format(parseISO(doc.data_vencimento), 'dd/MM/yyyy')}</p>
                          {dias !== null && (
                            <p className={`text-xs ${dias < 0 ? 'text-red-500' : dias <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                              {dias < 0 ? `Venceu há ${Math.abs(dias)}d` : `${dias}d restantes`}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip doc={doc} />
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {doc.arquivo_url && (
                            <DropdownMenuItem onClick={() => window.open(doc.arquivo_url, '_blank')}>
                              <Eye className="h-4 w-4 mr-2" /> Visualizar
                            </DropdownMenuItem>
                          )}
                          {doc.arquivo_url && (
                            <DropdownMenuItem onClick={() => {
                              const a = document.createElement('a');
                              a.href = doc.arquivo_url;
                              a.download = doc.arquivo_nome || doc.nome + '.pdf';
                              a.target = '_blank';
                              a.click();
                            }}>
                              <Download className="h-4 w-4 mr-2" /> Baixar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openEdit(doc)}>
                            <FileText className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(doc.id)} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDoc ? 'Editar Documento' : 'Novo Documento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Upload */}
            <div>
              <Label className="mb-2 block">Arquivo PDF</Label>
              {filePreview ? (
                <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                  <FileText className="h-8 w-8 text-indigo-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {fileToUpload?.name || editingDoc?.arquivo_nome || 'Arquivo existente'}
                    </p>
                    {fileToUpload && <p className="text-xs text-slate-500">{(fileToUpload.size / 1024).toFixed(0)} KB</p>}
                  </div>
                  <div className="flex gap-2">
                    {editingDoc?.arquivo_url && !fileToUpload && (
                      <Button size="sm" variant="ghost" onClick={() => window.open(filePreview, '_blank')}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => { setFileToUpload(null); setFilePreview(editingDoc?.arquivo_url || null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-6 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                  <Upload className="h-8 w-8 text-slate-400" />
                  <span className="text-sm text-slate-500">Clique para selecionar PDF</span>
                  <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileChange} />
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome do Documento *</Label>
                <Input className="mt-1" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Certidão Negativa Federal" />
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nº do Documento</Label>
                <Input className="mt-1" value={form.numero_documento} onChange={e => setForm(f => ({ ...f, numero_documento: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Órgão Emissor</Label>
                <Input className="mt-1" value={form.orgao_emissor} onChange={e => setForm(f => ({ ...f, orgao_emissor: e.target.value }))} placeholder="Ex: Receita Federal" />
              </div>
              <div>
                <Label>Data de Emissão</Label>
                <Input type="date" className="mt-1" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))} />
              </div>
              <div>
                <Label>Data de Vencimento</Label>
                <Input type="date" className="mt-1" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} disabled={form.sem_vencimento} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Checkbox
                  id="sem_venc"
                  checked={form.sem_vencimento}
                  onCheckedChange={v => setForm(f => ({ ...f, sem_vencimento: !!v, data_vencimento: v ? '' : f.data_vencimento }))}
                />
                <label htmlFor="sem_venc" className="text-sm text-slate-700 cursor-pointer">Documento sem prazo de vencimento</label>
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <textarea
                  className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  rows={2}
                  value={form.observacoes}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {uploading ? 'Enviando arquivo...' : saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}