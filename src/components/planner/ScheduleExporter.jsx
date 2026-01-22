import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';

export async function exportScheduleXLSX(schedule, stages, items, months, budgetData) {
  try {
    // Criar workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cronograma');

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
    worksheet.mergeCells(`A${currentRow}:${String.fromCharCode(65 + months + 1)}${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = 'CRONOGRAMA FÍSICO-FINANCEIRO';
    titleCell.font = { size: 18, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 2;

    // Dados
    worksheet.getRow(currentRow).getCell(1).value = 'Obra:';
    worksheet.getRow(currentRow).getCell(1).font = { bold: true };
    worksheet.getRow(currentRow).getCell(2).value = budgetData?.obra_nome || '-';
    currentRow++;
    worksheet.getRow(currentRow).getCell(1).value = 'Orçamento:';
    worksheet.getRow(currentRow).getCell(1).font = { bold: true };
    worksheet.getRow(currentRow).getCell(2).value = budgetData?.descricao || '-';
    currentRow++;
    worksheet.getRow(currentRow).getCell(1).value = 'Duração:';
    worksheet.getRow(currentRow).getCell(1).font = { bold: true };
    worksheet.getRow(currentRow).getCell(2).value = `${months} meses`;
    currentRow += 2;

    // Cabeçalho da tabela
    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell(1).value = 'Etapa';
    headerRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2962FF' } };
    headerRow.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    
    for (let m = 1; m <= months; m++) {
      const cell = headerRow.getCell(m + 1);
      cell.value = `Mês ${m}`;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2962FF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }
    
    headerRow.getCell(months + 2).value = 'Total';
    headerRow.getCell(months + 2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.getCell(months + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2962FF' } };
    headerRow.getCell(months + 2).alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.getCell(months + 2).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    currentRow++;

    // Dados das etapas
    const sortedStages = stages.sort((a, b) => a.ordem - b.ordem);
    
    sortedStages.forEach(stage => {
      const stageSchedule = schedule[stage.id] || { percentages: Array(months).fill(0), total: 0 };
      const row = worksheet.getRow(currentRow);
      
      row.getCell(1).value = stage.nome;
      row.getCell(1).font = { bold: true };
      row.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      
      for (let m = 0; m < months; m++) {
        const cell = row.getCell(m + 2);
        const value = stageSchedule.percentages[m] || 0;
        cell.value = parseFloat((value / 100).toFixed(4));
        cell.numFmt = '0.00%';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        
        if (value > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
        }
      }
      
      const totalCell = row.getCell(months + 2);
      totalCell.value = parseFloat((stageSchedule.total / 100).toFixed(4));
      totalCell.numFmt = '0.00%';
      totalCell.font = { bold: true };
      totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
      totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      totalCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      
      currentRow++;
    });

    // Largura das colunas
    const columns = [{ width: 30 }];
    for (let i = 0; i < months + 1; i++) {
      columns.push({ width: 10 });
    }
    worksheet.columns = columns;

    // Exportar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Cronograma_${budgetData?.descricao || 'Orcamento'}.xlsx`.replace(/[/\\?%*:|"<>]/g, '_');
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);

    return { success: true, message: 'Cronograma exportado em XLSX!' };
  } catch (error) {
    console.error('Erro ao exportar XLSX:', error);
    return { success: false, message: 'Erro: ' + error.message };
  }
}

export async function exportSchedulePDF(schedule, stages, items, months, budgetData) {
  try {
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
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('CRONOGRAMA FÍSICO-FINANCEIRO', pageWidth / 2, yPos + 8, { align: 'center' });
    
    yPos += 25;
    
    // Dados
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Obra: ${budgetData?.obra_nome || '-'}`, 15, yPos);
    yPos += 5;
    doc.text(`Orçamento: ${budgetData?.descricao || '-'}`, 15, yPos);
    yPos += 5;
    doc.text(`Duração: ${months} meses`, 15, yPos);
    
    yPos += 12;

    // Cabeçalho da tabela
    const colWidth = Math.min(20, (pageWidth - 80) / months);
    const tableStartX = 15;
    
    doc.setFillColor(41, 98, 255);
    doc.rect(tableStartX, yPos, 50, 7, 'F');
    for (let m = 1; m <= months; m++) {
      doc.rect(tableStartX + 50 + (m - 1) * colWidth, yPos, colWidth, 7, 'F');
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('Etapa', tableStartX + 2, yPos + 5);
    
    for (let m = 1; m <= months; m++) {
      doc.text(`M${m}`, tableStartX + 50 + (m - 1) * colWidth + colWidth / 2, yPos + 5, { align: 'center' });
    }
    yPos += 8;

    // Dados
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    
    const sortedStages = stages.sort((a, b) => a.ordem - b.ordem);
    
    sortedStages.forEach(stage => {
      if (yPos > 180) {
        doc.addPage();
        yPos = 20;
      }

      const stageSchedule = schedule[stage.id] || { percentages: Array(months).fill(0), total: 0 };
      
      doc.setFont(undefined, 'bold');
      doc.text(stage.nome.substring(0, 25), tableStartX + 2, yPos + 4);
      doc.setFont(undefined, 'normal');
      
      for (let m = 0; m < months; m++) {
        const value = stageSchedule.percentages[m] || 0;
        if (value > 0) {
          doc.setFillColor(224, 242, 254);
          doc.rect(tableStartX + 50 + m * colWidth, yPos, colWidth, 6, 'F');
          doc.text(`${(value).toFixed(0)}%`, tableStartX + 50 + m * colWidth + colWidth / 2, yPos + 4, { align: 'center' });
        } else {
          doc.text('-', tableStartX + 50 + m * colWidth + colWidth / 2, yPos + 4, { align: 'center' });
        }
      }
      
      yPos += 6;
    });

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

    const fileName = `Cronograma_${budgetData?.descricao || 'Orcamento'}.pdf`.replace(/[/\\?%*:|"<>]/g, '_');
    doc.save(fileName);

    return { success: true, message: 'Cronograma exportado em PDF!' };
  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    return { success: false, message: 'Erro: ' + error.message };
  }
}