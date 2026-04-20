import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { addDays, startOfDay, parseISO, isAfter, isBefore } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Buscar config da empresa com service role (sem autenticação)
    const settings = await base44.asServiceRole.entities.CompanySettings.list();
    if (!settings || settings.length === 0) {
      return Response.json({ error: 'Configurações da empresa não encontradas' }, { status: 400 });
    }

    const config = settings[0];
    if (!config.whatsapp_enabled || !config.whatsapp_recipients || config.whatsapp_recipients.length === 0) {
      return Response.json({ success: false, message: 'WhatsApp não configurado ou sem destinatários' });
    }

    // Coletar dados
    const today = startOfDay(new Date());
    const sevenDaysFromNow = addDays(today, 7);

    const [accountsPayable, accountsReceivable, documents, employeeContracts, investments, materialRequisitions] = await Promise.all([
      base44.entities.AccountPayable.list('', 1000).catch(() => []),
      base44.entities.AccountReceivable.list('', 1000).catch(() => []),
      base44.entities.Document.list('', 1000).catch(() => []),
      base44.entities.EmployeeContract.list('', 1000).catch(() => []),
      base44.entities.Investment.list('', 1000).catch(() => []),
      base44.entities.MaterialRequisition.list('', 1000).catch(() => []),
    ]);

    // Processar dados
    const todasAsContas = [...(accountsPayable || []), ...(accountsReceivable || [])];

    const contasHoje = todasAsContas.filter(c => {
      const vencimento = parseISO(c.data_vencimento);
      return isBefore(vencimento, addDays(today, 1)) && isAfter(vencimento, today);
    });

    const contas7Dias = todasAsContas.filter(c => {
      const vencimento = parseISO(c.data_vencimento);
      return isAfter(vencimento, today) && isBefore(vencimento, sevenDaysFromNow);
    });

    const docsHoje = (documents || []).filter(d => {
      if (!d.data_vencimento || d.sem_vencimento) return false;
      const vencimento = parseISO(d.data_vencimento);
      return isBefore(vencimento, addDays(today, 1)) && isAfter(vencimento, today);
    });

    const docs7Dias = (documents || []).filter(d => {
      if (!d.data_vencimento || d.sem_vencimento) return false;
      const vencimento = parseISO(d.data_vencimento);
      return isAfter(vencimento, today) && isBefore(vencimento, sevenDaysFromNow);
    });

    const contratosExperiencia = (employeeContracts || []).filter(ec => {
      if (!ec.data_fim) return false;
      const dataFim = parseISO(ec.data_fim);
      return isAfter(dataFim, today) && isBefore(dataFim, sevenDaysFromNow);
    });

    const valorInvestidoTotal = (investments || [])
      .filter(i => i.status === 'ativo')
      .reduce((sum, i) => sum + (i.valor_investido || 0), 0);

    const pedidosOntem = (materialRequisitions || []).filter(mr => {
      if (!mr.created_date) return false;
      const criacao = new Date(mr.created_date);
      const ontem = new Date(today);
      ontem.setDate(ontem.getDate() - 1);
      return criacao >= ontem && criacao < today;
    });

    // Construir mensagem
    const mensagem = `🏢 *Alerta Diário - ${config.nome_empresa || 'Empresa'}*\n\n` +
      `📅 ${new Intl.DateTimeFormat('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(today)}\n\n` +
      `💰 *Contas a Pagar/Receber:*\n` +
      `   • Hoje: ${contasHoje.length} vencimento(s)\n` +
      `   • Próximos 7 dias: ${contas7Dias.length} vencimento(s)\n\n` +
      `💵 *Investimentos:*\n` +
      `   • Valor Total Investido: R$ ${valorInvestidoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
      `📄 *Documentos:*\n` +
      `   • Vencimento Hoje: ${docsHoje.length} documento(s)\n` +
      `   • Próximos 7 dias: ${docs7Dias.length} documento(s)\n\n` +
      `👥 *RH - Contratos de Experiência:*\n` +
      `   • Próximos 7 dias: ${contratosExperiencia.length} contrato(s) a vencer\n\n` +
      `📦 *Logística:*\n` +
      `   • Pedidos (Ontem): ${pedidosOntem.length} solicitação(ões)`;

    // Configuração da Evolution API (lê das settings ou usa padrão)
    const evolutionUrl = config.evolution_api_url || 'http://localhost:8080';
    const evolutionApiKey = config.evolution_api_key || 'minha-chave-secreta';
    const instancia = config.evolution_api_instance || 'teste2';

    // Enviar mensagem para cada destinatário
    const resultados = [];
    console.log(`🔌 Conectando a: ${evolutionUrl}/message/sendText/${instancia}`);
    console.log(`📱 Destinatários: ${config.whatsapp_recipients.join(', ')}`);

    for (const numero of config.whatsapp_recipients) {
      const payload = {
        number: numero,
        text: mensagem
      };

      const url = `${evolutionUrl}/message/sendText/${instancia}`;
      console.log(`📤 Enviando para ${numero}...`);

      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey
          },
          body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        console.log(`✅ Response (${numero}):`, response.status, responseText);

        resultados.push({
          numero,
          sucesso: response.ok,
          status: response.status,
          mensagem: responseText
        });
      } catch (fetchError) {
        console.error(`❌ Erro ao enviar para ${numero}:`, fetchError.message);
        resultados.push({
          numero,
          sucesso: false,
          status: 'erro conexão',
          erro: fetchError.message
        });
      }
    }

    console.log('✅ Resultados finais:', resultados);

    return Response.json({
      success: true,
      message: 'Alertas processados',
      destinatarios: config.whatsapp_recipients.length,
      resultados
    });
  } catch (error) {
    console.error('Erro ao enviar alerta:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});