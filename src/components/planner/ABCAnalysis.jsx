import React, { useMemo, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Package, Layers, FileText, FileSpreadsheet } from 'lucide-react';
import { exportQuotationMapXLSX, exportQuotationMapPDF } from './QuotationMapExporter';
import { toast } from 'sonner';

const COLORS_ABC = {
  A: '#ef4444',
  B: '#f59e0b',
  C: '#10b981'
};


const classifyABC = (items) => {
  // Ordenar por valor decrescente
  const sorted = [...items].sort((a, b) => b.value - a.value);
  
  const totalValue = sorted.reduce((sum, item) => sum + item.value, 0);
  if (totalValue === 0) return sorted.map(item => ({ ...item, classification: 'C', accumulatedPercent: 0, percentOfTotal: 0 }));
  
  let accumulated = 0;
  
  return sorted.map(item => {
    const previousAccumulated = accumulated;
    accumulated += item.value;
    const accumulatedPercent = (accumulated / totalValue) * 100;
    
    // Curva ABC padrão: 
    // Classe A: primeiros itens que somam até 80% do valor total
    // Classe B: próximos itens que somam de 80% até 95% do valor total  
    // Classe C: demais itens que somam de 95% até 100% do valor total
    let classification = 'C';
    if (previousAccumulated < totalValue * 0.80) {
      classification = 'A';
    } else if (previousAccumulated < totalValue * 0.95) {
      classification = 'B';
    }
    
    return {
      ...item,
      classification,
      accumulatedPercent,
      percentOfTotal: (item.value / totalValue) * 100
    };
  });
};

export default function ABCAnalysis({ items, services, budget }) {
  const [inputAnalysisData, setInputAnalysisData] = useState([]);
  const [isLoadingInputs, setIsLoadingInputs] = useState(true);

  // Carregar análise de insumos a partir do resumo pré-calculado
  useEffect(() => {
    const loadInputAnalysis = async () => {
      if (!budget?.id) {
        setInputAnalysisData([]);
        setIsLoadingInputs(false);
        return;
      }
      setIsLoadingInputs(true);
      try {
        const summaries = await base44.entities.BudgetInputSummary.filter({ orcamento_id: budget.id });

        if (summaries.length === 0) {
          setInputAnalysisData([]);
          setIsLoadingInputs(false);
          return;
        }

        const mapped = summaries.map(s => ({
          id: s.insumo_id,
          code: s.codigo,
          description: s.descricao,
          unit: s.unidade,
          category: s.categoria,
          quantity: s.quantidade_total,
          unitCost: s.custo_unitario,
          value: s.valor_total
        }));

        setInputAnalysisData(classifyABC(mapped));
      } catch (error) {
        console.error('Erro ao carregar análise de insumos:', error);
        setInputAnalysisData([]);
      } finally {
        setIsLoadingInputs(false);
      }
    };

    loadInputAnalysis();
  }, [budget?.id]);

  const serviceAnalysis = useMemo(() => {
    const serviceMap = {};
    
    items.forEach(item => {
      // Usar custo direto sem BDI
      const custoDirecto = item.custo_direto_total || 0;
      
      if (!serviceMap[item.servico_id]) {
        serviceMap[item.servico_id] = {
          id: item.servico_id,
          code: item.codigo,
          description: item.descricao,
          value: 0,
          quantity: 0,
          unit: item.unidade
        };
      }
      serviceMap[item.servico_id].value += custoDirecto;
      serviceMap[item.servico_id].quantity += item.quantidade || 0;
    });
    
    return classifyABC(Object.values(serviceMap));
  }, [items]);



  const getClassificationStats = (analysis) => {
    const stats = { A: 0, B: 0, C: 0 };
    const totalValue = analysis.reduce((sum, item) => sum + item.value, 0);
    
    analysis.forEach(item => {
      stats[item.classification] += item.value;
    });
    
    return {
      A: { count: analysis.filter(i => i.classification === 'A').length, value: stats.A, percent: (stats.A / totalValue) * 100 },
      B: { count: analysis.filter(i => i.classification === 'B').length, value: stats.B, percent: (stats.B / totalValue) * 100 },
      C: { count: analysis.filter(i => i.classification === 'C').length, value: stats.C, percent: (stats.C / totalValue) * 100 },
      total: totalValue
    };
  };

  const renderAnalysisTable = (analysis, title, showValidation = false) => {
    const stats = getClassificationStats(analysis);
    
    return (
      <div className="space-y-6">
        {showValidation && budget && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Total Custo Direto (Orçamento)</p>
                  <p className="text-lg font-bold text-slate-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(budget.total_direto || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Total Soma ABC ({title})</p>
                  <p className="text-lg font-bold text-slate-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.total)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Diferença</p>
                  <p className={`text-lg font-bold ${Math.abs((budget.total_direto || 0) - stats.total) < 1 ? 'text-green-600' : 'text-orange-600'}`}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs((budget.total_direto || 0) - stats.total))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="grid grid-cols-3 gap-4">
          {['A', 'B', 'C'].map(classification => (
            <Card key={classification} className="border-l-4" style={{ borderLeftColor: COLORS_ABC[classification] }}>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold" style={{ color: COLORS_ABC[classification] }}>
                  Classe {classification}
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  {stats[classification].count} itens • {stats[classification].percent.toFixed(1)}% do valor
                </div>
                <div className="text-lg font-semibold mt-2">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats[classification].value)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Classe</TableHead>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-20">Unid</TableHead>
                    <TableHead className="text-right w-24">Qtd</TableHead>
                    <TableHead className="text-right w-28">Valor Unit.</TableHead>
                    <TableHead className="text-right w-32">Valor Total</TableHead>
                    <TableHead className="text-right w-24">% Total</TableHead>
                    <TableHead className="text-right w-24">% Acum.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.map((item, idx) => (
                    <TableRow key={idx} className={item.classification === 'A' ? 'bg-red-50' : item.classification === 'B' ? 'bg-orange-50' : 'bg-green-50'}>
                      <TableCell>
                        <span 
                          className="inline-block px-2 py-1 rounded text-xs font-bold text-white"
                          style={{ backgroundColor: COLORS_ABC[item.classification] }}
                        >
                          {item.classification}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.code}</TableCell>
                      <TableCell className="text-sm">{item.description}</TableCell>
                      <TableCell className="text-xs">{item.unit}</TableCell>
                      <TableCell className="text-right text-sm">{item.quantity.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quantity > 0 ? item.value / item.quantity : 0)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)}
                      </TableCell>
                      <TableCell className="text-right text-sm">{item.percentOfTotal.toFixed(2)}%</TableCell>
                      <TableCell className="text-right text-sm font-medium">{item.accumulatedPercent.toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const prepareQuotationData = () => {
    return inputAnalysisData.map(item => ({
      codigo: item.code,
      descricao: item.description,
      unidade: item.unit,
      quantidade_total: item.quantity,
      valor_unitario: item.quantity > 0 ? item.value / item.quantity : 0,
      valor_total: item.value,
      classe: item.classification
    }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Análise ABC de Custos</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const result = await exportQuotationMapPDF(prepareQuotationData(), budget);
                if (result.success) toast.success(result.message);
                else toast.error(result.message);
              }}
              disabled={isLoadingInputs || inputAnalysisData.length === 0}
            >
              <FileText className="h-4 w-4 mr-2" />
              Mapa PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const result = await exportQuotationMapXLSX(prepareQuotationData(), budget);
                if (result.success) toast.success(result.message);
                else toast.error(result.message);
              }}
              disabled={isLoadingInputs || inputAnalysisData.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Mapa Excel
            </Button>
          </div>
        </CardHeader>
      </Card>
      
    <Tabs defaultValue="services" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="services">
          <Layers className="h-4 w-4 mr-2" />
          Curva ABC - Serviços
        </TabsTrigger>
        <TabsTrigger value="inputs">
          <Package className="h-4 w-4 mr-2" />
          Curva ABC - Insumos
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="services" className="space-y-6">
        {renderAnalysisTable(serviceAnalysis, 'Serviços', true)}
      </TabsContent>
      
      <TabsContent value="inputs" className="space-y-6">
        {isLoadingInputs ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Carregando análise de insumos...</p>
            </div>
          </div>
        ) : inputAnalysisData.length > 0 ? (
        renderAnalysisTable(inputAnalysisData, 'Insumos', true)
        ) : (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-8">
            <p className="text-slate-500 font-medium">Nenhum insumo encontrado</p>
            <p className="text-slate-400 text-sm">Para gerar a Curva ABC de Insumos, abra o orçamento e salve novamente. Os insumos serão calculados e armazenados automaticamente.</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
    </div>
  );
}