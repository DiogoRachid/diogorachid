import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Save, X, Layers } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function BudgetStageManager() {
  const queryClient = useQueryClient();
  const [editingStage, setEditingStage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    ordem: 1,
    cor: '#3b82f6'
  });

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['budgetStages'],
    queryFn: () => base44.entities.BudgetStage.list()
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingStage) {
        return await base44.entities.BudgetStage.update(editingStage.id, data);
      } else {
        return await base44.entities.BudgetStage.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['budgetStages']);
      toast.success(editingStage ? 'Etapa atualizada!' : 'Etapa criada!');
      handleCloseForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BudgetStage.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['budgetStages']);
      toast.success('Etapa excluída!');
    }
  });

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingStage(null);
    setFormData({
      nome: '',
      descricao: '',
      ordem: stages.length + 1,
      cor: '#3b82f6'
    });
  };

  const handleEdit = (stage) => {
    setEditingStage(stage);
    setFormData({
      nome: stage.nome,
      descricao: stage.descricao || '',
      ordem: stage.ordem,
      cor: stage.cor || '#3b82f6'
    });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingStage(null);
    setFormData({
      nome: '',
      descricao: '',
      ordem: stages.length + 1,
      cor: '#3b82f6'
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const sortedStages = [...stages].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Etapas Padrão do Sistema</CardTitle>
              <CardDescription>
                Configure as etapas que serão usadas como modelo para novos orçamentos
              </CardDescription>
            </div>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Etapa
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-slate-500 py-8">Carregando...</p>
          ) : stages.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-2 font-medium">Nenhuma etapa cadastrada</p>
              <p className="text-slate-500 text-sm mb-6">Crie as etapas padrão do sistema</p>
              <Button onClick={handleNew}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Etapa
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedStages.map((stage) => (
                <div 
                  key={stage.id} 
                  className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors"
                >
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ backgroundColor: stage.cor || '#3b82f6' }}
                  >
                    {stage.ordem}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{stage.nome}</p>
                    {stage.descricao && (
                      <p className="text-sm text-slate-600 truncate">{stage.descricao}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleEdit(stage)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        if (confirm(`Excluir etapa "${stage.nome}"?`)) {
                          deleteMutation.mutate(stage.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={handleCloseForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStage ? 'Editar Etapa' : 'Nova Etapa'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nome da Etapa *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Fundação, Estrutura, Alvenaria..."
                required
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição detalhada da etapa..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ordem de Execução *</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.ordem}
                  onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>

              <div>
                <Label>Cor</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.cor}
                    onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <div 
                    className="flex-1 rounded border flex items-center justify-center font-medium text-white"
                    style={{ backgroundColor: formData.cor }}
                  >
                    {formData.ordem}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseForm}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}