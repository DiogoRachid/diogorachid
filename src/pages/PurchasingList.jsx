import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { ShoppingCart, Download, FileText, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function PurchasingListPage() {
  const [selectedWork, setSelectedWork] = useState('');
  const [selectedBudget, setSelectedBudget] = useState('');
  const [abcFilter, setAbcFilter] = useState('');
  const [listData, setListData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [workMonths, setWorkMonths] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const { data: works = [] } = useQuery({
    queryKey: ['works'],
    queryFn: () => base44.entities.Project.list()
  });

  // Buscar orçamentos da obra selecionada
  const { data: budgets = [] } = useQuery({
    queryKey: ['workBudgets', selectedWork],
    queryFn: async () => {
      if (!selectedWork) return [];
      const budgetsList = await base44.entities.Budget.filter({ obra_id: selectedWork }, '-updated_date');
      console.log('Orçamentos encontrados:', budgetsList);
      return budgetsList;
    },
    enabled: !!selectedWork
  });

  // Atualizar meses quando orçamento for selecionado
  React.useEffect(() => {
    if (selectedBudget) {
      const budget = budgets.find(b => b.id === selectedBudget);
      if (budget) {
        setWorkMonths(budget.duracao_meses || 12);
      }
    } else {
      setWorkMonths(0);
    }
  }, [selectedBudget, budgets]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      // Validar antes de processar
      if (!selectedWork) {
        throw new Error('Selecione uma obra');
      }
      if (!selectedBudget) {
        throw new Error('Selecione um orçamento');
      }

      // 1. Buscar orçamento
      const budgets = await base44.entities.Budget.filter({ 
        id: selectedBudget,
        obra_id: selectedWork 
      });
      const budget = budgets[0];
      
      if (!budget) {
        throw new Error('Orçamento não encontrado');
      }
      
      const totalMeses = budget.duracao_meses || 12;

      // 2. Buscar itens do orçamento
      const budgetItems = await base44.entities.BudgetItem.filter({ 
        orcamento_id: budget.id 
      });

      if (!budgetItems || budgetItems.length === 0) {
        throw new Error('O orçamento não tem serviços cadastrados');
      }

      // 3. Buscar cronograma
      const distributions = await base44.entities.ServiceMonthlyDistribution.filter({
        orcamento_id: budget.id
      });

      if (!distributions || distributions.length === 0) {
        throw new Error('O cronograma não está configurado. Acesse Planejamento primeiro.');
      }

      // 4. Buscar serviços
      const serviceIds = [...new Set(budgetItems.map(item => item.servico_id))];
      const services = await base44.entities.Service.filter({
        id: { $in: serviceIds }
      });

      // 5. Buscar composições
      const allServiceItems = await base44.entities.ServiceItem.filter({
        servico_id: { $in: serviceIds }
      });

      if (!allServiceItems || allServiceItems.length === 0) {
        throw new Error('Os serviços não têm composições cadastradas');
      }

      // Função recursiva para expandir serviços
      const expandService = async (servicoId, quantidade = 1, visited = new Set()) => {
        if (visited.has(servicoId)) return [];
        visited.add(servicoId);

        const items = allServiceItems.filter(si => si.servico_id === servicoId);
        const expandedItems = [];

        for (const item of items) {
          if (item.tipo_item === 'INSUMO') {
            expandedItems.push({
              item_id: item.item_id,
              quantidade: item.quantidade * quantidade
            });
          } else if (item.tipo_item === 'SERVICO') {
            const nested = await expandService(item.item_id, item.quantidade * quantidade, visited);
            expandedItems.push(...nested);
          }
        }

        return expandedItems;
      };

      // 6. Expandir composições
      const serviceCompositions = new Map();
      for (const serviceId of serviceIds) {
        const expandedItems = await expandService(serviceId);
        serviceCompositions.set(serviceId, expandedItems);
      }

      // 7. Buscar insumos
      const allInsumoIds = new Set();
      serviceCompositions.forEach(items => {
        items.forEach(item => allInsumoIds.add(item.item_id));
      });

      const inputs = await base44.entities.Input.filter({
        id: { $in: Array.from(allInsumoIds) }
      });

      const inputMap = new Map(inputs.map(i => [i.id, i]));

      // 8. Calcular insumos por mês
      const periodoMap = new Map();

      for (const dist of distributions) {
        const budgetItem = budgetItems.find(bi => bi.id === dist.budget_item_id);
        if (!budgetItem) continue;

        const quantidadeServico = (budgetItem.quantidade * dist.percentual) / 100;
        if (quantidadeServico <= 0) continue;

        const composicao = serviceCompositions.get(budgetItem.servico_id) || [];

        for (const compItem of composicao) {
          const input = inputMap.get(compItem.item_id);
          if (!input) continue;

          const quantidadeInsumo = quantidadeServico * compItem.quantidade;

          if (!periodoMap.has(dist.mes)) {
            periodoMap.set(dist.mes, new Map());
          }

          const mesMap = periodoMap.get(dist.mes);

          if (mesMap.has(input.id)) {
            const existing = mesMap.get(input.id);
            existing.quantidade += quantidadeInsumo;
          } else {
            mesMap.set(input.id, {
              insumo_id: input.id,
              codigo: input.codigo,
              descricao: input.descricao,
              unidade: input.unidade,
              valor_unitario: input.valor_unitario || 0,
              quantidade: quantidadeInsumo
            });
          }
        }
      }

      // 9. Classificação ABC
      const allItems = [];
      periodoMap.forEach(mesMap => {
        mesMap.forEach(item => {
          const existing = allItems.find(i => i.insumo_id === item.insumo_id);
          if (existing) {
            existing.quantidade += item.quantidade;
          } else {
            allItems.push({ ...item });
          }
        });
      });

      allItems.forEach(item => {
        item.valor_total = item.quantidade * item.valor_unitario;
      });

      const totalValue = allItems.reduce((sum, item) => sum + item.valor_total, 0);
      allItems.sort((a, b) => b.valor_total - a.valor_total);

      let accumulated = 0;
      allItems.forEach(item => {
        accumulated += item.valor_total;
        const percentage = (accumulated / totalValue) * 100;
        
        if (percentage <= 80) {
          item.abc_class = 'A';
        } else if (percentage <= 95) {
          item.abc_class = 'B';
        } else {
          item.abc_class = 'C';
        }
      });

      const abcMap = new Map(allItems.map(item => [item.insumo_id, item.abc_class]));

      // 10. Montar resposta
      const periodos = [];
      for (let mes = 1; mes <= totalMeses; mes++) {
        const mesMap = periodoMap.get(mes);
        if (!mesMap || mesMap.size === 0) continue;

        const itens = Array.from(mesMap.values()).map(item => ({
          ...item,
          abc_class: abcMap.get(item.insumo_id) || 'C'
        }));

        const itensFiltrados = abcFilter 
          ? itens.filter(item => item.abc_class === abcFilter)
          : itens;

        if (itensFiltrados.length === 0) continue;

        const totalValor = itensFiltrados.reduce((sum, item) => 
          sum + (item.quantidade * item.valor_unitario), 0
        );

        periodos.push({
          mes,
          periodo: `Mês ${mes}`,
          itens: itensFiltrados.sort((a, b) => {
            const classOrder = { 'A': 0, 'B': 1, 'C': 2 };
            return classOrder[a.abc_class] - classOrder[b.abc_class];
          }),
          total_itens: itensFiltrados.length,
          total_valor: totalValor
        });
      }

      const obra = await base44.entities.Project.get(selectedWork);

      return {
        success: true,
        data: {
          obra_id: selectedWork,
          obra_nome: obra?.nome || 'N/A',
          total_meses: totalMeses,
          data_geracao: new Date().toISOString().split('T')[0],
          periodos,
          total_geral_itens: allItems.length,
          total_geral_valor: totalValue
        }
      };
    },
    onSuccess: (data) => {
      if (data?.success) {
        setListData(data.data);
        toast.success('Lista gerada com sucesso!');
        if (!data.data?.periodos || data.data.periodos.length === 0) {
          toast.warning('Nenhum item encontrado. Verifique se o cronograma está configurado.');
        }
      } else {
        toast.error(data?.error || 'Erro ao gerar lista');
      }
    },
    onError: (error) => {
      console.error('[FRONTEND] Erro:', error);
      const errorMsg = error?.response?.data?.error || error?.message || 'Erro desconhecido';
      toast.error(`Erro: ${errorMsg}`);
    }
  });

  const exportPDF = () => {
    if (!sortedItems || sortedItems.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape' });
    const work = works.find(w => w.id === selectedWork);
    const pageWidth = doc.internal.pageSize.getWidth();

    // Logo
    const logoUrl = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/user_690c7efb29582ad524a0ff3e/fb3eac426_logofundoclaro.jpg";
    try {
      doc.addImage(logoUrl, 'JPEG', 15, 12, 50, 12);
    } catch (e) {
      console.log('Logo não carregada');
    }

    // Cabeçalho com fundo azul
    doc.setFillColor(41, 98, 255);
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Título
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('LISTA DE COMPRAS', pageWidth / 2, 15, { align: 'center' });

    // Informações da obra
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Obra: ${work?.nome || 'N/A'}`, 15, 40);
    doc.text(`Endereço: ${work?.endereco || 'N/A'}`, 15, 45);
    doc.text(`${work?.cidade || 'N/A'} - ${work?.estado || 'N/A'}`, 15, 50);
    
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 15, 40, { align: 'right' });
    if (selectedMonth !== 'all') {
      doc.text(`Período: Mês ${selectedMonth}`, pageWidth - 15, 45, { align: 'right' });
    } else {
      doc.text(`Períodos: ${displayData.total_meses} meses`, pageWidth - 15, 45, { align: 'right' });
    }
    doc.text(`Total: ${sortedItems.length} itens`, pageWidth - 15, 50, { align: 'right' });

    doc.setTextColor(0, 0, 0);

    // Tabela
    const tableData = sortedItems.map(item => [
      item.abc_class,
      item.descricao,
      item.unidade,
      item.quantidade.toFixed(2),
      item.valor_unitario.toFixed(2),
      (item.quantidade * item.valor_unitario).toFixed(2)
    ]);

    doc.autoTable({
      head: [['ABC', 'Descrição do Material', 'Un.', 'Quantidade', 'Valor Unit.', 'Total']],
      body: tableData,
      startY: 58,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { 
        fillColor: [41, 98, 255], 
        textColor: [255, 255, 255], 
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { cellWidth: 130 },
        2: { halign: 'center', cellWidth: 15 },
        3: { halign: 'right', cellWidth: 25 },
        4: { halign: 'right', cellWidth: 30 },
        5: { halign: 'right', cellWidth: 30 }
      },
      alternateRowStyles: { fillColor: [245, 247, 250] }
    });

    // Totais com fundo
    const finalY = doc.lastAutoTable.finalY + 8;
    doc.setFillColor(226, 232, 240);
    doc.rect(15, finalY, pageWidth - 30, 15, 'F');
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`VALOR TOTAL: R$ ${displayData.total_geral_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, finalY + 10);

    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Virtual Construções - Gerado em ${new Date().toLocaleString('pt-BR')} - Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    doc.save(`Lista_Compras_${work?.nome || 'Obra'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
  };

  const exportXLSX = async () => {
    if (!sortedItems || sortedItems.length === 0) return;

    const ExcelJS = (await import('exceljs')).default;
    const work = works.find(w => w.id === selectedWork);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Lista de Compras');

    // Logo
    try {
      const logoUrl = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/user_690c7efb29582ad524a0ff3e/fb3eac426_logofundoclaro.jpg";
      const response = await fetch(logoUrl);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      
      const imageId = workbook.addImage({
        buffer: arrayBuffer,
        extension: 'jpeg',
      });
      
      worksheet.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 150, height: 35 }
      });
    } catch (e) {
      console.log('Logo não carregada');
    }

    // Título
    worksheet.mergeCells('A3:F3');
    const titleCell = worksheet.getCell('A3');
    titleCell.value = 'LISTA DE COMPRAS';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2962FF' } };

    // Informações da obra
    worksheet.mergeCells('A5:C5');
    worksheet.getCell('A5').value = `Obra: ${work?.nome || 'N/A'}`;
    worksheet.getCell('A5').font = { bold: true };
    
    worksheet.mergeCells('A6:C6');
    worksheet.getCell('A6').value = `Endereço: ${work?.endereco || 'N/A'}`;
    
    worksheet.mergeCells('A7:C7');
    worksheet.getCell('A7').value = `Cidade: ${work?.cidade || 'N/A'} - ${work?.estado || 'N/A'}`;

    worksheet.mergeCells('D5:F5');
    worksheet.getCell('D5').value = `Data: ${new Date().toLocaleDateString('pt-BR')}`;
    worksheet.getCell('D5').alignment = { horizontal: 'right' };
    
    worksheet.mergeCells('D6:F6');
    const periodoText = selectedMonth !== 'all' ? `Período: Mês ${selectedMonth}` : `Períodos: ${displayData.total_meses} meses`;
    worksheet.getCell('D6').value = periodoText;
    worksheet.getCell('D6').alignment = { horizontal: 'right' };
    
    worksheet.mergeCells('D7:F7');
    worksheet.getCell('D7').value = `Total de Itens: ${sortedItems.length}`;
    worksheet.getCell('D7').alignment = { horizontal: 'right' };

    // Cabeçalho da tabela
    const headerRow = worksheet.getRow(9);
    const headers = ['ABC', 'Descrição', 'Unidade', 'Quantidade', 'Valor Unitário', 'Total'];
    headers.forEach((header, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2962FF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Dados
    sortedItems.forEach((item, idx) => {
      const row = worksheet.getRow(10 + idx);
      row.getCell(1).value = item.abc_class;
      row.getCell(1).alignment = { horizontal: 'center' };
      
      row.getCell(2).value = item.descricao;
      
      row.getCell(3).value = item.unidade;
      row.getCell(3).alignment = { horizontal: 'center' };
      
      row.getCell(4).value = parseFloat(item.quantidade.toFixed(2));
      row.getCell(4).numFmt = '#,##0.00';
      row.getCell(4).alignment = { horizontal: 'right' };
      
      row.getCell(5).value = parseFloat(item.valor_unitario.toFixed(2));
      row.getCell(5).numFmt = 'R$ #,##0.00';
      row.getCell(5).alignment = { horizontal: 'right' };
      
      row.getCell(6).value = parseFloat((item.quantidade * item.valor_unitario).toFixed(2));
      row.getCell(6).numFmt = 'R$ #,##0.00';
      row.getCell(6).alignment = { horizontal: 'right' };

      // Cor de fundo alternada
      if (idx % 2 === 0) {
        [1, 2, 3, 4, 5, 6].forEach(col => {
          row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
        });
      }

      // Bordas
      [1, 2, 3, 4, 5, 6].forEach(col => {
        row.getCell(col).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    // Total
    const totalRow = worksheet.getRow(10 + sortedItems.length + 1);
    worksheet.mergeCells(`A${totalRow.number}:E${totalRow.number}`);
    totalRow.getCell(1).value = 'VALOR TOTAL:';
    totalRow.getCell(1).font = { bold: true, size: 12 };
    totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    
    totalRow.getCell(6).value = parseFloat(displayData.total_geral_valor.toFixed(2));
    totalRow.getCell(6).numFmt = 'R$ #,##0.00';
    totalRow.getCell(6).font = { bold: true, size: 12 };
    totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    // Larguras das colunas
    worksheet.columns = [
      { width: 10 },
      { width: 50 },
      { width: 12 },
      { width: 15 },
      { width: 18 },
      { width: 18 }
    ];

    // Exportar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Lista_Compras_${work?.nome || 'Obra'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`;
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Filtrar itens por mês selecionado e consolidar insumos duplicados
  let filteredPeriodos = listData?.periodos || [];
  let displayData = {
    ...listData,
    itens: listData?.periodos?.flatMap(p => p.itens) || [],
    total_geral_itens: listData?.total_geral_itens || 0,
    total_geral_valor: listData?.total_geral_valor || 0
  };

  if (selectedMonth !== 'all' && listData) {
    const monthNum = parseInt(selectedMonth);
    filteredPeriodos = listData.periodos.filter(p => p.mes === monthNum);
    
    const allItems = filteredPeriodos.flatMap(p => p.itens || []);
    const totalValue = filteredPeriodos.reduce((sum, p) => sum + p.total_valor, 0);
    displayData = {
      ...listData,
      periodos: filteredPeriodos,
      itens: allItems,
      total_geral_itens: allItems.length,
      total_geral_valor: totalValue
    };
  }

  // Consolidar insumos com mesmo código e descrição
  const consolidatedItems = React.useMemo(() => {
    const itemsMap = new Map();
    
    (displayData?.itens || []).forEach(item => {
      const key = `${item.codigo || ''}_${item.descricao}`;
      
      if (itemsMap.has(key)) {
        const existing = itemsMap.get(key);
        existing.quantidade += item.quantidade;
      } else {
        itemsMap.set(key, { ...item });
      }
    });
    
    return Array.from(itemsMap.values());
  }, [displayData?.itens]);

  displayData = {
    ...displayData,
    itens: consolidatedItems,
    total_geral_itens: consolidatedItems.length,
    total_geral_valor: consolidatedItems.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0)
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = useMemo(() => {
    if (!consolidatedItems) return [];
    
    const items = [...consolidatedItems];
    
    if (sortConfig.key) {
      items.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        // Para valores numéricos
        if (sortConfig.key === 'quantidade' || sortConfig.key === 'valor_unitario') {
          aVal = parseFloat(aVal);
          bVal = parseFloat(bVal);
        }
        
        // Para valor total
        if (sortConfig.key === 'total') {
          aVal = a.quantidade * a.valor_unitario;
          bVal = b.quantidade * b.valor_unitario;
        }
        
        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return items;
  }, [consolidatedItems, sortConfig]);

  const abcCounts = (sortedItems || []).reduce((acc, item) => ({
    ...acc,
    [item.abc_class]: (acc[item.abc_class] || 0) + 1
  }), {});

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="h-4 w-4 text-blue-600" /> : 
      <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Lista de Compras Mensal"
        subtitle="Gere listas de compra baseadas no cronograma e curva ABC"
        icon={ShoppingCart}
      />

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Parâmetros da Lista</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-sm font-medium">Obra</label>
               <Select value={selectedWork} onValueChange={(value) => {
                 setSelectedWork(value);
                 setSelectedBudget('');
                 setListData(null);
               }}>
                 <SelectTrigger>
                   <SelectValue placeholder="Selecione a obra" />
                 </SelectTrigger>
                 <SelectContent>
                   {works.map(work => (
                     <SelectItem key={work.id} value={work.id}>
                       {work.nome}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>

             <div className="space-y-2">
               <label className="text-sm font-medium">Orçamento</label>
               <Select value={selectedBudget} onValueChange={setSelectedBudget} disabled={!selectedWork || budgets.length === 0}>
                 <SelectTrigger>
                   <SelectValue placeholder={!selectedWork ? "Selecione a obra primeiro" : budgets.length === 0 ? "Sem orçamentos" : "Selecione o orçamento"} />
                 </SelectTrigger>
                 <SelectContent>
                   {budgets.map(budget => (
                     <SelectItem key={budget.id} value={budget.id}>
                       {budget.descricao} (v{budget.versao}) - {budget.status}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>

             <div className="space-y-2">
               <label className="text-sm font-medium">Período</label>
               <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={!selectedBudget || workMonths === 0}>
                 <SelectTrigger>
                   <SelectValue placeholder="Selecione o orçamento primeiro" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">Todos os Meses</SelectItem>
                   {Array.from({ length: workMonths }, (_, i) => i + 1).map(month => (
                     <SelectItem key={month} value={month.toString()}>
                       Mês {month}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>

             <div className="space-y-2">
               <label className="text-sm font-medium">Filtro ABC</label>
               <Select value={abcFilter} onValueChange={setAbcFilter}>
                 <SelectTrigger>
                   <SelectValue placeholder="Todos" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value={null}>Todos</SelectItem>
                   <SelectItem value="A">Classe A (Alto valor)</SelectItem>
                   <SelectItem value="B">Classe B (Médio valor)</SelectItem>
                   <SelectItem value="C">Classe C (Baixo valor)</SelectItem>
                 </SelectContent>
               </Select>
             </div>
           </div>

          <Button
            onClick={() => {
              setSelectedMonth('all');
              generateMutation.mutate();
            }}
            disabled={!selectedBudget || generateMutation.isPending}
            className="mt-4 bg-blue-600 hover:bg-blue-700"
          >
            {generateMutation.isPending ? 'Gerando...' : 'Gerar Lista'}
          </Button>
          {selectedBudget && workMonths > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              Orçamento com {workMonths} meses de duração
            </p>
          )}
        </CardContent>
      </Card>

      {/* Resultado */}
      {listData && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-600">Total de Itens</p>
                <p className="text-2xl font-bold">{sortedItems?.length || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-600">Classe A</p>
                <p className="text-2xl font-bold text-red-600">{abcCounts?.A || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-600">Classe B</p>
                <p className="text-2xl font-bold text-amber-600">{abcCounts?.B || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-600">Classe C</p>
                <p className="text-2xl font-bold text-green-600">{abcCounts?.C || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-600">Valor Total</p>
                <p className="text-2xl font-bold">R$ {(displayData?.total_geral_valor || 0).toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Itens para Compra</CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={exportPDF}
                    variant="outline"
                    size="sm"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button
                    onClick={exportXLSX}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left py-3 px-4 font-medium">
                        <button 
                          onClick={() => handleSort('abc_class')} 
                          className="flex items-center gap-2 hover:text-blue-600"
                        >
                          ABC
                          <SortIcon columnKey="abc_class" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 font-medium">
                        <button 
                          onClick={() => handleSort('descricao')} 
                          className="flex items-center gap-2 hover:text-blue-600"
                        >
                          Descrição
                          <SortIcon columnKey="descricao" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 font-medium">
                        <button 
                          onClick={() => handleSort('unidade')} 
                          className="flex items-center gap-2 hover:text-blue-600"
                        >
                          Unidade
                          <SortIcon columnKey="unidade" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-4 font-medium">
                        <button 
                          onClick={() => handleSort('quantidade')} 
                          className="flex items-center gap-2 ml-auto hover:text-blue-600"
                        >
                          Quantidade
                          <SortIcon columnKey="quantidade" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-4 font-medium">
                        <button 
                          onClick={() => handleSort('valor_unitario')} 
                          className="flex items-center gap-2 ml-auto hover:text-blue-600"
                        >
                          Valor Unit.
                          <SortIcon columnKey="valor_unitario" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-4 font-medium">
                        <button 
                          onClick={() => handleSort('total')} 
                          className="flex items-center gap-2 ml-auto hover:text-blue-600"
                        >
                          Total
                          <SortIcon columnKey="total" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-white text-xs font-medium ${
                            item.abc_class === 'A' ? 'bg-red-600' :
                            item.abc_class === 'B' ? 'bg-amber-600' :
                            'bg-green-600'
                          }`}>
                            {item.abc_class}
                          </span>
                        </td>
                        <td className="py-3 px-4">{item.descricao}</td>
                        <td className="py-3 px-4">{item.unidade}</td>
                        <td className="py-3 px-4 text-right">{item.quantidade.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-medium">R$ {item.valor_unitario.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold">R$ {(item.quantidade * item.valor_unitario).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}