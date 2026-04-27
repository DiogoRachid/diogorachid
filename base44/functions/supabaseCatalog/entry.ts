/**
 * supabaseCatalog - Funções para acesso ao catálogo mestre de insumos e serviços no Supabase
 *
 * Rotas (via campo "action" no body):
 *   - searchInputs       : Busca insumos no catálogo mestre
 *   - searchServices     : Busca serviços/composições no catálogo mestre
 *   - getServiceItems    : Retorna os itens de composição de um serviço
 *   - getInputPriceHistory  : Histórico de preços de um insumo
 *   - getServicePriceHistory: Histórico de preços de um serviço
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY');

async function supabaseQuery(table, params = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?`;

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const queryParts = [];

  if (params.select) queryParts.push(`select=${params.select}`);
  if (params.filters) {
    for (const [key, val] of Object.entries(params.filters)) {
      queryParts.push(`${key}=${val}`);
    }
  }
  if (params.order) queryParts.push(`order=${params.order}`);
  if (params.limit) queryParts.push(`limit=${params.limit}`);
  if (params.offset) queryParts.push(`offset=${params.offset}`);

  url += queryParts.join('&');

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error [${res.status}]: ${err}`);
  }
  return res.json();
}

async function handleSearchInputs(body) {
  const { search = '', categoria, limit = 50, offset = 0 } = body;
  const filters = {};

  if (search) {
    // ilike para busca parcial (case-insensitive)
    filters['or'] = `(descricao.ilike.*${search}*,codigo.ilike.*${search}*)`;
  }
  if (categoria) {
    filters['categoria'] = `eq.${categoria}`;
  }

  const data = await supabaseQuery('Input', {
    select: 'id,codigo,descricao,unidade,valor_unitario,categoria,funcao,horas_por_unidade,data_base,fonte',
    filters,
    order: 'descricao.asc',
    limit,
    offset
  });
  return { data };
}

async function handleSearchServices(body) {
  const { search = '', limit = 50, offset = 0 } = body;
  const filters = {};

  if (search) {
    filters['or'] = `(descricao.ilike.*${search}*,codigo.ilike.*${search}*)`;
  }

  const data = await supabaseQuery('Service', {
    select: 'id,codigo,descricao,unidade,data_base,custo_material,custo_mao_obra,custo_total,nivel_max_dependencia',
    filters: { ...filters, 'ativo': 'eq.true' },
    order: 'descricao.asc',
    limit,
    offset
  });
  return { data };
}

async function handleGetServiceItems(body) {
  const { service_id, service_codigo } = body;
  if (!service_id && !service_codigo) throw new Error('service_id ou service_codigo é obrigatório');

  const filters = service_id
    ? { 'servico_id': `eq.${service_id}` }
    : { 'servico_codigo': `eq.${service_codigo}` };

  const data = await supabaseQuery('ServiceItem', {
    select: 'id,servico_id,servico_codigo,tipo_item,item_id,item_codigo,quantidade,categoria,ordem,custo_unitario_snapshot,custo_total_item',
    filters,
    order: 'ordem.asc'
  });
  return { data };
}

async function handleGetInputPriceHistory(body) {
  const { insumo_id, codigo } = body;
  if (!insumo_id && !codigo) throw new Error('insumo_id ou codigo é obrigatório');

  const filters = insumo_id
    ? { 'insumo_id': `eq.${insumo_id}` }
    : { 'codigo': `eq.${codigo}` };

  const data = await supabaseQuery('InputPriceHistory', {
    select: 'id,insumo_id,codigo,descricao,unidade,valor_unitario,data_base,categoria,fonte',
    filters,
    order: 'data_base.desc'
  });
  return { data };
}

async function handleGetServicePriceHistory(body) {
  const { servico_id, codigo } = body;
  if (!servico_id && !codigo) throw new Error('servico_id ou codigo é obrigatório');

  const filters = servico_id
    ? { 'servico_id': `eq.${servico_id}` }
    : { 'codigo': `eq.${codigo}` };

  const data = await supabaseQuery('ServicePriceHistory', {
    select: 'id,servico_id,codigo,descricao,unidade,custo_total,custo_material,custo_mao_obra,data_base',
    filters,
    order: 'data_base.desc'
  });
  return { data };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    let result;
    switch (action) {
      case 'searchInputs':       result = await handleSearchInputs(body); break;
      case 'searchServices':     result = await handleSearchServices(body); break;
      case 'getServiceItems':    result = await handleGetServiceItems(body); break;
      case 'getInputPriceHistory':   result = await handleGetInputPriceHistory(body); break;
      case 'getServicePriceHistory': result = await handleGetServicePriceHistory(body); break;
      default: return Response.json({ error: `Ação desconhecida: ${action}` }, { status: 400 });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});