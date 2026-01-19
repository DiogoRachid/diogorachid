import { format } from 'date-fns';
import * as XLSX from 'xlsx';

// Exportar para PDF (HTML estático)
export const exportMeasurementToPDF = (measurement, items, stages) => {
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const fmtNum = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
  
  const logoUrl = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/user_690c7efb29582ad524a0ff3e/fb3eac426_logofundoclaro.jpg";
  const dateStr = format(new Date(), 'dd/MM/yyyy');
  
  const projectName = measurement.obra_nome || 'N/A';
  const budgetName = measurement.orcamento_nome || 'N/A';
  
  let htmlBody = '';
  
  // Agrupar itens por etapa
  const itemsByStage = {};
  items.forEach(item => {
    const stageId = item.stage_id || 'sem_etapa';
    if (!itemsByStage[stageId]) {
      itemsByStage[stageId] = [];
    }
    itemsByStage[stageId].push(item);
  });
  
  // Renderizar por etapa
  stages.forEach(stage => {
    const stageItems = itemsByStage[stage.id] || [];
    if (stageItems.length === 0) return;
    
    const stageTotal = stageItems.reduce((sum, item) => sum + (item.valor_executado || 0), 0);
    
    htmlBody += `
      <div class="stage-header">
        <span>${stage.ordem}. ${stage.nome}</span>
        <span>${fmt(stageTotal)}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 8%">Código</th>
            <th style="width: 30%">Descrição</th>
            <th style="width: 6%">Unid</th>
            <th style="width: 10%; text-align: right">Qtd Orç.</th>
            <th style="width: 10%; text-align: right">Qtd Prev.</th>
            <th style="width: 10%; text-align: right">Qtd Exec.</th>
            <th style="width: 10%; text-align: right">Unit.</th>
            <th style="width: 16%; text-align: right">Valor Exec.</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    stageItems.forEach(item => {
      htmlBody += `
        <tr>
          <td>${item.codigo || ''}</td>
          <td>${item.descricao || ''}</td>
          <td style="text-align: center">${item.unidade || ''}</td>
          <td style="text-align: right">${fmtNum(item.quantidade_orcamento || 0)}</td>
          <td style="text-align: right">${fmtNum(item.quantidade_prevista_mes || 0)}</td>
          <td style="text-align: right">${fmtNum(item.quantidade_executada || 0)}</td>
          <td style="text-align: right">${fmt(item.valor_unitario || 0)}</td>
          <td style="text-align: right">${fmt(item.valor_executado || 0)}</td>
        </tr>
      `;
    });
    
    htmlBody += `
        </tbody>
      </table>
    `;
  });
  
  // Itens sem etapa
  const uncategorizedItems = itemsByStage['sem_etapa'] || [];
  if (uncategorizedItems.length > 0) {
    const stageTotal = uncategorizedItems.reduce((sum, item) => sum + (item.valor_executado || 0), 0);
    htmlBody += `
      <div class="stage-header">
        <span>Itens sem Etapa</span>
        <span>${fmt(stageTotal)}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 8%">Código</th>
            <th style="width: 30%">Descrição</th>
            <th style="width: 6%">Unid</th>
            <th style="width: 10%; text-align: right">Qtd Orç.</th>
            <th style="width: 10%; text-align: right">Qtd Prev.</th>
            <th style="width: 10%; text-align: right">Qtd Exec.</th>
            <th style="width: 10%; text-align: right">Unit.</th>
            <th style="width: 16%; text-align: right">Valor Exec.</th>
          </tr>
        </thead>
        <tbody>
    `;
    uncategorizedItems.forEach(item => {
      htmlBody += `
        <tr>
          <td>${item.codigo || ''}</td>
          <td>${item.descricao || ''}</td>
          <td style="text-align: center">${item.unidade || ''}</td>
          <td style="text-align: right">${fmtNum(item.quantidade_orcamento || 0)}</td>
          <td style="text-align: right">${fmtNum(item.quantidade_prevista_mes || 0)}</td>
          <td style="text-align: right">${fmtNum(item.quantidade_executada || 0)}</td>
          <td style="text-align: right">${fmt(item.valor_unitario || 0)}</td>
          <td style="text-align: right">${fmt(item.valor_executado || 0)}</td>
        </tr>
      `;
    });
    htmlBody += `</tbody></table>`;
  }
  
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Medição ${measurement.numero_medicao} - ${budgetName}</title>
      <style>
        @page { margin: 15mm; size: A4; }
        body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 10px; color: #333; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .logo { height: 50px; }
        .company-info { text-align: right; }
        .company-name { font-size: 14px; font-weight: bold; text-transform: uppercase; }
        .project-info { margin-bottom: 5px; }
        
        .measurement-info { background-color: #f1f5f9; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
        
        .stage-header { background-color: #f1f5f9; padding: 5px 10px; font-weight: bold; font-size: 11px; border-bottom: 1px solid #cbd5e1; margin-top: 15px; display: flex; justify-content: space-between; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
        th { background-color: #fff; border-bottom: 1px solid #000; padding: 4px; text-align: left; font-weight: bold; font-size: 9px; }
        td { border-bottom: 1px solid #e2e8f0; padding: 4px; font-size: 9px; }
        tr:last-child td { border-bottom: none; }
        
        .summary-section { margin-top: 30px; page-break-inside: avoid; width: 50%; margin-left: auto; }
        .summary-table th { background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; }
        .summary-table td { border-bottom: 1px solid #e2e8f0; }
        .total-row td { background-color: #f1f5f9; border-top: 2px solid #333; padding: 8px 4px; }
        
        @media print {
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="${logoUrl}" class="logo" alt="Logo" />
        <div class="company-info">
          <div class="company-name">Virtual Construções</div>
          <div class="project-info">
            <div><strong>Obra:</strong> ${projectName}</div>
            <div><strong>Orçamento:</strong> ${budgetName}</div>
            <div>Data: ${dateStr}</div>
          </div>
        </div>
      </div>
      
      <h2 style="text-align: center; margin-bottom: 15px;">MEDIÇÃO Nº ${measurement.numero_medicao}</h2>
      
      <div class="measurement-info">
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
          <div><strong>Período:</strong> ${measurement.data_inicio ? format(new Date(measurement.data_inicio), 'dd/MM/yyyy') : ''} a ${measurement.data_fim ? format(new Date(measurement.data_fim), 'dd/MM/yyyy') : ''}</div>
          <div><strong>Mês Ref.:</strong> ${measurement.mes_referencia}</div>
        </div>
        <div><strong>Descrição:</strong> ${measurement.descricao || '-'}</div>
      </div>
      
      ${htmlBody}
      
      <div class="summary-section">
        <table class="summary-table">
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: right">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total Previsto</td>
              <td style="text-align: right">${fmt(measurement.total_previsto || 0)}</td>
            </tr>
            <tr class="total-row">
              <td><strong>TOTAL EXECUTADO</strong></td>
              <td style="text-align: right"><strong>${fmt(measurement.total_executado || 0)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;
  
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(fullHtml);
    win.document.close();
  } else {
    alert('Permita popups para visualizar o PDF.');
  }
};

// Exportar para Excel formatado
export const exportMeasurementToExcel = (measurement, items, stages) => {
  const wb = XLSX.utils.book_new();
  
  // Cabeçalho
  const header = [
    [`MEDIÇÃO Nº ${measurement.numero_medicao}`],
    ['Obra:', measurement.obra_nome || 'N/A'],
    ['Orçamento:', measurement.orcamento_nome || 'N/A'],
    ['Período:', `${measurement.data_inicio ? format(new Date(measurement.data_inicio), 'dd/MM/yyyy') : ''} a ${measurement.data_fim ? format(new Date(measurement.data_fim), 'dd/MM/yyyy') : ''}`],
    ['Mês Referência:', measurement.mes_referencia],
    ['Data:', format(new Date(), 'dd/MM/yyyy')],
    [],
    ['Etapa', 'Código', 'Descrição', 'Unidade', 'Qtd Orçamento', 'Qtd Prevista', 'Qtd Executada', 'Qtd Acumulada', 'Valor Unit.', 'Valor Executado', '% Executado']
  ];
  
  // Dados por etapa
  const data = [];
  stages.forEach(stage => {
    const stageItems = items.filter(item => item.stage_id === stage.id);
    if (stageItems.length === 0) return;
    
    stageItems.forEach(item => {
      data.push([
        stage.nome,
        item.codigo || '',
        item.descricao || '',
        item.unidade || '',
        item.quantidade_orcamento || 0,
        item.quantidade_prevista_mes || 0,
        item.quantidade_executada || 0,
        item.quantidade_acumulada || 0,
        item.valor_unitario || 0,
        item.valor_executado || 0,
        item.percentual_executado || 0
      ]);
    });
  });
  
  // Itens sem etapa
  const uncategorizedItems = items.filter(item => !item.stage_id);
  uncategorizedItems.forEach(item => {
    data.push([
      'Sem Etapa',
      item.codigo || '',
      item.descricao || '',
      item.unidade || '',
      item.quantidade_orcamento || 0,
      item.quantidade_prevista_mes || 0,
      item.quantidade_executada || 0,
      item.quantidade_acumulada || 0,
      item.valor_unitario || 0,
      item.valor_executado || 0,
      item.percentual_executado || 0
    ]);
  });
  
  // Totais
  const totalExec = items.reduce((sum, item) => sum + (item.valor_executado || 0), 0);
  const totalPrev = measurement.total_previsto || 0;
  
  const summary = [
    [],
    ['RESUMO'],
    ['Total Previsto:', totalPrev],
    ['Total Executado:', totalExec],
    ['Diferença:', totalExec - totalPrev]
  ];
  
  // Combinar tudo
  const sheetData = [...header, ...data, ...summary];
  
  // Criar worksheet
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  
  // Largura das colunas
  ws['!cols'] = [
    { wch: 20 },  // Etapa
    { wch: 12 },  // Código
    { wch: 40 },  // Descrição
    { wch: 8 },   // Unidade
    { wch: 12 },  // Qtd Orçamento
    { wch: 12 },  // Qtd Prevista
    { wch: 12 },  // Qtd Executada
    { wch: 12 },  // Qtd Acumulada
    { wch: 12 },  // Valor Unit.
    { wch: 14 },  // Valor Executado
    { wch: 12 }   // % Executado
  ];
  
  // Formatação
  const numFmt = '#,##0.00';
  const currencyFmt = 'R$ #,##0.00';
  const pctFmt = '0.00%';
  
  for (let row = 8; row < 8 + data.length; row++) {
    const rowIdx = row + 1;
    if (ws[`E${rowIdx}`]) ws[`E${rowIdx}`].z = numFmt;
    if (ws[`F${rowIdx}`]) ws[`F${rowIdx}`].z = numFmt;
    if (ws[`G${rowIdx}`]) ws[`G${rowIdx}`].z = numFmt;
    if (ws[`H${rowIdx}`]) ws[`H${rowIdx}`].z = numFmt;
    if (ws[`I${rowIdx}`]) ws[`I${rowIdx}`].z = currencyFmt;
    if (ws[`J${rowIdx}`]) ws[`J${rowIdx}`].z = currencyFmt;
    if (ws[`K${rowIdx}`]) ws[`K${rowIdx}`].z = pctFmt;
  }
  
  XLSX.utils.book_append_sheet(wb, ws, 'Medição');
  
  const fileName = `Medicao_${measurement.numero_medicao}_${measurement.orcamento_nome || 'Orcamento'}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
  XLSX.writeFile(wb, fileName);
};