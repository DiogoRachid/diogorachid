/**
 * Parser de Nota Fiscal XML (NF-e v3.10)
 * Extrai dados da estrutura completa do XML da NFe
 */

export function parseInvoiceXml(xmlContent) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    // Verificar erros no parsing
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('XML inválido ou malformado');
    }

    // Navegar pela estrutura: nfeProc > NFe > infNFe
    const infNFe = xmlDoc.querySelector('infNFe');
    if (!infNFe) {
      throw new Error('Estrutura XML não corresponde a uma NF-e válida');
    }

    // ─────────────────────────────────────────────────
    // INFORMAÇÕES DE IDENTIFICAÇÃO (ide)
    // ─────────────────────────────────────────────────
    const ide = infNFe.querySelector('ide');
    const invoiceNumber = ide?.querySelector('nNF')?.textContent || '';
    const invoiceSeries = ide?.querySelector('serie')?.textContent || '';
    const emissionDate = ide?.querySelector('dhEmi')?.textContent || '';
    const invoiceType = ide?.querySelector('tpNF')?.textContent || '1'; // 1 = saída, 2 = entrada

    // ─────────────────────────────────────────────────
    // INFORMAÇÕES DO EMITENTE (emit)
    // ─────────────────────────────────────────────────
    const emit = infNFe.querySelector('emit');
    const supplierCnpj = emit?.querySelector('CNPJ')?.textContent || '';
    const supplierName = emit?.querySelector('xNome')?.textContent || '';
    const supplierFantasyName = emit?.querySelector('xFant')?.textContent || '';

    // Endereço do Emitente
    const enderEmit = emit?.querySelector('enderEmit');
    const supplierAddress = {
      street: enderEmit?.querySelector('xLgr')?.textContent || '',
      number: enderEmit?.querySelector('nro')?.textContent || '',
      complement: enderEmit?.querySelector('xCpl')?.textContent || '',
      neighborhood: enderEmit?.querySelector('xBairro')?.textContent || '',
      city: enderEmit?.querySelector('xMun')?.textContent || '',
      state: enderEmit?.querySelector('UF')?.textContent || '',
      zipCode: enderEmit?.querySelector('CEP')?.textContent || '',
    };

    // ─────────────────────────────────────────────────
    // INFORMAÇÕES DO DESTINATÁRIO (dest)
    // ─────────────────────────────────────────────────
    const dest = infNFe.querySelector('dest');
    const buyerCnpj = dest?.querySelector('CNPJ')?.textContent || '';
    const buyerName = dest?.querySelector('xNome')?.textContent || '';

    // Endereço do Destinatário
    const enderDest = dest?.querySelector('enderDest');
    const buyerAddress = {
      street: enderDest?.querySelector('xLgr')?.textContent || '',
      number: enderDest?.querySelector('nro')?.textContent || '',
      complement: enderDest?.querySelector('xCpl')?.textContent || '',
      neighborhood: enderDest?.querySelector('xBairro')?.textContent || '',
      city: enderDest?.querySelector('xMun')?.textContent || '',
      state: enderDest?.querySelector('UF')?.textContent || '',
      zipCode: enderDest?.querySelector('CEP')?.textContent || '',
    };

    // ─────────────────────────────────────────────────
    // ITENS DA NOTA FISCAL (det)
    // ─────────────────────────────────────────────────
    const items = [];
    const dets = infNFe.querySelectorAll('det');

    dets.forEach((det) => {
      const prod = det.querySelector('prod');
      const imposto = det.querySelector('imposto');

      const productCode = prod?.querySelector('cProd')?.textContent || '';
      const productName = prod?.querySelector('xProd')?.textContent || '';
      const ncm = prod?.querySelector('NCM')?.textContent || '';
      const unit = prod?.querySelector('uTrib')?.textContent || 'PC';
      const quantity = parseFloat(prod?.querySelector('qTrib')?.textContent || 0);
      const unitPrice = parseFloat(prod?.querySelector('vUnTrib')?.textContent || 0);
      const totalValue = parseFloat(prod?.querySelector('vProd')?.textContent || 0);

      // Impostos
      const icms = imposto?.querySelector('ICMS');
      const icmsValue = parseFloat(icms?.querySelector('vICMS')?.textContent || 0);
      const ipi = imposto?.querySelector('IPI');
      const ipiValue = parseFloat(ipi?.querySelector('vIPI')?.textContent || 0);
      const pis = imposto?.querySelector('PIS');
      const pisValue = parseFloat(pis?.querySelector('vPIS')?.textContent || 0);
      const cofins = imposto?.querySelector('COFINS');
      const cofinsValue = parseFloat(cofins?.querySelector('vCOFINS')?.textContent || 0);

      items.push({
        productCode,
        productName,
        ncm,
        unit,
        quantity,
        unitPrice,
        totalValue,
        icmsValue,
        ipiValue,
        pisValue,
        cofinsValue,
      });
    });

    // ─────────────────────────────────────────────────
    // TOTAIS (total)
    // ─────────────────────────────────────────────────
    const total = infNFe.querySelector('total');
    const icmsTot = total?.querySelector('ICMSTot');
    const totalTaxableBase = parseFloat(icmsTot?.querySelector('vBC')?.textContent || 0);
    const totalIcms = parseFloat(icmsTot?.querySelector('vICMS')?.textContent || 0);
    const totalIpi = parseFloat(icmsTot?.querySelector('vIPI')?.textContent || 0);
    const totalPis = parseFloat(icmsTot?.querySelector('vPIS')?.textContent || 0);
    const totalCofins = parseFloat(icmsTot?.querySelector('vCOFINS')?.textContent || 0);
    const totalAmount = parseFloat(icmsTot?.querySelector('vNF')?.textContent || 0);

    // ─────────────────────────────────────────────────
    // INFORMAÇÕES DE COBRANÇA (cobr) - Duplicatas
    // ─────────────────────────────────────────────────
    const installments = [];
    const cobr = infNFe.querySelector('cobr');
    if (cobr) {
      const dups = cobr.querySelectorAll('dup');
      dups.forEach((dup) => {
        installments.push({
          number: dup.querySelector('nDup')?.textContent || '',
          dueDate: dup.querySelector('dVenc')?.textContent || '',
          value: parseFloat(dup.querySelector('vDup')?.textContent || 0),
        });
      });
    }

    // ─────────────────────────────────────────────────
    // INFORMAÇÕES ADICIONAIS (infAdic)
    // ─────────────────────────────────────────────────
    const infAdic = infNFe.querySelector('infAdic');
    const additionalInfo = infAdic?.querySelector('infCpl')?.textContent || '';

    // Extrair Ficha da Obra (Projeto/Work Number) do campo infCpl
    const workMatch = additionalInfo.match(/Ficha\s+da\s+Obra:\s*(\d+)/i);
    const workNumber = workMatch ? workMatch[1] : '';

    // Extrair CNPJ da Construtora (para validar se é a nossa empresa)
    const contractorMatch = additionalInfo.match(/CNPJ\s+Construtora:\s*(\d+)/i);
    const contractorCnpj = contractorMatch ? contractorMatch[1] : '';

    // ─────────────────────────────────────────────────
    // RETORNO ESTRUTURADO
    // ─────────────────────────────────────────────────
    return {
      invoiceNumber,
      invoiceSeries,
      emissionDate,
      invoiceType: invoiceType === '1' ? 'saída' : 'entrada',
      supplier: {
        cnpj: supplierCnpj,
        name: supplierName,
        fantasyName: supplierFantasyName,
        address: supplierAddress,
      },
      buyer: {
        cnpj: buyerCnpj,
        name: buyerName,
        address: buyerAddress,
      },
      items,
      totals: {
        taxableBase: totalTaxableBase,
        icms: totalIcms,
        ipi: totalIpi,
        pis: totalPis,
        cofins: totalCofins,
        amount: totalAmount,
      },
      installments,
      additionalInfo: {
        workNumber,
        contractorCnpj,
        notes: additionalInfo,
      },
    };
  } catch (error) {
    throw new Error(`Erro ao processar XML: ${error.message}`);
  }
}