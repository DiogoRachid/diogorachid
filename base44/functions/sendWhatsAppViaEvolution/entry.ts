import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { addDays, startOfDay, parseISO, isAfter, isBefore } from 'npm:date-fns@3.6.0';

const DEFAULT_MODULOS = [
  'contas_pagar_receber',
  'patrimonio',
  'documentos',
  'rh_contratos',
  'logistica',
  'licitacoes'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const settings = await base44.asServiceRole.entities.CompanySettings.list();
    if (!settings || settings.length === 0) {
      return Response.json({ error: 'Configurações da empresa não encontradas' }, { status: 400 });
    }

    const config = settings[0];
    if (!config.whatsapp_enabled || !config.whatsapp_recipients || config.whatsapp_recipients.length === 0) {
      return Response.json({ success: false, message: 'WhatsApp não configurado ou sem destinatários' });
    }

    const modulos = (config.whatsapp_modulos && config.whatsapp_modulos.length > 0)
      ? config.whatsapp_modulos
      : DEFAULT_MODULOS;

    const today = startOfDay(new Date());
    const sevenDaysFromNow = addDays(today, 7);

    // Buscar dados apenas dos módulos ativos
    const [
      accountsPayable, accountsReceivable,
      documents, employeeContracts,
      investments, materialRequisitions,
      investmentHistory, licitacoes
    ] = await Promise.all([
      modulos.includes('contas_pagar_receber') ? base44.entities.AccountPayable.list('', 1000).catch(() => []) : [],
      modulos.includes('contas_pagar_receber') ? base44.entities.AccountReceivable.list('', 1000).catch(() => []) : [],
      modulos.includes('documentos') ? base44.entities.Document.list('', 1000).catch(() => []) : [],
      modulos.includes('rh_contratos') ? base44.entities.EmployeeContract.list('', 1000).catch(() => []) : [],
      modulos.includes('patrimonio') ? base44.entities.Investment.list('', 1000).catch(() => []) : [],
      modulos.includes('logistica') ? base44.entities.MaterialRequisition.list('', 1000).catch(() => []) : [],
      modulos.includes('patrimonio') ? base44.entities.InvestmentHistory.list('', 1000).catch(() => []) : [],
      modulos.includes('licitacoes') ? base44.entities.Licitacao.list('', 500).catch(() => []) : [],
    ]);

    let linhas = [];

    // Módulo: Contas a Pagar/Receber
    if (modulos.includes('contas_pagar_receber')) {
      const todasAsContas = [...accountsPayable, ...accountsReceivable];
      const contasHoje = todasAsContas.filter(c => {
        const v = parseISO(c.data_vencimento);
        return isBefore(v, addDays(today, 1)) && isAfter(v, today);
      });
      const contas7Dias = todasAsContas.filter(c => {
        const v = parseISO(c.data_vencimento);
        return isAfter(v, today) && isBefore(v, sevenDaysFromNow);
      });
      linhas.push(
        `💰 *Contas a Pagar/Receber:*`,
        `   • Hoje: ${contasHoje.length} vencimento(s)`,
        `   • Próximos 7 dias: ${contas7Dias.length} vencimento(s)`
      );
    }

    // Módulo: Patrimônio
    if (modulos.includes('patrimonio')) {
      const latestHistory = (investmentHistory || []).sort((a, b) => {
        const da = a.data_base ? new Date(a.data_base.split('/').reverse().join('-')) : new Date(0);
        const db = b.data_base ? new Date(b.data_base.split('/').reverse().join('-')) : new Date(0);
        return db - da;
      })[0];
      const patrimonioTotal = latestHistory?.valor_total_atual ||
        (investments || []).filter(i => i.status === 'ativo').reduce((s, i) => s + (i.valor_atual || 0), 0);
      linhas.push(
        `💵 *Patrimônio Total:*`,
        `   • R$ ${patrimonioTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      );
    }

    // Módulo: Documentos
    if (modulos.includes('documentos')) {
      const docsHoje = (documents || []).filter(d => {
        if (!d.data_vencimento || d.sem_vencimento) return false;
        const v = parseISO(d.data_vencimento);
        return isBefore(v, addDays(today, 1)) && isAfter(v, today);
      });
      const docs7Dias = (documents || []).filter(d => {
        if (!d.data_vencimento || d.sem_vencimento) return false;
        const v = parseISO(d.data_vencimento);
        return isAfter(v, today) && isBefore(v, sevenDaysFromNow);
      });
      linhas.push(
        `📄 *Documentos:*`,
        `   • Vencimento Hoje: ${docsHoje.length} documento(s)`,
        `   • Próximos 7 dias: ${docs7Dias.length} documento(s)`
      );
    }

    // Módulo: RH – Contratos
    if (modulos.includes('rh_contratos')) {
      const contratosExp = (employeeContracts || []).filter(ec => {
        if (!ec.data_fim) return false;
        const dataFim = parseISO(ec.data_fim);
        return isAfter(dataFim, today) && isBefore(dataFim, sevenDaysFromNow);
      });
      linhas.push(
        `👥 *RH – Contratos de Experiência:*`,
        `   • Próximos 7 dias: ${contratosExp.length} contrato(s) a vencer`
      );
    }

    // Módulo: Logística
    if (modulos.includes('logistica')) {
      const ontem = new Date(today);
      ontem.setDate(ontem.getDate() - 1);
      const pedidosOntem = (materialRequisitions || []).filter(mr => {
        if (!mr.created_date) return false;
        const criacao = new Date(mr.created_date);
        return criacao >= ontem && criacao < today;
      });
      linhas.push(
        `📦 *Logística:*`,
        `   • Pedidos (Ontem): ${pedidosOntem.length} solicitação(ões)`
      );
    }

    // Módulo: Licitações
    if (modulos.includes('licitacoes')) {
      const proximas = (licitacoes || [])
        .filter(l => l.data_abertura && isAfter(parseISO(l.data_abertura), today) && l.status !== 'cancelada')
        .sort((a, b) => new Date(a.data_abertura) - new Date(b.data_abertura))
        .slice(0, 3);
      const participando = (licitacoes || []).filter(l => l.status === 'participando');
      const encerradas = (licitacoes || []).filter(l => l.status === 'encerrada' && l.participou);
      const ganhas = encerradas.filter(l => l.ganhou);
      linhas.push(`🏛️ *Licitações:*`);
      linhas.push(`   • Em andamento: ${participando.length}`);
      if (ganhas.length > 0) linhas.push(`   • Ganhas (total): ${ganhas.length} de ${encerradas.length}`);
      if (proximas.length > 0) {
        linhas.push(`   • Próximas aberturas:`);
        proximas.forEach(l => {
          const data = new Date(l.data_abertura + 'T00:00:00').toLocaleDateString('pt-BR');
          linhas.push(`     - ${l.nome_obra} (${data})`);
        });
      }
    }

    const dataFmt = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }).format(today);

    const mensagem = `🏢 *Alerta Diário - ${config.nome_empresa || 'Empresa'}*\n\n📅 ${dataFmt}\n\n` + linhas.join('\n');

    const evolutionUrl = config.evolution_api_url || 'http://localhost:8080';
    const evolutionApiKey = config.evolution_api_key || 'minha-chave-secreta';
    const instancia = config.evolution_api_instance || 'teste2';

    const resultados = [];
    for (const numero of config.whatsapp_recipients) {
      try {
        const response = await fetch(`${evolutionUrl}/message/sendText/${instancia}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
          body: JSON.stringify({ number: numero, text: mensagem })
        });
        const responseText = await response.text();
        resultados.push({ numero, sucesso: response.ok, status: response.status, mensagem: responseText });
      } catch (fetchError) {
        resultados.push({ numero, sucesso: false, status: 'erro conexão', erro: fetchError.message });
      }
    }

    return Response.json({
      success: true,
      message: 'Alertas processados',
      destinatarios: config.whatsapp_recipients.length,
      modulos_ativos: modulos,
      resultados
    });
  } catch (error) {
    console.error('Erro ao enviar alerta:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});