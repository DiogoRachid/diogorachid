import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { base44 } from '@/api/base44Client';

export async function exportMeasurementXLSX(measurementId) {
  try {
    // Buscar dados
    const measurement = (await base44.entities.Measurement.filter({ id: measurementId }))[0];
    const items = await base44.entities.MeasurementItem.filter({ medicao_id: measurementId });
    const budget = (await base44.entities.Budget.filter({ id: measurement.orcamento_id }))[0];

    // ABA 1 - RESUMO DA MEDIÇÃO
    const resumoData = [
      ['RESUMO DA MEDIÇÃO'],
      [],
      ['Obra:', measurement.obra_nome],
      ['Número da Medição:', measurement.numero_medicao],
      ['Período:', measurement.periodo_referencia],
      ['Data Início:', measurement.data_inicio || '-'],
      ['Data Fim:', measurement.data_fim || '-'],
      [],
      ['Valor do Orçamento:', budget?.total_final || 0],
      ['Valor Executado no Período:', measurement.valor_total_periodo || 0],
      ['Valor Executado Acumulado:', measurement.valor_total_acumulado || 0],
      ['Saldo a Executar:', (budget?.total_final || 0) - (measurement.valor_total_acumulado || 0)],
      [],
      ['% Físico Executado:', (measurement.percentual_fisico_executado || 0).toFixed(2) + '%'],
      ['% Financeiro Executado:', (measurement.percentual_financeiro_executado || 0).toFixed(2) + '%'],
      [],
      ['Observações:', measurement.observacao || '-']
    ];

    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);

    // ABA 2 - MEDIÇÃO DE SERVIÇOS
    const servicosHeaders = [
      'Etapa',
      'Código',
      'Descrição',
      'Unidade',
      'Qtd Orçada',
      'Qtd Exec. Período',
      'Qtd Exec. Acumulada',
      'Saldo',
      'Preço Unitário',
      'Valor Exec. Período',
      'Valor Exec. Acumulado'
    ];

    const servicosData = items.map(item => [
      item.stage_nome || '',
      item.codigo,
      item.descricao,
      item.unidade,
      item.quantidade_orcada,
      item.quantidade_executada_periodo,
      item.quantidade_executada_acumulada,
      item.saldo_a_executar,
      item.custo_unitario,
      item.valor_executado_periodo,
      item.valor_executado_acumulado
    ]);

    // Adicionar totais
    const totalPeriodo = items.reduce((sum, item) => sum + (item.valor_executado_periodo || 0), 0);
    const totalAcumulado = items.reduce((sum, item) => sum + (item.valor_executado_acumulado || 0), 0);

    servicosData.push([]);
    servicosData.push(['', '', '', '', '', '', '', '', 'TOTAL:', totalPeriodo, totalAcumulado]);

    const wsServicos = XLSX.utils.aoa_to_sheet([servicosHeaders, ...servicosData]);

    // Largura das colunas
    wsServicos['!cols'] = [
      { wch: 15 }, // Etapa
      { wch: 10 }, // Código
      { wch: 40 }, // Descrição
      { wch: 8 },  // Unidade
      { wch: 12 }, // Qtd Orçada
      { wch: 15 }, // Qtd Exec Período
      { wch: 17 }, // Qtd Exec Acum
      { wch: 10 }, // Saldo
      { wch: 14 }, // Preço Unit
      { wch: 16 }, // Valor Período
      { wch: 17 }  // Valor Acum
    ];

    // ABA 3 - COMPARATIVO (simplificado)
    const comparativoData = [
      ['COMPARATIVO - PREVISTO X EXECUTADO'],
      [],
      ['Descrição', 'Previsto (R$)', 'Executado (R$)', 'Diferença (R$)', 'Diferença (%)'],
      [
        'Total do Projeto',
        budget?.total_final || 0,
        measurement.valor_total_acumulado || 0,
        (budget?.total_final || 0) - (measurement.valor_total_acumulado || 0),
        budget?.total_final > 0 
          ? (((measurement.valor_total_acumulado || 0) / budget.total_final) * 100).toFixed(2) + '%'
          : '0%'
      ]
    ];

    const wsComparativo = XLSX.utils.aoa_to_sheet(comparativoData);

    // Criar workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
    XLSX.utils.book_append_sheet(wb, wsServicos, 'Medição de Serviços');
    XLSX.utils.book_append_sheet(wb, wsComparativo, 'Comparativo');

    // Exportar
    const fileName = `Medicao_${measurement.numero_medicao}_${measurement.obra_nome}_${measurement.periodo_referencia}.xlsx`.replace(/[/\\?%*:|"<>]/g, '_');
    XLSX.writeFile(wb, fileName);

    return { success: true, message: 'XLSX exportado com sucesso!' };
  } catch (error) {
    console.error('Erro ao exportar XLSX:', error);
    return { success: false, message: 'Erro ao exportar XLSX: ' + error.message };
  }
}

export async function exportMeasurementPDF(measurementId) {
  try {
    // Buscar dados
    const measurement = (await base44.entities.Measurement.filter({ id: measurementId }))[0];
    const items = await base44.entities.MeasurementItem.filter({ medicao_id: measurementId });
    const budget = (await base44.entities.Budget.filter({ id: measurement.orcamento_id }))[0];

    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // CAPA
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('MEDIÇÃO DE OBRA', pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 15;
    doc.setFontSize(14);
    doc.text(measurement.obra_nome, pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 20;
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Medição Nº: ${measurement.numero_medicao}`, 20, yPos);
    doc.text(`Período: ${measurement.periodo_referencia}`, 20, yPos + 8);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, yPos + 16);
    
    yPos += 30;
    doc.setFontSize(11);
    doc.text(`Valor Orçado: ${formatCurrency(budget?.total_final || 0)}`, 20, yPos);
    doc.text(`Valor Executado (Período): ${formatCurrency(measurement.valor_total_periodo || 0)}`, 20, yPos + 7);
    doc.text(`Valor Executado (Acumulado): ${formatCurrency(measurement.valor_total_acumulado || 0)}`, 20, yPos + 14);
    doc.text(`% Físico Executado: ${(measurement.percentual_fisico_executado || 0).toFixed(2)}%`, 20, yPos + 21);

    // Nova página para tabela
    doc.addPage();
    yPos = 20;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('MEDIÇÃO DE SERVIÇOS', pageWidth / 2, yPos, { align: 'center' });

    yPos += 10;

    // Agrupar por etapa
    const itemsByStage = {};
    items.forEach(item => {
      const stageName = item.stage_nome || 'Sem Etapa';
      if (!itemsByStage[stageName]) {
        itemsByStage[stageName] = [];
      }
      itemsByStage[stageName].push(item);
    });

    // Tabela simples sem autoTable
    doc.setFontSize(8);
    Object.keys(itemsByStage).forEach(stageName => {
      const stageItems = itemsByStage[stageName];

      // Cabeçalho da etapa
      doc.setFillColor(41, 98, 255);
      doc.rect(10, yPos, 277, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.text(stageName, 15, yPos + 5);
      yPos += 9;

      // Cabeçalho das colunas
      doc.setFillColor(71, 85, 105);
      doc.rect(10, yPos, 277, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text('Cód', 12, yPos + 4);
      doc.text('Descrição', 30, yPos + 4);
      doc.text('Un', 100, yPos + 4);
      doc.text('Qtd Orç', 115, yPos + 4);
      doc.text('Qtd Per', 140, yPos + 4);
      doc.text('Qtd Acum', 165, yPos + 4);
      doc.text('Saldo', 195, yPos + 4);
      doc.text('Preço', 215, yPos + 4);
      doc.text('Valor Per', 235, yPos + 4);
      doc.text('Valor Acum', 260, yPos + 4);
      yPos += 7;

      // Dados
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      stageItems.forEach(item => {
        if (yPos > 190) {
          doc.addPage();
          yPos = 20;
        }

        if (item.saldo_a_executar < 0) {
          doc.setTextColor(220, 38, 38);
        }

        doc.text(item.codigo || '', 12, yPos + 4);
        doc.text((item.descricao || '').substring(0, 35), 30, yPos + 4);
        doc.text(item.unidade || '', 100, yPos + 4);
        doc.text(formatNumber(item.quantidade_orcada), 115, yPos + 4);
        doc.text(formatNumber(item.quantidade_executada_periodo), 140, yPos + 4);
        doc.text(formatNumber(item.quantidade_executada_acumulada), 165, yPos + 4);
        doc.text(formatNumber(item.saldo_a_executar), 195, yPos + 4);
        doc.text(formatCurrency(item.custo_unitario), 215, yPos + 4);
        doc.text(formatCurrency(item.valor_executado_periodo), 235, yPos + 4);
        doc.text(formatCurrency(item.valor_executado_acumulado), 260, yPos + 4);

        doc.setTextColor(0, 0, 0);
        yPos += 6;
      });

      yPos += 3;
    });

    // Totais
    const totalPeriodo = items.reduce((sum, item) => sum + (item.valor_executado_periodo || 0), 0);
    const totalAcumulado = items.reduce((sum, item) => sum + (item.valor_executado_acumulado || 0), 0);

    doc.setFillColor(241, 245, 249);
    doc.rect(10, yPos, 277, 7, 'F');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.text('TOTAL:', 215, yPos + 5);
    doc.text(formatCurrency(totalPeriodo), 235, yPos + 5);
    doc.text(formatCurrency(totalAcumulado), 260, yPos + 5);

    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
      doc.text(
        `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
        10,
        doc.internal.pageSize.getHeight() - 10
      );
    }

    // Salvar
    const fileName = `Medicao_${measurement.numero_medicao}_${measurement.obra_nome}_${measurement.periodo_referencia}.pdf`.replace(/[/\\?%*:|"<>]/g, '_');
    doc.save(fileName);

    return { success: true, message: 'PDF exportado com sucesso!' };
  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    return { success: false, message: 'Erro ao exportar PDF: ' + error.message };
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
}

function formatNumber(value) {
  return (value || 0).toFixed(2);
}