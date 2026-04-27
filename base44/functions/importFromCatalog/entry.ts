/**
 * importFromCatalog - Importa insumos e/ou serviços do catálogo mestre (Supabase)
 * para as tabelas locais do cliente (Input, Service, ServiceItem, etc.)
 *
 * Rotas (via campo "action" no body):
 *   - importInput     : Importa um insumo do catálogo mestre para a tabela local
 *   - importService   : Importa um serviço + itens de composição do catálogo mestre
 *   - importBulk      : Importa uma lista de insumos/serviços de uma vez
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY');

async function supabaseFetch(table, filters = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?`;
  const parts = Object.entries(filters).map(([k, v]) => `${k}=${v}`);
  url += parts.join('&');

  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`Supabase error [${res.status}]: ${await res.text()}`);
  return res.json();
}

async function importInput(base44, masterInput) {
  // Verifica se já existe pelo código
  const existing = await base44.asServiceRole.entities.Input.filter({ codigo: masterInput.codigo });
  if (existing.length > 0) {
    // Atualiza o existente com dados mais recentes
    await base44.asServiceRole.entities.Input.update(existing[0].id, {
      descricao: masterInput.descricao,
      unidade: masterInput.unidade,
      valor_unitario: masterInput.valor_unitario,
      categoria: masterInput.categoria,
      funcao: masterInput.funcao,
      horas_por_unidade: masterInput.horas_por_unidade,
      data_base: masterInput.data_base,
      fonte: masterInput.fonte
    });
    return { action: 'updated', id: existing[0].id, codigo: masterInput.codigo };
  }

  // Cria novo
  const created = await base44.asServiceRole.entities.Input.create({
    codigo: masterInput.codigo,
    descricao: masterInput.descricao,
    unidade: masterInput.unidade,
    valor_unitario: masterInput.valor_unitario,
    categoria: masterInput.categoria,
    funcao: masterInput.funcao,
    horas_por_unidade: masterInput.horas_por_unidade,
    data_base: masterInput.data_base,
    fonte: masterInput.fonte
  });
  return { action: 'created', id: created.id, codigo: masterInput.codigo };
}

async function importServiceWithItems(base44, masterServiceCodigo) {
  // 1. Busca o serviço no Supabase
  const services = await supabaseFetch('Service', { 'codigo': `eq.${masterServiceCodigo}` });
  if (!services.length) throw new Error(`Serviço ${masterServiceCodigo} não encontrado no catálogo mestre`);
  const masterService = services[0];

  // 2. Verifica/cria o serviço localmente
  const existingService = await base44.asServiceRole.entities.Service.filter({ codigo: masterService.codigo });
  let localServiceId;
  if (existingService.length > 0) {
    await base44.asServiceRole.entities.Service.update(existingService[0].id, {
      descricao: masterService.descricao,
      unidade: masterService.unidade,
      data_base: masterService.data_base,
      custo_material: masterService.custo_material,
      custo_mao_obra: masterService.custo_mao_obra,
      custo_total: masterService.custo_total,
      nivel_max_dependencia: masterService.nivel_max_dependencia,
      ativo: true
    });
    localServiceId = existingService[0].id;
  } else {
    const created = await base44.asServiceRole.entities.Service.create({
      codigo: masterService.codigo,
      descricao: masterService.descricao,
      unidade: masterService.unidade,
      data_base: masterService.data_base,
      custo_material: masterService.custo_material || 0,
      custo_mao_obra: masterService.custo_mao_obra || 0,
      custo_total: masterService.custo_total || 0,
      nivel_max_dependencia: masterService.nivel_max_dependencia || 0,
      ativo: true
    });
    localServiceId = created.id;
  }

  // 3. Busca os itens de composição do Supabase
  const masterItems = await supabaseFetch('ServiceItem', { 'servico_codigo': `eq.${masterServiceCodigo}`, 'order': 'ordem.asc' });

  // 4. Importa os insumos/serviços filhos recursivamente
  const importedItems = [];
  for (const item of masterItems) {
    if (item.tipo_item === 'INSUMO') {
      // Importa o insumo filho
      const inputsResult = await supabaseFetch('Input', { 'codigo': `eq.${item.item_codigo}` });
      if (inputsResult.length > 0) {
        await importInput(base44, inputsResult[0]);
        // Busca o id local do insumo
        const localInput = await base44.asServiceRole.entities.Input.filter({ codigo: item.item_codigo });
        if (localInput.length > 0) {
          importedItems.push({ ...item, local_item_id: localInput[0].id });
        }
      }
    } else if (item.tipo_item === 'SERVICO') {
      // Importa o serviço filho recursivamente
      await importServiceWithItems(base44, item.item_codigo);
      const localSvc = await base44.asServiceRole.entities.Service.filter({ codigo: item.item_codigo });
      if (localSvc.length > 0) {
        importedItems.push({ ...item, local_item_id: localSvc[0].id });
      }
    }
  }

  // 5. Remove itens de composição existentes e recria
  const existingItems = await base44.asServiceRole.entities.ServiceItem.filter({ servico_id: localServiceId });
  for (const ei of existingItems) {
    await base44.asServiceRole.entities.ServiceItem.delete(ei.id);
  }

  for (const item of importedItems) {
    await base44.asServiceRole.entities.ServiceItem.create({
      servico_id: localServiceId,
      servico_codigo: masterServiceCodigo,
      tipo_item: item.tipo_item,
      item_id: item.local_item_id,
      item_codigo: item.item_codigo,
      quantidade: item.quantidade,
      categoria: item.categoria,
      ordem: item.ordem,
      custo_unitario_snapshot: item.custo_unitario_snapshot,
      custo_total_item: item.custo_total_item
    });
  }

  return {
    service: { id: localServiceId, codigo: masterServiceCodigo },
    items_imported: importedItems.length
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'importInput') {
      const { masterInput } = body;
      if (!masterInput) return Response.json({ error: 'masterInput é obrigatório' }, { status: 400 });
      const result = await importInput(base44, masterInput);
      return Response.json({ success: true, result });
    }

    if (action === 'importService') {
      const { serviceCode } = body;
      if (!serviceCode) return Response.json({ error: 'serviceCode é obrigatório' }, { status: 400 });
      const result = await importServiceWithItems(base44, serviceCode);
      return Response.json({ success: true, result });
    }

    if (action === 'importBulk') {
      const { inputs = [], serviceCodes = [] } = body;
      const results = { inputs: [], services: [] };

      for (const inp of inputs) {
        results.inputs.push(await importInput(base44, inp));
      }
      for (const code of serviceCodes) {
        results.services.push(await importServiceWithItems(base44, code));
      }
      return Response.json({ success: true, results });
    }

    return Response.json({ error: `Ação desconhecida: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});