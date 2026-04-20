import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { DollarSign, Plus, Trash2, Eye, Edit2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/shared/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import SearchFilter from '@/components/shared/SearchFilter';
import DeleteConfirmDialog from '@/components/shared/DeleteConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical } from 'lucide-react';

export default function PayrollsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter] = useState('all');
  const [deleteId, setDeleteId] = useState(null);
  const [sortColumn, setSortColumn] = useState('data_pagamento');
  const [sortDirection, setSortDirection] = useState('desc');

  const { data: payrolls = [], isLoading } = useQuery({
    queryKey: ['payrolls'],
    queryFn: () => base44.entities.Payroll.list()
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Payroll.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      setDeleteId(null);
    }
  });

  const filteredPayrolls = payrolls
    .filter(p => {
      const matchesSearch = p.colaborador_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           p.mes_referencia?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      
      if (sortColumn === 'data_pagamento') {
        aVal = new Date(aVal || 0);
        bVal = new Date(bVal || 0);
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const columns = [
    {
      header: 'Colaborador',
      accessor: 'colaborador_nome',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.colaborador_nome}</p>
          <p className="text-sm text-slate-500">{row.mes_referencia}</p>
        </div>
      )
    },
    {
      header: 'Valor Líquido',
      accessor: 'valor_liquido',
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-slate-900">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valor_liquido || 0)}
        </span>
      )
    },
    {
      header: 'Data Pagamento',
      accessor: 'data_pagamento',
      sortable: true,
      render: (row) => (
        <span className="text-slate-700">
          {row.data_pagamento ? new Date(row.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
        </span>
      )
    },
    {
      header: 'Centro de Custo',
      accessor: 'centro_custo_nome',
      render: (row) => (
        <span className="text-sm text-slate-600">{row.centro_custo_nome || '-'}</span>
      )
    },
    {
      header: 'Ações',
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(createPageUrl('PayrollForm') + `?id=${row.id}`)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setDeleteId(row.id)}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const filters = [];

  return (
    <div>
      <PageHeader
        title="Folha de Pagamento"
        subtitle="Gerencie os lançamentos de folha dos colaboradores"
        icon={DollarSign}
        actionLabel="Lançar Folha"
        onAction={() => navigate(createPageUrl('PayrollForm'))}
      />

      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filters={filters}
        searchPlaceholder="Buscar por colaborador ou mês..."
      />

      <DataTable
        columns={columns}
        data={filteredPayrolls}
        isLoading={isLoading}
        onSort={handleSort}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        emptyComponent={
          <EmptyState
            icon={DollarSign}
            title="Nenhuma folha cadastrada"
            description="Comece lançando a primeira folha de pagamento"
            actionLabel="Lançar Folha"
            onAction={() => navigate(createPageUrl('PayrollForm'))}
          />
        }
      />

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        isDeleting={deleteMutation.isPending}
        title="Excluir folha?"
        description="Esta ação não pode ser desfeita. A folha será removida permanentemente."
      />
    </div>
  );
}