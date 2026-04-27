import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Database, Search, Download, Package, Layers, Loader2,
  Check, AlertCircle, ChevronDown, ChevronRight, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

function categoriaColor(cat) {
  return cat === 'MAO_OBRA' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
}

function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ---------- Linha de Insumo ----------
function InputRow({ item, onImport, importing }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-slate-400">{item.codigo}</span>
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{item.descricao}</span>
          <Badge className={`text-xs ${categoriaColor(item.categoria)}`}>{item.categoria}</Badge>
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{item.unidade} · {fmt(item.valor_unitario)} · {item.data_base}</div>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={importing === item.codigo}
        onClick={() => onImport(item)}
        className="flex-shrink-0 gap-1.5"
      >
        {importing === item.codigo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Importar
      </Button>
    </div>
  );
}

// ---------- Linha de Serviço ----------
function ServiceRow({ item, onImport, importing, onPreview }) {
  const [expanded, setExpanded] = useState(false);
  const [previewItems, setPreviewItems] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handleExpand = async () => {
    if (!expanded && !previewItems) {
      setLoadingPreview(true);
      try {
        const res = await base44.functions.invoke('supabaseCatalog', {
          action: 'getServiceItems',
          service_codigo: item.codigo
        });
        setPreviewItems(res.data?.data || []);
      } catch (e) {
        toast.error('Erro ao carregar composição: ' + e.message);
      }
      setLoadingPreview(false);
    }
    setExpanded(v => !v);
  };

  return (
    <div className="border-b last:border-0">
      <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <button onClick={handleExpand} className="flex-shrink-0 text-slate-400 hover:text-slate-600">
          {loadingPreview
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-slate-400">{item.codigo}</span>
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{item.descricao}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {item.unidade} · MAT: {fmt(item.custo_material)} · MO: {fmt(item.custo_mao_obra)} · Total: {fmt(item.custo_total)}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={importing === item.codigo}
          onClick={() => onImport(item)}
          className="flex-shrink-0 gap-1.5"
        >
          {importing === item.codigo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Importar
        </Button>
      </div>

      {expanded && previewItems && (
        <div className="ml-10 mb-2 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
          {previewItems.length === 0
            ? <p className="text-xs text-slate-400 p-3">Nenhum item de composição encontrado.</p>
            : previewItems.map((ci, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-1.5 border-b last:border-0 text-xs">
                <Badge variant="outline" className="text-xs">{ci.tipo_item}</Badge>
                <span className="font-mono text-slate-400">{ci.item_codigo}</span>
                <span className="text-slate-600 dark:text-slate-300 flex-1 truncate">{ci.descricao}</span>
                <span className="text-slate-500">Qtd: {ci.quantidade}</span>
                <span className="text-slate-500">{fmt(ci.custo_total_item)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ---------- Página Principal ----------
export default function CatalogImport() {
  const [tab, setTab] = useState('insumos');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(null);
  const [importedCodes, setImportedCodes] = useState(new Set());

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setResults([]);
    try {
      const action = tab === 'insumos' ? 'searchInputs' : 'searchServices';
      const res = await base44.functions.invoke('supabaseCatalog', { action, search, limit: 100 });
      setResults(res.data?.data || []);
    } catch (e) {
      toast.error('Erro na busca: ' + e.message);
    }
    setLoading(false);
  }, [tab, search]);

  const handleImportInput = async (item) => {
    setImporting(item.codigo);
    try {
      await base44.functions.invoke('importFromCatalog', { action: 'importInput', masterInput: item });
      setImportedCodes(prev => new Set([...prev, item.codigo]));
      toast.success(`Insumo "${item.descricao}" importado com sucesso!`);
    } catch (e) {
      toast.error('Erro ao importar: ' + e.message);
    }
    setImporting(null);
  };

  const handleImportService = async (item) => {
    setImporting(item.codigo);
    try {
      const res = await base44.functions.invoke('importFromCatalog', { action: 'importService', serviceCode: item.codigo });
      setImportedCodes(prev => new Set([...prev, item.codigo]));
      const r = res.data?.result;
      toast.success(`Serviço "${item.descricao}" importado! (${r?.items_imported || 0} itens de composição)`);
    } catch (e) {
      toast.error('Erro ao importar: ' + e.message);
    }
    setImporting(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div>
      <PageHeader
        title="Catálogo Mestre"
        subtitle="Pesquise e importe insumos e serviços do catálogo centralizado"
        icon={Database}
      />

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setResults([]); setSearch(''); }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="insumos">
            <Package className="h-4 w-4 mr-2" />
            Insumos
          </TabsTrigger>
          <TabsTrigger value="servicos">
            <Layers className="h-4 w-4 mr-2" />
            Serviços / Composições
          </TabsTrigger>
        </TabsList>

        {['insumos', 'servicos'].map(t => (
          <TabsContent key={t} value={t}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t === 'insumos' ? 'Buscar Insumos no Catálogo Mestre' : 'Buscar Serviços / Composições no Catálogo Mestre'}
                </CardTitle>
                <CardDescription>
                  {t === 'insumos'
                    ? 'Os insumos importados serão adicionados à sua tabela de Insumos local.'
                    : 'Os serviços importados incluem toda a composição (insumos e sub-serviços) automaticamente.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder={t === 'insumos' ? 'Código ou descrição do insumo...' : 'Código ou descrição do serviço...'}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Buscar
                  </Button>
                </div>

                {/* Resultados */}
                {results.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-800 px-3 py-2 flex items-center justify-between border-b">
                      <span className="text-xs text-slate-500 font-medium">{results.length} resultado(s)</span>
                      {importedCodes.size > 0 && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <Check className="h-3 w-3" /> {importedCodes.size} importado(s) nesta sessão
                        </span>
                      )}
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto">
                      {results.map(item =>
                        t === 'insumos'
                          ? <InputRow
                              key={item.codigo}
                              item={item}
                              onImport={handleImportInput}
                              importing={importing}
                            />
                          : <ServiceRow
                              key={item.codigo}
                              item={item}
                              onImport={handleImportService}
                              importing={importing}
                            />
                      )}
                    </div>
                  </div>
                )}

                {!loading && results.length === 0 && search && (
                  <div className="text-center py-10 text-slate-400">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Nenhum resultado encontrado para "{search}"</p>
                  </div>
                )}

                {!loading && results.length === 0 && !search && (
                  <div className="text-center py-10 text-slate-400">
                    <Database className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Digite um termo e clique em Buscar para pesquisar no catálogo mestre.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}