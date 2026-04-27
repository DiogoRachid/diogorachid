import React, { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronsUpDown, Layers, Package, Database, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// Badge de origem
const OrigemBadge = ({ origem }) => {
  if (origem === 'catalogo') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
        <Database className="h-2.5 w-2.5" /> Catálogo
      </span>
    );
  }
  return null;
};

// Badge de tipo
const TipoBadge = ({ tipo }) => {
  if (tipo === 'INSUMO') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
        <Package className="h-2.5 w-2.5" /> Insumo
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
      <Layers className="h-2.5 w-2.5" /> Serviço
    </span>
  );
};

export default function ServiceSelectorWithCatalog({ localServices, localInputs = [], onSelect, selectedIds = [] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [catalogResults, setCatalogResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(null); // id sendo importado
  const debounceRef = useRef(null);

  // Buscar no catálogo mestre quando search muda (debounce 400ms)
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!search || search.length < 2) {
      setCatalogResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const [resServices, resInputs] = await Promise.all([
          base44.functions.invoke('supabaseCatalog', { action: 'searchServices', search, limit: 8 }),
          base44.functions.invoke('supabaseCatalog', { action: 'searchInputs', search, limit: 8 }),
        ]);

        const catalogServices = (resServices.data?.data || []).map(s => ({
          ...s,
          _origem: 'catalogo',
          _tipo: 'SERVICO',
          custo_total: s.custo_total || 0,
          custo_material: s.custo_material || 0,
          custo_mao_obra: s.custo_mao_obra || 0,
        }));

        const catalogInputsRaw = (resInputs.data?.data || []).map(i => ({
          ...i,
          _origem: 'catalogo',
          _tipo: 'INSUMO',
          custo_total: i.valor_unitario || 0,
          custo_material: i.categoria === 'MATERIAL' ? i.valor_unitario : 0,
          custo_mao_obra: i.categoria === 'MAO_OBRA' ? i.valor_unitario : 0,
        }));

        // Filtrar do catálogo o que já existe localmente (pelo código)
        const localCodigosServicos = new Set(localServices.map(s => s.codigo));
        const localCodigosInsumos = new Set(localInputs.map(i => i.codigo));

        const novosServicos = catalogServices.filter(s => !localCodigosServicos.has(s.codigo));
        const novosInsumos = catalogInputsRaw.filter(i => !localCodigosInsumos.has(i.codigo));

        setCatalogResults([...novosServicos, ...novosInsumos]);
      } catch (e) {
        console.error('Erro ao buscar no catálogo:', e);
      }
      setSearching(false);
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [search, open]);

  // Filtrar lista local
  const filteredLocal = React.useMemo(() => {
    const q = search.toLowerCase();

    const matchedServices = localServices
      .filter(s => !q || s.codigo?.toLowerCase().includes(q) || s.descricao?.toLowerCase().includes(q))
      .map(s => ({ ...s, _origem: 'local', _tipo: 'SERVICO', custo_total: s.custo_total || 0 }));

    const matchedInputs = localInputs
      .filter(i => !q || i.codigo?.toLowerCase().includes(q) || i.descricao?.toLowerCase().includes(q))
      .map(i => ({
        ...i,
        _origem: 'local',
        _tipo: 'INSUMO',
        custo_total: i.valor_unitario || 0,
        custo_material: i.categoria === 'MATERIAL' ? i.valor_unitario : 0,
        custo_mao_obra: i.categoria === 'MAO_OBRA' ? i.valor_unitario : 0,
        unidade: i.unidade || 'UN',
      }));

    return [...matchedServices, ...matchedInputs].slice(0, 30);
  }, [search, localServices, localInputs]);

  // Importar do catálogo e adicionar ao orçamento
  const handleImportAndSelect = async (catalogItem) => {
    setImporting(catalogItem.id);
    try {
      if (catalogItem._tipo === 'SERVICO') {
        const res = await base44.functions.invoke('importFromCatalog', {
          action: 'importService',
          masterServiceCodigo: catalogItem.codigo,
        });
        const imported = res.data?.service;
        if (imported) {
          toast.success(`Serviço "${catalogItem.descricao}" importado do catálogo`);
          onSelect(imported, 'SERVICO');
        } else {
          toast.error('Erro ao importar serviço');
        }
      } else {
        const res = await base44.functions.invoke('importFromCatalog', {
          action: 'importInput',
          inputCodigo: catalogItem.codigo,
        });
        const imported = res.data?.input;
        if (imported) {
          toast.success(`Insumo "${catalogItem.descricao}" importado do catálogo`);
          onSelect(imported, 'INSUMO');
        } else {
          toast.error('Erro ao importar insumo');
        }
      }
    } catch (e) {
      toast.error('Erro na importação: ' + e.message);
    }
    setImporting(null);
    setOpen(false);
    setSearch('');
  };

  // Selecionar item local
  const handleSelectLocal = (item) => {
    onSelect(item, item._tipo);
    setOpen(false);
    setSearch('');
  };

  const renderItem = (item, isCatalog = false) => {
    const id = item.id;
    const isSelected = selectedIds.includes(id);
    const isLoading = importing === id;

    return (
      <div
        key={`${isCatalog ? 'cat' : 'loc'}-${id}`}
        className={cn(
          "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 border-b last:border-b-0",
          isSelected && "bg-blue-50",
          isLoading && "opacity-60 pointer-events-none"
        )}
        onClick={() => isCatalog ? handleImportAndSelect(item) : handleSelectLocal(item)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <TipoBadge tipo={item._tipo} />
            {isCatalog && <OrigemBadge origem="catalogo" />}
            <span className="text-xs text-slate-400 font-mono">{item.codigo}</span>
          </div>
          <div className="text-sm font-medium text-slate-800 truncate mt-0.5">{item.descricao}</div>
          <div className="text-xs text-slate-500">{item.unidade || 'UN'} · {fmt(item.custo_total)}</div>
        </div>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-purple-600 flex-shrink-0" />
        ) : isSelected ? (
          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
        ) : null}
      </div>
    );
  };

  const hasLocal = filteredLocal.length > 0;
  const hasCatalog = catalogResults.length > 0;
  const isEmpty = !hasLocal && !hasCatalog && !searching;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[420px] justify-between h-8 bg-white border-slate-200 text-slate-500 font-normal"
        >
          Adicionar serviço ou insumo...
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[520px] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Buscar por código ou descrição..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8"
            autoFocus
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {/* Lista local */}
          {hasLocal && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase bg-slate-50 sticky top-0">
                Lista Interna ({filteredLocal.length})
              </div>
              {filteredLocal.map(item => renderItem(item, false))}
            </div>
          )}

          {/* Separador */}
          {hasLocal && (hasCatalog || searching) && (
            <div className="border-t" />
          )}

          {/* Catálogo mestre */}
          {searching && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando no Catálogo Mestre...
            </div>
          )}

          {!searching && hasCatalog && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold text-purple-600 uppercase bg-purple-50 sticky top-0 flex items-center gap-1">
                <Database className="h-3 w-3" /> Catálogo Mestre ({catalogResults.length}) — clique para importar
              </div>
              {catalogResults.map(item => renderItem(item, true))}
            </div>
          )}

          {/* Vazio */}
          {isEmpty && !search && (
            <div className="px-3 py-4 text-sm text-slate-400 text-center">
              Digite para buscar serviços e insumos...
            </div>
          )}
          {isEmpty && search && search.length >= 2 && (
            <div className="px-3 py-4 text-sm text-slate-400 text-center">
              Nenhum resultado encontrado.
            </div>
          )}
          {isEmpty && search && search.length < 2 && (
            <div className="px-3 py-4 text-sm text-slate-400 text-center">
              Continue digitando para buscar...
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}