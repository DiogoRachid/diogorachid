import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RequisitionItemForm from '@/components/requisitions/RequisitionItemForm';
import { toast } from "sonner";

export default function MaterialRequisitionForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const requisitionId = urlParams.get('id');

  const [formData, setFormData] = useState({
    numero_pedido: '',
    obra_id: '',
    status: 'rascunho',
    data_pedido: new Date().toISOString().split('T')[0]
  });
  const [items, setItems] = useState([]);
  const queryClient = useQueryClient();

  const { data: requisition } = useQuery({
    queryKey: ['requisition', requisitionId],
    queryFn: () => requisitionId 
      ? base44.entities.MaterialRequisition.filter({ id: requisitionId }).then(r => r[0])
      : Promise.resolve(null),
    enabled: !!requisitionId
  });

  const { data: requisitionItems = [] } = useQuery({
    queryKey: ['requisitionItems', requisitionId],
    queryFn: () => requisitionId
      ? base44.entities.MaterialRequisitionItem.filter({ requisicao_id: requisitionId })
      : Promise.resolve([]),
    enabled: !!requisitionId
  });

  const { data: works = [] } = useQuery({
    queryKey: ['works'],
    queryFn: () => base44.entities.Project.list()
  });

  useEffect(() => {
    if (requisition) {
      setFormData({
        numero_pedido: requisition.numero_pedido,
        obra_id: requisition.obra_id,
        status: requisition.status,
        data_pedido: requisition.data_pedido
      });
    }
  }, [requisition]);

  useEffect(() => {
    if (requisitionItems && requisitionItems.length > 0) {
      setItems(requisitionItems.map(i => ({
        insumo_nome: i.insumo_nome,
        unidade: i.unidade,
        quantidade_solicitada: i.quantidade_solicitada
      })));
    }
  }, [requisitionItems]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (requisitionId && requisition) {
        // Atualizar
        await base44.entities.MaterialRequisition.update(requisitionId, data.requisition);
        
        // Deletar items antigos
        for (const item of requisitionItems) {
          await base44.entities.MaterialRequisitionItem.delete(item.id);
        }
        
        // Criar novos items
        if (data.items && data.items.length > 0) {
          for (const item of data.items) {
            await base44.entities.MaterialRequisitionItem.create({
              ...item,
              requisicao_id: requisitionId,
              insumo_id: '',
              insumo_codigo: '',
              valor_unitario: 0,
              valor_total: 0
            });
          }
        }
      } else {
        // Criar novo
        const newRequisition = await base44.entities.MaterialRequisition.create(data.requisition);
        if (data.items && data.items.length > 0) {
          for (const item of data.items) {
            await base44.entities.MaterialRequisitionItem.create({
              ...item,
              requisicao_id: newRequisition.id,
              insumo_id: '',
              insumo_codigo: '',
              valor_unitario: 0,
              valor_total: 0
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialRequisitions'] });
      queryClient.invalidateQueries({ queryKey: ['requisition'] });
      queryClient.invalidateQueries({ queryKey: ['requisitionItems'] });
      toast.success(requisitionId ? 'Pedido atualizado!' : 'Pedido criado!');
      window.location.href = createPageUrl('MaterialRequisitions');
    },
    onError: (error) => {
      toast.error('Erro ao salvar pedido: ' + error.message);
    }
  });

  const handleSave = () => {
    if (!formData.numero_pedido || !formData.obra_id || items.length === 0) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const selectedWork = works.find(w => w.id === formData.obra_id);
    saveMutation.mutate({
      requisition: {
        ...formData,
        obra_nome: selectedWork?.nome,
        total_itens: items.length,
        valor_total: 0
      },
      items
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link to={createPageUrl('MaterialRequisitions')}>
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {requisitionId ? 'Editar Pedido de Material' : 'Novo Pedido de Material'}
          </h1>
        </div>
      </div>

      {/* Informações Gerais */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Informações do Pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero">Número do Pedido *</Label>
              <Input
                id="numero"
                placeholder="Ex: PED-001"
                value={formData.numero_pedido}
                onChange={(e) => setFormData({ ...formData, numero_pedido: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data">Data do Pedido</Label>
              <Input
                id="data"
                type="date"
                value={formData.data_pedido}
                onChange={(e) => setFormData({ ...formData, data_pedido: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="obra">Obra *</Label>
              <Select value={formData.obra_id} onValueChange={(value) => setFormData({ ...formData, obra_id: value })}>
                <SelectTrigger id="obra">
                  <SelectValue placeholder="Selecione a obra" />
                </SelectTrigger>
                <SelectContent>
                  {works.map(work => (
                    <SelectItem key={work.id} value={work.id}>
                      {work.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="enviado">Enviado</SelectItem>
                  <SelectItem value="recebido">Recebido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Materiais */}
      <RequisitionItemForm
        items={items}
        onAddItem={(item) => setItems([...items, item])}
        onEditItem={(idx, item) => {
          setItems(items.map((i, index) => index === idx ? { ...item } : i));
        }}
        onRemoveItem={(idx) => {
          setItems(items.filter((_, i) => i !== idx));
        }}
      />

      {/* Ações */}
      <div className="flex gap-3 mt-6">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar Pedido'}
        </Button>
        <Link to={createPageUrl('MaterialRequisitions')}>
          <Button variant="outline">Cancelar</Button>
        </Link>
      </div>
    </div>
  );
}