// Serviço para buscar cotações usando a API do LLM com contexto da internet
import { base44 } from '@/api/base44Client';

function isB3Ticker(ticker) {
  // Padrão B3: 4 letras + número(s) (ex: PETR4, AAPL34, BOVA11, BITH11)
  // Ignora criptos (BTC, ETH) e ativos US (AAPL, VOO) que não seguem esse padrão exato
  return /^[A-Z]{4}[0-9]{1,2}$/.test(ticker.toUpperCase());
}

export async function fetchQuotes(tickers) {
  if (!tickers || tickers.length === 0) return {};

  // Adiciona sufixo .SA explicitamente para ativos B3 para forçar a busca correta
  const processedTickers = tickers.map(t => {
    const upper = t.toUpperCase();
    return isB3Ticker(upper) && !upper.endsWith('.SA') ? `${upper}.SA` : upper;
  });

  const tickerList = processedTickers.join(', ');
  
  const response = await base44.integrations.Core.InvokeLLM({
    prompt: `Atue como um especialista financeiro. Busque as cotações mais recentes para a lista exata de ativos: ${tickerList}.

    REGRAS CRÍTICAS:
    1. ATIVOS COM SUFIXO ".SA" (ex: AAPL34.SA, BITH11.SA):
       - SÃO OBRIGATORIAMENTE DA BOLSA BRASILEIRA (B3).
       - O PREÇO DEVE SER EM REAIS (BRL).
       - AAPL34.SA não é AAPL (EUA). É um BDR negociado no Brasil.
       - BITH11.SA é um ETF negociado no Brasil.

    2. ATIVOS SEM SUFIXO:
       - Se for Cripto (BTC, ETH): Tente BRL, aceite USD.
       - Se for Stock EUA (AAPL, VOO): USD.

    Retorne um JSON com:
    - ticker: código do ativo (ex: BTC, PETR4)
    - price: valor numérico do preço
    - currency: "BRL" ou "USD"
    - change_percent: variação do dia em % (ex: 1.5 ou -0.5)

    Retorne APENAS os dados encontrados.`,
    add_context_from_internet: true,
    response_json_schema: {
      type: "object",
      properties: {
        quotes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ticker: { type: "string" },
              price: { type: "number" },
              currency: { type: "string" },
              change_percent: { type: "number" }
            }
          }
        },
        exchange_rate_usd_brl: { type: "number" }
      }
    }
  });

  const result = {};
  if (response?.quotes) {
    response.quotes.forEach(q => {
      result[q.ticker.toUpperCase()] = {
        price: q.price,
        currency: q.currency,
        change_percent: q.change_percent
      };
    });
  }
  
  // Guardar taxa de câmbio se disponível
  if (response?.exchange_rate_usd_brl) {
    result['USD_BRL'] = { price: response.exchange_rate_usd_brl, currency: 'BRL' };
  }

  return result;
}

export async function fetchSingleQuote(ticker, categoria) {
  const upperTicker = ticker.toUpperCase();
  // Se parece ticker da B3 e não tem .SA, adiciona para garantir
  const searchTicker = (isB3Ticker(upperTicker) && !upperTicker.endsWith('.SA')) 
    ? `${upperTicker}.SA` 
    : upperTicker;

  const response = await base44.integrations.Core.InvokeLLM({
    prompt: `Atue como um especialista financeiro. Busque a cotação mais recente para o ativo: "${searchTicker}".

    INSTRUÇÕES RÍGIDAS:
    1. Se o ticker tem ".SA" (ex: AAPL34.SA, BITH11.SA):
       - É um ativo da B3 (Brasil).
       - PREÇO OBRIGATÓRIO EM BRL (Reais).
       - Ignore cotações em Dólar para estes ativos.
    
    2. Se for Cripto (BTC, ETH):
       - Busque o valor em BRL.

    3. Se for Ativo Internacional (AAPL, MSFT) sem .SA:
       - Preço em USD.

    Retorne um JSON com:
    - price: preço atual (numérico)
    - currency: "BRL" ou "USD"
    - change_percent: variação % do dia
    - name: nome completo do ativo`,
    add_context_from_internet: true,
    response_json_schema: {
      type: "object",
      properties: {
        price: { type: "number" },
        currency: { type: "string" },
        change_percent: { type: "number" },
        name: { type: "string" }
      }
    }
  });

  return response;
}

export async function fetchEconomicIndicators() {
  const response = await base44.integrations.Core.InvokeLLM({
    prompt: `Busque os indicadores econômicos atuais do Brasil:
    - Taxa SELIC atual
    - CDI atual (taxa anual)
    - IPCA acumulado 12 meses
    - IGP-M acumulado 12 meses
    - Cotação do Dólar (USD/BRL)
    - Cotação do Euro (EUR/BRL)
    - IBOVESPA pontos e variação do dia`,
    add_context_from_internet: true,
    response_json_schema: {
      type: "object",
      properties: {
        selic: { type: "number" },
        cdi: { type: "number" },
        ipca: { type: "number" },
        igpm: { type: "number" },
        dolar: { type: "number" },
        euro: { type: "number" },
        ibovespa: { type: "number" },
        ibovespa_change: { type: "number" }
      }
    }
  });

  return response;
}