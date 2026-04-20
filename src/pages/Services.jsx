import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Layers, MoreHorizontal, Pencil, Trash2, RefreshCw, Calendar, X, AlertCircle, DollarSign, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import * as Engine from '@/components/logic/CompositionEngine';
import PageHeader from '@/components/ui/PageHeader';
import SearchFilter from '@/components/shared/SearchFilter';
import DataTable from '@/components/shared/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import RecalcProgressPanel from '@/components/services/RecalcProgressPanel';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Services() {
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [recalculating, setRecalculating] = useState(false);
  const [recalcItems, setRecalcItems] = useState([]);
  const [recalcCurrent, setRecalcCurrent] = useState(0);
  const [recalcStartTime, setRecalcStartTime] = useState(null);
  const [dataBaseFiltro, setDataBaseFiltro] = useState('');
  const [semDataBase, setSemDataBase] = useState(false);
  const [showRecalcDialog, setShowRecalcDialog] = useState(false);
  const [recalcDialogIds, setRecalcDialogIds] = useState([]);
  const [recalcDataBase, setRecalcDataBase] = useState('');
  const [recalcDialogLabel, setRecalcDialogLabel] = useState('');

  const { data: services = [], isLoading, refetch } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const limit = 1000;
      let all = [];
      let skip = 0;
      while (true) {
        const batch = await base44.entities.Service.list('created_date', limit, skip);
        all = all.concat(batch);
        if (batch.length < limit) break;
        skip += limit;
      }
      return all;
    }
  });

  const { data: inputs = [] } = useQuery({
    queryKey: ['inputs-databases'],
    queryFn: async () => {
      const limit = 1000;
      let all = [];
      let skip = 0;
      while (true) {
        const batch = await base44.entities.Input.list('created_date', limit, skip);
        all = all.concat(batch);
        if (batch.length < limit) break;
        skip += limit;
      }
      return all;
    }
  });

  const datasBase = useMemo(() => {
    const set = new Set(services.map(s => s.data_base).filter(Boolean));
    return [...set].sort((a, b) => {
      const [mA, yA] = a.split('/'); const [mB, yB] = b.split('/');
      return parseInt(yB) - parseInt(yA) || parseInt(mB) - parseInt(mA);
    });
  }, [services]);

  // Datas base disponíveis dos insumos (para o dialog de recalcular)
  const datasBaseInsumos = useMemo(() => {
    const set = new Set(inputs.map(i => i.data_base).filter(Boolean));
    const sorted = [...set].sort((a, b) => {
      const [mA, yA] = a.split('/'); const [mB, yB] = b.split('/');
      return parseInt(yB) - parseInt(yA) || parseInt(mB) - parseInt(mA);
    });
    return sorted;
  }, [inputs]);

  // Data base mais recente dos serviços (para comparação)
  const dataBaseMaisRecente = useMemo(() => {
    if (datasBase.length === 0) return null;
    return datasBase[0]; // já ordenado desc
  }, [datasBase]);

  const filtered = useMemo(() => {
    let result = services.filter(s => {
      const matchSearch = !search || s.descricao?.toLowerCase().includes(search.toLowerCase()) || s.codigo?.toLowerCase().includes(search.toLowerCase());
      const matchDataBase = !dataBaseFiltro || s.data_base === dataBaseFiltro;
      const matchSemDataBase = !semDataBase || !s.data_base;
      return matchSearch && matchDataBase && matchSemDataBase;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [services, search, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)));
    }
  };

  const toggleSelectOne = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.size} serviços selecionados?`)) return;
    try {
      const ids = Array.from(selectedIds);
      for (let i = 0; i < ids.length; i+=50) {
        await Promise.all(ids.slice(i, i+50).map(id => base44.entities.Service.delete(id)));
      }
      toast.success(`${ids.length} serviços excluídos.`);
      setSelectedIds(new Set());
      refetch();
    } catch(e) {
      toast.error("Erro ao excluir serviços.");
      console.error(e);
    }
  };

  const runRecalc = async (ids) => {
    const itemsList = ids.map(id => services.find(s => s.id === id)).filter(Boolean);
    setRecalcItems(itemsList);
    setRecalcCurrent(0);
    setRecalcStartTime(Date.now());
    setRecalculating(true);

    Engine.clearCache();
    await Engine.recalculateMultipleServices(ids, (current) => {
      setRecalcCurrent(current);
    });

    refetch();
    setRecalculating(false);
    setRecalcItems([]);
    setRecalcCurrent(0);
    setSelectedIds(new Set());
    toast.success(`${ids.length} serviços recalculados com sucesso!`);
  };

  const handleRecalculateSelected = () => {
    if (selectedIds.size === 0) { toast.error('Selecione ao menos um serviço'); return; }
    runRecalc(Array.from(selectedIds));
  };

  const parseDataBase = (str) => {
    if (!str) return null;
    const [m, y] = str.split('/');
    return new Date(parseInt(y), parseInt(m) - 1, 1);
  };

  const openRecalcDialog = (ids, label = '') => {
    setRecalcDialogIds(ids);
    setRecalcDialogLabel(label);
    setRecalcDataBase(datasBaseInsumos[0] || '');
    setShowRecalcDialog(true);
  };

  const handleRecalcZero = () => {
    const ids = services.filter(s => !s.custo_total || s.custo_total === 0).map(s => s.id);
    if (ids.length === 0) { toast.info('Nenhum serviço com valor R$ 0,00.'); return; }
    openRecalcDialog(ids, `${ids.length} serviços com valor R$ 0,00`);
  };

  const handleRecalcSemDataBase = () => {
    const ids = services.filter(s => !s.data_base).map(s => s.id);
    if (ids.length === 0) { toast.info('Nenhum serviço sem data base.'); return; }
    openRecalcDialog(ids, `${ids.length} serviços sem data base`);
  };

  const handleRecalcDesatualizados = async () => {
    if (!dataBaseMaisRecente) { toast.info('Nenhuma data base encontrada nos serviços.'); return; }
    const maisRecente = parseDataBase(dataBaseMaisRecente);
    
    // Primeira passagem
    let ids = services.filter(s => {
      if (!s.data_base) return true; // sem data base também entra
      const d = parseDataBase(s.data_base);
      return d < maisRecente;
    }).map(s => s.id);

    if (ids.length === 0) { toast.info('Todos os serviços já estão na data base mais recente.'); return; }
    openRecalcDialog(ids, `${ids.length} serviços com data base anterior a ${dataBaseMaisRecente} (rodará até zerar)`);
  };

  const confirmRecalc = async () => {
    setShowRecalcDialog(false);
    const isDesatualizados = recalcDialogLabel.includes('anterior a');

    if (isDesatualizados && dataBaseMaisRecente) {
      // Rodar em múltiplas passagens até não sobrar nenhum desatualizado
      const maisRecente = parseDataBase(dataBaseMaisRecente);
      let rodada = 1;
      let currentServices = services;
      
      while (true) {
        const pendentes = currentServices.filter(s => {
          if (!s.data_base) return true;
          return parseDataBase(s.data_base) < maisRecente;
        }).map(s => s.id);
        
        if (pendentes.length === 0) break;
        toast.info(`Rodada ${rodada}: recalculando ${pendentes.length} serviços...`);
        await runRecalc(pendentes);
        rodada++;
        
        // Recarregar lista atualizada do backend
        const fresh = await base44.entities.Service.list('created_date', 5000, 0);
        currentServices = fresh;
        
        if (rodada > 5) break; // segurança máxima
      }
      toast.success(`Concluído após ${rodada - 1} rodada(s). Todos os serviços atualizados!`);
    } else {
      runRecalc(recalcDialogIds);
    }
  };

  const columns = [
    {
      header: (
        <Checkbox 
          checked={filtered.length > 0 && selectedIds.size === filtered.length}
          onCheckedChange={toggleSelectAll}
          aria-label="Select all"
        />
      ),
      className: 'w-10',
      render: (row) => (
        <Checkbox 
          checked={selectedIds.has(row.id)}
          onCheckedChange={() => toggleSelectOne(row.id)}
          aria-label="Select row"
        />
      )
    },
    { header: 'Código', accessor: 'codigo', className: 'w-24 font-mono text-xs', sortable: true },
    { header: 'Descrição', accessor: 'descricao', sortable: true },
    { header: 'Unidade', accessor: 'unidade', className: 'w-16', sortable: true },
    { header: 'Data Base', accessor: 'data_base', className: 'w-24 text-xs', sortable: true },
    { 
      header: 'Material', 
      accessor: 'custo_material', 
      className: 'text-right',
      sortable: true,
      render: r => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.custo_material || 0)
    },
    { 
      header: 'Mão de Obra', 
      accessor: 'custo_mao_obra', 
      className: 'text-right',
      sortable: true,
      render: r => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.custo_mao_obra || 0)
    },
    { 
      header: 'Total', 
      accessor: 'custo_total', 
      className: 'text-right font-bold',
      sortable: true,
      render: r => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.custo_total || 0)
    },
    {
      header: '',
      className: 'w-12',
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => window.location.href = createPageUrl(`ServiceEditor?id=${row.id}`)}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar Composição
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={async () => {
                if(confirm('Excluir serviço?')) {
                  await base44.entities.Service.delete(row.id);
                  refetch();
                }
              }} 
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  return (
    <div>
      <PageHeader 
        title="Serviços" 
        subtitle="Banco de composições" 
        icon={Layers}
        actionLabel="Novo Serviço"
        onAction={() => window.location.href = createPageUrl('ServiceEditor')}
      />

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <SearchFilter 
            searchValue={search} 
            onSearchChange={setSearch} 
            placeholder="Buscar serviço..." 
          />
          <div className="flex flex-wrap gap-2 items-center">
            {/* Filtro por data base */}
            {datasBase.length > 0 && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                <Select value={dataBaseFiltro} onValueChange={(v) => { setDataBaseFiltro(v); setSemDataBase(false); }}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Todas as datas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todas as datas</SelectItem>
                    {datasBase.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Filtro sem data base */}
            <Button
              size="sm"
              variant={semDataBase ? 'default' : 'outline'}
              onClick={() => { setSemDataBase(!semDataBase); setDataBaseFiltro(''); }}
              className={semDataBase ? 'bg-amber-600 hover:bg-amber-700' : ''}
            >
              <AlertCircle className="h-4 w-4 mr-1" />
              Sem data base
              {!semDataBase && services.filter(s => !s.data_base).length > 0 && (
                <span className="ml-1 bg-amber-100 text-amber-700 text-xs px-1.5 rounded-full">
                  {services.filter(s => !s.data_base).length}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Linha de ações */}
        <div className="flex flex-wrap gap-2 items-center">
          {selectedIds.size > 0 ? (
            <>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Excluir ({selectedIds.size})</span>
              </Button>
              <Button
                size="sm"
                onClick={handleRecalculateSelected}
                disabled={recalculating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className={`h-4 w-4 sm:mr-2 ${recalculating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Recalcular ({selectedIds.size})</span>
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => openRecalcDialog(services.map(s => s.id), `${services.length} serviços`)} disabled={recalculating}>
                <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
                Recalcular Todos
              </Button>
              <Button size="sm" variant="outline" onClick={handleRecalcZero} disabled={recalculating} className="border-orange-300 text-orange-700 hover:bg-orange-50">
                <DollarSign className="h-4 w-4 mr-1" />
                Recalcular Valor R$ 0
                <span className="ml-1 text-xs text-orange-500">({services.filter(s => !s.custo_total || s.custo_total === 0).length})</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleRecalcSemDataBase} disabled={recalculating} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                <AlertCircle className="h-4 w-4 mr-1" />
                Recalcular Sem Data Base
                <span className="ml-1 text-xs text-amber-500">({services.filter(s => !s.data_base).length})</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleRecalcDesatualizados} disabled={recalculating} className="border-blue-300 text-blue-700 hover:bg-blue-50">
                <Clock className="h-4 w-4 mr-1" />
                Recalcular Desatualizados
                <span className="ml-1 text-xs text-blue-500">
                  ({services.filter(s => { if (!s.data_base || !dataBaseMaisRecente) return true; return parseDataBase(s.data_base) < parseDataBase(dataBaseMaisRecente); }).length})
                </span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Painel de progresso dinâmico */}
      {recalculating && recalcItems.length > 0 && (
        <div className="mb-4">
          <RecalcProgressPanel
            items={recalcItems}
            current={recalcCurrent}
            total={recalcItems.length}
            startTime={recalcStartTime}
          />
        </div>
      )}

      <DataTable
        columns={columns} 
        data={filtered} 
        isLoading={isLoading}
        onSort={handleSort}
        sortColumn={sortConfig.key}
        sortDirection={sortConfig.direction}
        emptyComponent={
          <EmptyState 
            title="Nenhum serviço" 
            description="Cadastre composições." 
            actionLabel="Novo" 
            onAction={() => window.location.href = createPageUrl('ServiceEditor')} 
          />
        } 
      />

      {/* Dialog de confirmação do Recalcular Todos */}
      <Dialog open={showRecalcDialog} onOpenChange={setShowRecalcDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recalcular {recalcDialogLabel || `${recalcDialogIds.length} serviços`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600">
              Os serviços serão recalculados usando os <strong>valores atuais dos insumos</strong>.
            </p>
            {datasBaseInsumos.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Data Base dos Insumos</Label>
                <Select value={recalcDataBase} onValueChange={setRecalcDataBase}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a data base" />
                  </SelectTrigger>
                  <SelectContent>
                    {datasBaseInsumos.map(d => (
                      <SelectItem key={d} value={d}>{d}{d === datasBaseInsumos[0] ? ' (mais recente)' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">
                  Esta é a data base identificada nos insumos cadastrados. O recálculo usará os valores atuais.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecalcDialog(false)}>Cancelar</Button>
            <Button onClick={confirmRecalc} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="h-4 w-4 mr-2" />
              Confirmar e Recalcular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}