import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PayrollForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const payrollId = urlParams.get('id');
  const isEdit = !!payrollId;

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
  
  const [formData, setFormData] = useState({
    colaborador_id: '',
    colaborador_nome: '',
    mes_referencia: currentMonth,
    valor_bruto: '',
    descontos: '',
    valor_liquido: '',
    data_pagamento: today,
    status: 'pendente',
    centro_custo_id: '',
    centro_custo_nome: '',
    observacoes: ''
  });

  const { data: payroll, isLoading } = useQuery({
    queryKey: ['payroll', payrollId],
    queryFn: () => base44.entities.Payroll.filter({ id: payrollId }).then(res => res[0]),
    enabled: isEdit
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.filter({ status: 'ativo' })
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ['costCenters'],
    queryFn: () => base44.entities.CostCenter.filter({ status: 'ativo' })
  });

  useEffect(() => {
    if (payroll) {
      setFormData({
        colaborador_id: payroll.colaborador_id || '',
        colaborador_nome: payroll.colaborador_nome || '',
        mes_referencia: payroll.mes_referencia || '',
        valor_bruto: payroll.valor_bruto || '',
        descontos: payroll.descontos || '',
        valor_liquido: payroll.valor_liquido || '',
        data_pagamento: payroll.data_pagamento || '',
        status: payroll.status || 'pendente',
        centro_custo_id: payroll.centro_custo_id || '',
        centro_custo_nome: payroll.centro_custo_nome || '',
        observacoes: payroll.observacoes || ''
      });
    }
  }, [payroll]);

  // Calcular valor líquido automaticamente
  useEffect(() => {
    const bruto = parseFloat(formData.valor_bruto) || 0;
    const desc = parseFloat(formData.descontos) || 0;
    const liquido = bruto - desc;
    if (liquido >= 0 && (formData.valor_bruto || formData.descontos)) {
      setFormData(prev => ({ ...prev, valor_liquido: liquido.toFixed(2) }));
    }
  }, [formData.valor_bruto, formData.descontos]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        valor_bruto: parseFloat(data.valor_bruto) || 0,
        descontos: parseFloat(data.descontos) || 0,
        valor_liquido: parseFloat(data.valor_liquido) || 0
      };

      let payrollResult;
      if (isEdit) {
        payrollResult = await base44.entities.Payroll.update(payrollId, payload);
      } else {
        payrollResult = await base44.entities.Payroll.create(payload);
      }

      // Criar conta a pagar automaticamente apenas se for nova folha
      if (!isEdit && payrollResult) {
        const centroCustoRH = costCenters.find(c => c.tipo === 'rh');
        
        await base44.entities.AccountPayable.create({
          descricao: `Folha de Pagamento - ${data.colaborador_nome} - ${data.mes_referencia}`,
          valor: parseFloat(data.valor_liquido),
          data_vencimento: data.data_pagamento,
          data_compra: new Date().toISOString().split('T')[0],
          status: 'em_aberto',
          forma_pagamento: 'transferencia',
          centro_custo_id: data.centro_custo_id || centroCustoRH?.id || '',
          centro_custo_nome: data.centro_custo_nome || centroCustoRH?.nome || 'RH',
          observacoes: `Gerado automaticamente pela folha de pagamento - ${data.mes_referencia}`
        });
      }

      return payrollResult;
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Folha atualizada com sucesso!' : 'Folha lançada e conta a pagar criada!');
      window.location.href = createPageUrl('Payrolls');
    },
    onError: (error) => {
      toast.error('Erro ao salvar folha de pagamento');
      console.error(error);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEmployeeChange = (id) => {
    const employee = employees.find(e => e.id === id);
    setFormData(prev => ({
      ...prev,
      colaborador_id: id,
      colaborador_nome: employee?.nome_completo || '',
      valor_bruto: employee?.salario || ''
    }));
  };

  const handleCostCenterChange = (id) => {
    const center = costCenters.find(c => c.id === id);
    setFormData(prev => ({
      ...prev,
      centro_custo_id: id,
      centro_custo_nome: center?.nome || ''
    }));
  };

  if (isEdit && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Editar Folha' : 'Lançar Folha de Pagamento'}
        subtitle={isEdit ? 'Atualize os dados da folha' : 'Preencha os dados para lançamento'}
        icon={DollarSign}
        backUrl={createPageUrl('Payrolls')}
      />

      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="space-y-6">
          {/* Dados do Colaborador */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados do Colaborador</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <Label htmlFor="colaborador">Colaborador *</Label>
                <Select
                  value={formData.colaborador_id}
                  onValueChange={handleEmployeeChange}
                  disabled={isEdit}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome_completo} - {e.funcao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="mes_referencia">Mês de Referência *</Label>
                <Input
                  id="mes_referencia"
                  value={formData.mes_referencia}
                  onChange={(e) => handleChange('mes_referencia', e.target.value)}
                  placeholder="MM/YYYY"
                  required
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="data_pagamento">Data de Pagamento *</Label>
                <Input
                  id="data_pagamento"
                  type="date"
                  value={formData.data_pagamento}
                  onChange={(e) => handleChange('data_pagamento', e.target.value)}
                  required
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>

          {/* Valores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Valores</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="valor_bruto">Valor Bruto</Label>
                <Input
                  id="valor_bruto"
                  type="number"
                  step="0.01"
                  value={formData.valor_bruto}
                  onChange={(e) => handleChange('valor_bruto', e.target.value)}
                  placeholder="0,00"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="descontos">Descontos</Label>
                <Input
                  id="descontos"
                  type="number"
                  step="0.01"
                  value={formData.descontos}
                  onChange={(e) => handleChange('descontos', e.target.value)}
                  placeholder="0,00"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="valor_liquido">Valor Líquido *</Label>
                <Input
                  id="valor_liquido"
                  type="number"
                  step="0.01"
                  value={formData.valor_liquido}
                  onChange={(e) => handleChange('valor_liquido', e.target.value)}
                  required
                  placeholder="0,00"
                  className="mt-1.5 font-semibold"
                />
              </div>
            </CardContent>
          </Card>

          {/* Vínculos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vínculos</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="centro_custo">Centro de Custo</Label>
                <Select
                  value={formData.centro_custo_id}
                  onValueChange={handleCostCenterChange}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange('status', value)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                rows={4}
                placeholder="Informações adicionais sobre o pagamento..."
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Salvar Alterações' : 'Lançar Folha'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.href = createPageUrl('Payrolls')}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}