import React, { useMemo } from 'react';
import { format, parseISO, isAfter, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, TrendingDown, Trophy, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function LicitacaoDashboard({ licitacoes }) {
  const today = startOfDay(new Date());

  // Próximas 5 licitações ordenadas por data de abertura
  const proximas = useMemo(() => {
    return licitacoes
      .filter(l => l.data_abertura && isAfter(parseISO(l.data_abertura), today) && l.status !== 'cancelada')
      .sort((a, b) => new Date(a.data_abertura) - new Date(b.data_abertura))
      .slice(0, 5);
  }, [licitacoes]);

  // Dados para o gráfico: licitações encerradas com desconto calculado, ordenadas por data
  const chartData = useMemo(() => {
    return licitacoes
      .filter(l => l.status === 'encerrada' && l.percentual_desconto != null && l.participou)
      .sort((a, b) => new Date(a.data_abertura) - new Date(b.data_abertura))
      .map(l => ({
        data: format(parseISO(l.data_abertura), 'MM/yy'),
        desconto: parseFloat(l.percentual_desconto?.toFixed(2) || 0),
        nome: l.nome_obra,
        ganhou: l.ganhou
      }));
  }, [licitacoes]);

  // KPIs
  const kpis = useMemo(() => {
    const encerradas = licitacoes.filter(l => l.status === 'encerrada' && l.participou);
    const ganhas = encerradas.filter(l => l.ganhou);
    const taxaVitoria = encerradas.length > 0 ? ((ganhas.length / encerradas.length) * 100).toFixed(1) : 0;
    const descontoMedio = encerradas.length > 0
      ? (encerradas.reduce((sum, l) => sum + (l.percentual_desconto || 0), 0) / encerradas.length).toFixed(1)
      : 0;
    return { encerradas: encerradas.length, ganhas: ganhas.length, taxaVitoria, descontoMedio };
  }, [licitacoes]);

  const STATUS_COLORS = { aguardando: '#6366f1', participando: '#0ea5e9', encerrada: '#10b981', cancelada: '#ef4444' };
  const STATUS_LABELS = { aguardando: 'Aguardando', participando: 'Participando', encerrada: 'Encerrada', cancelada: 'Cancelada' };

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    return payload.ganhou
      ? <circle cx={cx} cy={cy} r={6} fill="#10b981" stroke="#fff" strokeWidth={2} />
      : <circle cx={cx} cy={cy} r={4} fill="#6366f1" stroke="#fff" strokeWidth={1} />;
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Participadas', value: kpis.encerradas, icon: AlertCircle, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Ganhas', value: kpis.ganhas, icon: Trophy, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Taxa de Vitória', value: `${kpis.taxaVitoria}%`, icon: TrendingDown, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Desconto Médio', value: `${kpis.descontoMedio}%`, icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Próximas 5 licitações */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600" />
              Próximas Licitações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {proximas.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Nenhuma licitação futura cadastrada</p>
            ) : (
              <div className="space-y-2">
                {proximas.map((l) => (
                  <div key={l.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{l.nome_obra}</p>
                      <p className="text-xs text-slate-500">{l.orgao_licitante}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-xs font-semibold text-indigo-600">
                        {format(parseISO(l.data_abertura), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        backgroundColor: `${STATUS_COLORS[l.status]}22`,
                        color: STATUS_COLORS[l.status]
                      }}>
                        {STATUS_LABELS[l.status]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de evolução de descontos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-indigo-600" />
              Evolução dos Descontos (%)
              <span className="text-xs font-normal text-slate-400 ml-1">🟢 ganhas</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length < 2 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Dados insuficientes (mínimo 2 licitações encerradas)</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" domain={['auto', 'auto']} />
                  <Tooltip
                    formatter={(v) => [`${v}%`, 'Desconto']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.nome || ''}
                  />
                  <Line
                    type="monotone"
                    dataKey="desconto"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={<CustomDot />}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}