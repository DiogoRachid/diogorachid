import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useSearchParams } from 'react-router-dom';
import { Calendar, TrendingUp, Users, AlertTriangle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/ui/PageHeader';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function BudgetPlanner() {
  const [searchParams] = useSearchParams();
  const budgetId = searchParams.get('id');

  const [duracao_meses, setDuracaoMeses] = useState(12);
  const [s_param, setSParam] = useState(2);
  const [i_param, setIParam] = useState(50);
  const [num_equipes, setNumEquipes] = useState(0);
  const [num_equipes_sugerido, setNumEquipesSugerido] = useState(0);
  const [curvaS, setCurvaS] = useState([]);
  const [curvaABC_servicos, setCurvaABC_Servicos] = useState([]);
  const [curvaABC_insumos, setCurvaABC_Insumos] = useState([]);

  // Buscar orçamento e itens
  const { data: budget } = useQuery({
    queryKey: ['budget', budgetId],
    queryFn: () => base44.entities.Budget.filter({ id: budgetId }).then(r => r[0]),
    enabled: !!budgetId
  });

  const { data: budgetItems = [] } = useQuery({
    queryKey: ['budgetItems', budgetId],
    queryFn: () => base44.entities.BudgetItem.filter({ orcamento_id: budgetId }),
    enabled: !!budgetId
  });

  const { data: stages = [] } = useQuery({
    queryKey: ['stages', budgetId],
    queryFn: () => base44.entities.ProjectStage.filter({ orcamento_id: budgetId }),
    enabled: !!budgetId
  });

  // Calcular Curva S
  const calcularCurvaS = () => {
    const n = duracao_meses;
    const s = s_param;
    const u = Math.log(1 / (1 - (i_param / 100))) / Math.log(n);
    
    const dados = [];
    for (let t = 1; t <= n; t++) {
      const y = 1 - Math.pow(1 - Math.pow(t / n, u), s);
      dados.push({
        mes: t,
        avanço_real: Math.round(y * 100 * 100) / 100,
        avanço_ideal: Math.round((t / n) * 100 * 100) / 100
      });
    }
    setCurvaS(dados);
  };

  // Calcular equipes necessárias
  const calcularEquipes = async () => {
    if (!budgetItems.length) return;

    let totalHorasMaoObra = 0;

    // Para cada item do orçamento, buscar o serviço e seus insumos de mão de obra
    for (const item of budgetItems) {
      try {
        const service = await base44.entities.Service.filter({ id: item.servico_id }).then(r => r[0]);
        if (!service) continue;

        const serviceItems = await base44.entities.ServiceItem.filter({ servico_id: service.id });
        
        for (const si of serviceItems) {
          if (si.tipo === 'insumo') {
            const insumo = await base44.entities.Input.filter({ id: si.item_id }).then(r => r[0]);
            if (insumo?.categoria === 'MAO_OBRA' && insumo.horas_por_unidade) {
              totalHorasMaoObra += (si.quantidade || 0) * (insumo.horas_por_unidade || 0) * (item.quantidade || 0);
            }
          }
        }
      } catch (e) {
        console.error('Erro ao calcular horas:', e);
      }
    }

    // Considerar 8h/dia, 22 dias úteis/mês, 2 pessoas por equipe (servente + pedreiro)
    const horasPorEquipePorMes = 8 * 22 * 2;
    const horasDisponiveisTotais = horasPorEquipePorMes * duracao_meses;
    const equipesNecessarias = Math.ceil(totalHorasMaoObra / horasDisponiveisTotais);

    setNumEquipesSugerido(equipesNecessarias);
    setNumEquipes(equipesNecessarias);
  };

  // Calcular Curva ABC
  const calcularCurvaABC = () => {
    // ABC de Serviços
    const servicosCusto = budgetItems.map(item => ({
      nome: item.servico_descricao || item.servico_codigo,
      valor: (item.valor_unitario || 0) * (item.quantidade || 0)
    })).sort((a, b) => b.valor - a.valor);

    let acumulado = 0;
    const totalGeral = servicosCusto.reduce((sum, s) => sum + s.valor, 0);
    
    const servicosComFaixa = servicosCusto.map(s => {
      acumulado += s.valor;
      const percAcum = (acumulado / totalGeral) * 100;
      let faixa = 'C';
      if (percAcum <= 50) faixa = 'A';
      else if (percAcum <= 80) faixa = 'B';
      
      return { ...s, faixa, percAcum: Math.round(percAcum * 100) / 100 };
    });

    setCurvaABC_Servicos(servicosComFaixa);
    
    // ABC de Insumos seria similar, mas agregando todos os insumos de todos os serviços
    // Por ora, deixaremos simplificado
  };

  useEffect(() => {
    calcularCurvaS();
  }, [duracao_meses, s_param, i_param]);

  useEffect(() => {
    if (budgetItems.length > 0) {
      calcularEquipes();
      calcularCurvaABC();
    }
  }, [budgetItems, duracao_meses]);

  const handleAjustarEquipes = () => {
    if (num_equipes !== num_equipes_sugerido) {
      const novaDuracao = Math.ceil((num_equipes_sugerido / num_equipes) * duracao_meses);
      if (confirm(`Com ${num_equipes} equipe(s), o prazo estimado passa para ${novaDuracao} meses. Deseja recalcular?`)) {
        setDuracaoMeses(novaDuracao);
      }
    }
  };

  const handleCriarEtapasPadrao = async () => {
    const etapasPadrao = [
      { nome: 'Fundação', ordem: 1, duracao_meses: duracao_meses * 0.15, dependencias: [] },
      { nome: 'Estrutura', ordem: 2, duracao_meses: duracao_meses * 0.25, dependencias: [] },
      { nome: 'Elétrica', ordem: 3, duracao_meses: duracao_meses * 0.15, dependencias: [] },
      { nome: 'Hidráulica', ordem: 4, duracao_meses: duracao_meses * 0.15, dependencias: [] },
      { nome: 'Fechamentos', ordem: 5, duracao_meses: duracao_meses * 0.15, dependencias: [] },
      { nome: 'Acabamentos', ordem: 6, duracao_meses: duracao_meses * 0.10, dependencias: [] },
      { nome: 'Limpeza Final', ordem: 7, duracao_meses: duracao_meses * 0.05, dependencias: [] }
    ];

    try {
      for (const etapa of etapasPadrao) {
        await base44.entities.ProjectStage.create({
          orcamento_id: budgetId,
          ...etapa
        });
      }
      toast.success('Etapas padrão criadas!');
      window.location.reload();
    } catch (e) {
      toast.error('Erro ao criar etapas');
      console.error(e);
    }
  };

  if (!budget) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div>
      <PageHeader 
        title="Planejamento e Cronograma"
        subtitle={`Orçamento: ${budget.nome || budget.codigo}`}
        icon={Calendar}
      />

      <Tabs defaultValue="cronograma" className="space-y-6">
        <TabsList>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="equipes">Equipes</TabsTrigger>
          <TabsTrigger value="curva-abc">Curva ABC</TabsTrigger>
          <TabsTrigger value="etapas">Etapas</TabsTrigger>
        </TabsList>

        <TabsContent value="cronograma">
          <Card>
            <CardHeader>
              <CardTitle>Curva S - Cronograma Físico-Financeiro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Duração (meses)</Label>
                  <Input 
                    type="number" 
                    value={duracao_meses} 
                    onChange={e => setDuracaoMeses(parseInt(e.target.value) || 1)}
                    min="1"
                  />
                </div>
                <div>
                  <Label>Coeficiente S</Label>
                  <Input 
                    type="number" 
                    step="0.1"
                    value={s_param} 
                    onChange={e => setSParam(parseFloat(e.target.value) || 2)}
                  />
                </div>
                <div>
                  <Label>Inflexão i% (%)</Label>
                  <Input 
                    type="number" 
                    value={i_param} 
                    onChange={e => setIParam(parseFloat(e.target.value) || 50)}
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={curvaS}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" label={{ value: 'Mês', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: '% Avanço', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="avanço_real" stroke="#3b82f6" name="Curva S Real" strokeWidth={2} />
                  <Line type="monotone" dataKey="avanço_ideal" stroke="#10b981" name="Curva Ideal" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Dimensionamento de Equipes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Equipes Sugeridas: <span className="text-2xl font-bold text-blue-600">{num_equipes_sugerido}</span></p>
                <p className="text-xs text-slate-600">Baseado em: 8h/dia × 22 dias úteis × 2 pessoas (servente + pedreiro)</p>
              </div>

              <div>
                <Label>Número de Equipes Desejado</Label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    value={num_equipes} 
                    onChange={e => setNumEquipes(parseInt(e.target.value) || 0)}
                    min="1"
                  />
                  <Button onClick={handleAjustarEquipes} variant="outline">
                    Ajustar Prazo
                  </Button>
                </div>
              </div>

              {num_equipes < num_equipes_sugerido && (
                <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Atenção</p>
                    <p className="text-xs text-yellow-700">
                      Com {num_equipes} equipe(s), será necessário mais tempo para executar a obra no prazo.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="curva-abc">
          <Card>
            <CardHeader>
              <CardTitle>Curva ABC - Serviços</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {curvaABC_servicos.slice(0, 20).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      item.faixa === 'A' ? 'bg-red-100 text-red-700' :
                      item.faixa === 'B' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {item.faixa}
                    </span>
                    <span className="flex-1 text-sm">{item.nome}</span>
                    <span className="text-sm font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                    </span>
                    <span className="text-xs text-slate-500">{item.percAcum}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="etapas">
          <Card>
            <CardHeader>
              <CardTitle>Etapas da Obra</CardTitle>
            </CardHeader>
            <CardContent>
              {stages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 mb-4">Nenhuma etapa cadastrada</p>
                  <Button onClick={handleCriarEtapasPadrao}>
                    Criar Etapas Padrão
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {stages.sort((a, b) => a.ordem - b.ordem).map(stage => (
                    <div key={stage.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded">
                      <span className="text-lg font-bold text-slate-400">{stage.ordem}</span>
                      <div className="flex-1">
                        <p className="font-medium">{stage.nome}</p>
                        <p className="text-xs text-slate-500">{stage.duracao_meses} meses</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}