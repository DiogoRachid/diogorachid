import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gavel, Plus, TrendingDown, Calendar, Building2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import LicitacaoDashboard from '@/components/licitacoes/LicitacaoDashboard';
import LicitacaoTable from '@/components/licitacoes/LicitacaoTable';
import LicitacaoFormDialog from '@/components/licitacoes/LicitacaoFormDialog';
import { toast } from 'sonner';

export default function Licitacoes() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const queryClient = useQueryClient();

  const { data: licitacoes = [], isLoading } = useQuery({
    queryKey: ['licitacoes'],
    queryFn: () => base44.entities.Licitacao.list('-data_abertura', 500)
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Cálculo automático do percentual de desconto
      const payload = { ...data };
      if (payload.nossa_proposta && payload.valor_maximo) {
        payload.percentual_desconto = ((payload.valor_maximo - payload.nossa_proposta) / payload.valor_maximo) * 100;
      }
      if (editingItem) {
        return base44.entities.Licitacao.update(editingItem.id, payload);
      }
      return base44.entities.Licitacao.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licitacoes'] });
      setFormOpen(false);
      setEditingItem(null);
      toast.success(editingItem ? 'Licitação atualizada!' : 'Licitação cadastrada!');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Licitacao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licitacoes'] });
      toast.success('Licitação removida!');
    }
  });

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditingItem(null);
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Licitações"
        subtitle="Gestão de participação em processos licitatórios"
        icon={Gavel}
        actionLabel="Nova Licitação"
        onAction={() => setFormOpen(true)}
      />

      <LicitacaoDashboard licitacoes={licitacoes} />

      <LicitacaoTable
        licitacoes={licitacoes}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={(id) => deleteMutation.mutate(id)}
      />

      <LicitacaoFormDialog
        open={formOpen}
        onClose={handleClose}
        onSubmit={saveMutation.mutate}
        initialData={editingItem}
        isLoading={saveMutation.isPending}
      />
    </div>
  );
}