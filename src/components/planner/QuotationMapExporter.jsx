import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

export async function exportQuotationMapXLSX(analysisData, budgetData) {
  try {
    // Filtrar apenas A e B
    const filteredData = analysisData.filter(item => item.classe === 'A' || item.classe === 'B');
    const classA = filteredData.filter(item => item.classe === 'A');
    const classB = filteredData.filter(item => item.classe === 'B');
    
    const totalA = classA.reduce((sum, item) => sum + item.valor_total, 0);
    const totalB = classB.reduce((sum, item) => sum + item.valor_total, 0);
    const totalGeral = totalA + totalB;

    // Criar workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Mapa de Cotações');

    let currentRow = 1;

    // Logo
    try {
      const logoUrl = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6926eb0b6c1242bf806695a4/e482e0b04_logofundoclaro.jpg";
      const response = await fetch(logoUrl);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      
      const imageId = workbook.addImage({
        buffer: arrayBuffer,
        extension: 'jpeg',
      });
      
      worksheet.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 250, height: 60 }
      });
      
      currentRow = 5;
    } catch (e) {
      console.log('Logo não carregada');
    }

    // Título
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = 'MAPA DE COTAÇÕES - INSUMOS PRIORITÁRIOS';
    titleCell.font = { size: 18, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 2;

    // Dados do projeto
    worksheet.getRow(currentRow).getCell(1).value = 'Obra:';
    worksheet.getRow(currentRow).getCell(1).font = { bold: true };
    worksheet.getRow(currentRow).getCell(2).value = budgetData?.obra_nome || 'N/A';
    currentRow++;
    worksheet.getRow(currentRow).getCell(1).value = 'Orçamento:';
    worksheet.getRow(currentRow).getCell(1).font = { bold: true };
    worksheet.getRow(currentRow).getCell(2).value = budgetData?.descricao || 'N/A';
    currentRow++;
    worksheet.getRow(currentRow).getCell(1).value = 'Data:';
    worksheet.getRow(currentRow).getCell(1).font = { bold: true };
    worksheet.getRow(currentRow).getCell(2).value = format(new Date(), 'dd/MM/yyyy');
    currentRow += 2;

    // Instruções
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    const instrCell = worksheet.getCell(`A${currentRow}`);
    instrCell.value = 'INSTRUÇÕES: Este mapa contém os insumos das classes A e B (curva ABC). Utilize as colunas de cotação para registrar preços de fornecedores.';
    instrCell.font = { size: 9, italic: true };
    instrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
    instrCell.alignment = { wrapText: true };
    currentRow += 2;

    // Função para adicionar classe
    const addClassSection = (items, className, classColor) => {
      // Header da classe
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
      const classHeader = worksheet.getCell(`A${currentRow}`);
      classHeader.value = `CLASSE ${className} - ${className === 'A' ? 'Alta Prioridade' : 'Média Prioridade'} (${items.length} itens)`;
      classHeader.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      classHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: classColor } };
      classHeader.alignment = { horizontal: 'left', vertical: 'middle' };
      currentRow++;

      // Cabeçalho da tabela
      const headerRow = worksheet.getRow(currentRow);
      const headers = ['Código', 'Descrição', 'Unid.', 'Qtd Total', 'Valor Unit.', 'Valor Total', 'Cotação'];
      headers.forEach((header, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'medium' },
          right: { style: 'thin' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      currentRow++;

      // Dados
      items.forEach(item => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = item.codigo || '';
        row.getCell(2).value = item.descricao || '';
        row.getCell(3).value = item.unidade || '';
        row.getCell(4).value = parseFloat((item.quantidade_total || 0).toFixed(2));
        row.getCell(4).numFmt = '0.00';
        row.getCell(5).value = parseFloat((item.valor_unitario || 0).toFixed(2));
        row.getCell(5).numFmt = 'R$ #,##0.00';
        row.getCell(6).value = parseFloat((item.valor_total || 0).toFixed(2));
        row.getCell(6).numFmt = 'R$ #,##0.00';
        row.getCell(7).value = '';
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        
        for (let i = 1; i <= 7; i++) {
          row.getCell(i).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
        currentRow++;
      });

      currentRow += 1;
    };

    // Adicionar Classe A
    if (classA.length > 0) {
      addClassSection(classA, 'A', 'FFEF4444');
    }

    // Adicionar Classe B
    if (classB.length > 0) {
      addClassSection(classB, 'B', 'FFF59E0B');
    }

    currentRow += 1;

    // Resumo
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    const summaryTitle = worksheet.getCell(`A${currentRow}`);
    summaryTitle.value = 'RESUMO DO MAPA';
    summaryTitle.font = { size: 12, bold: true };
    summaryTitle.alignment = { horizontal: 'center' };
    summaryTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    currentRow++;

    const summaryRow1 = worksheet.getRow(currentRow);
    summaryRow1.getCell(5).value = 'Total Classe A:';
    summaryRow1.getCell(5).font = { bold: true };
    summaryRow1.getCell(5).alignment = { horizontal: 'right' };
    summaryRow1.getCell(6).value = parseFloat(totalA.toFixed(2));
    summaryRow1.getCell(6).numFmt = 'R$ #,##0.00';
    summaryRow1.getCell(6).font = { bold: true };
    currentRow++;

    const summaryRow2 = worksheet.getRow(currentRow);
    summaryRow2.getCell(5).value = 'Total Classe B:';
    summaryRow2.getCell(5).font = { bold: true };
    summaryRow2.getCell(5).alignment = { horizontal: 'right' };
    summaryRow2.getCell(6).value = parseFloat(totalB.toFixed(2));
    summaryRow2.getCell(6).numFmt = 'R$ #,##0.00';
    summaryRow2.getCell(6).font = { bold: true };
    currentRow++;

    const summaryRow3 = worksheet.getRow(currentRow);
    summaryRow3.getCell(5).value = 'TOTAL GERAL:';
    summaryRow3.getCell(5).font = { bold: true, size: 11 };
    summaryRow3.getCell(5).alignment = { horizontal: 'right' };
    summaryRow3.getCell(6).value = parseFloat(totalGeral.toFixed(2));
    summaryRow3.getCell(6).numFmt = 'R$ #,##0.00';
    summaryRow3.getCell(6).font = { bold: true, size: 11 };
    summaryRow3.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    // Largura das colunas
    worksheet.columns = [
      { width: 12 },  // Código
      { width: 45 },  // Descrição
      { width: 8 },   // Unidade
      { width: 12 },  // Qtd Total
      { width: 14 },  // Valor Unit.
      { width: 16 },  // Valor Total
      { width: 16 }   // Cotação
    ];

    // Exportar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Mapa_Cotacoes_${budgetData?.descricao || 'Orcamento'}_${format(new Date(), 'yyyyMMdd')}.xlsx`.replace(/[/\\?%*:|"<>]/g, '_');
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);

    return { success: true, message: 'Mapa exportado em XLSX com sucesso!' };
  } catch (error) {
    console.error('Erro ao exportar XLSX:', error);
    return { success: false, message: 'Erro ao exportar XLSX: ' + error.message };
  }
}

export async function exportQuotationMapPDF(analysisData, budgetData) {
  try {
    const filteredData = analysisData.filter(item => item.classe === 'A' || item.classe === 'B');
    const classA = filteredData.filter(item => item.classe === 'A');
    const classB = filteredData.filter(item => item.classe === 'B');
    
    const totalA = classA.reduce((sum, item) => sum + item.valor_total, 0);
    const totalB = classB.reduce((sum, item) => sum + item.valor_total, 0);
    const totalGeral = totalA + totalB;

    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;

    // Logo
    const logoUrl = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6926eb0b6c1242bf806695a4/e482e0b04_logofundoclaro.jpg";
    try {
      doc.addImage(logoUrl, 'JPEG', 15, yPos, 70, 17);
    } catch (e) {
      console.log('Logo não carregada');
    }

    // Título
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('MAPA DE COTAÇÕES - INSUMOS PRIORITÁRIOS', pageWidth / 2, yPos + 8, { align: 'center' });
    
    yPos += 25;
    
    // Dados
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Obra: ${budgetData?.obra_nome || 'N/A'}`, 15, yPos);
    yPos += 5;
    doc.text(`Orçamento: ${budgetData?.descricao || 'N/A'}`, 15, yPos);
    yPos += 5;
    doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy')}`, 15, yPos);
    
    yPos += 10;

    // Instruções
    doc.setFillColor(224, 242, 254);
    doc.rect(10, yPos, 277, 8, 'F');
    doc.setFontSize(8);
    doc.setFont(undefined, 'italic');
    doc.text('INSTRUÇÕES: Este mapa contém os insumos das classes A e B (curva ABC). Utilize a coluna "Cotação" para registrar preços.', 12, yPos + 5);
    doc.setFont(undefined, 'normal');
    yPos += 12;

    const addClassSection = (items, className, classColor) => {
      if (yPos > 180) {
        doc.addPage();
        yPos = 20;
      }

      // Header da classe
      doc.setFillColor(...classColor);
      doc.rect(10, yPos, 277, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`CLASSE ${className} - ${className === 'A' ? 'Alta Prioridade' : 'Média Prioridade'} (${items.length} itens)`, 12, yPos + 5.5);
      yPos += 9;

      // Cabeçalho da tabela
      doc.setFillColor(248, 250, 252);
      doc.rect(10, yPos, 277, 7, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(7);
      doc.text('Cód', 12, yPos + 5);
      doc.text('Descrição', 32, yPos + 5);
      doc.text('Un', 160, yPos + 5);
      doc.text('Qtd', 180, yPos + 5, { align: 'right' });
      doc.text('Valor Unit.', 215, yPos + 5, { align: 'right' });
      doc.text('Valor Total', 250, yPos + 5, { align: 'right' });
      doc.text('Cotação', 277, yPos + 5, { align: 'right' });
      yPos += 8;

      doc.setFont(undefined, 'normal');
      doc.setFontSize(7);
      
      items.forEach(item => {
        if (yPos > 185) {
          doc.addPage();
          yPos = 20;
        }

        doc.text(item.codigo || '', 12, yPos + 4);
        const descMaxWidth = 125;
        const descLines = doc.splitTextToSize(item.descricao || '', descMaxWidth);
        doc.text(descLines.slice(0, 2), 32, yPos + 4);
        doc.text(item.unidade || '', 160, yPos + 4);
        doc.text((item.quantidade_total || 0).toFixed(2), 180, yPos + 4, { align: 'right' });
        doc.text(formatCurrency(item.valor_unitario), 215, yPos + 4, { align: 'right' });
        doc.text(formatCurrency(item.valor_total), 250, yPos + 4, { align: 'right' });
        
        // Célula de cotação
        doc.setFillColor(254, 243, 199);
        doc.rect(255, yPos, 22, 6, 'F');

        yPos += descLines.length > 1 ? 7 : 5;
      });

      yPos += 3;
    };

    // Adicionar classes
    if (classA.length > 0) {
      addClassSection(classA, 'A', [239, 68, 68]);
    }
    if (classB.length > 0) {
      addClassSection(classB, 'B', [245, 158, 11]);
    }

    // Resumo
    if (yPos > 150) {
      doc.addPage();
      yPos = 20;
    }

    yPos += 10;
    doc.setFillColor(226, 232, 240);
    doc.rect(10, yPos, 277, 25, 'F');
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    yPos += 7;
    doc.text('RESUMO DO MAPA', pageWidth / 2, yPos, { align: 'center' });
    
    doc.setFontSize(9);
    yPos += 8;
    doc.text('Total Classe A:', 200, yPos);
    doc.text(formatCurrency(totalA), 270, yPos, { align: 'right' });
    yPos += 6;
    doc.text('Total Classe B:', 200, yPos);
    doc.text(formatCurrency(totalB), 270, yPos, { align: 'right' });
    yPos += 6;
    doc.setFontSize(10);
    doc.text('TOTAL GERAL:', 200, yPos);
    doc.text(formatCurrency(totalGeral), 270, yPos, { align: 'right' });

    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    const fileName = `Mapa_Cotacoes_${budgetData?.descricao || 'Orcamento'}_${format(new Date(), 'yyyyMMdd')}.pdf`.replace(/[/\\?%*:|"<>]/g, '_');
    doc.save(fileName);

    return { success: true, message: 'Mapa exportado em PDF com sucesso!' };
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