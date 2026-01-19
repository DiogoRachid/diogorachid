import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/shared/DataTable";
import SearchFilter from "@/components/shared/SearchFilter";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { Plus, Eye, Trash2, FileText, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';

const statusColors = {
  rascunho: 'bg-yellow-100 text-yellow-800',
  aprovada: 'bg-green-100 text-green-800',
  cancelada: 'bg-red-100 text-red-800'
};

const statusLabels = {
  rascunho: 'Rascunho',
  aprovada: 'Aprovada',
  cancelada: 'Cancelada'
};

export default function MeasurementsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBudget, setSelectedBudget] = useState('all');

  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ['measurements'],
    queryFn: () => base44.entities.Measurement.list('-numero_medicao'),
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => base44.entities.Budget.list(),
  });

  const handleDelete = async (id) => {
    if (!confirm('Deseja realmente excluir esta medição?')) return;
    
    try {
      // Excluir itens primeiro
      const items = await base44.entities.MeasurementItem.filter({ medicao_id: id });
      await Promise.all(items.map(item => base44.entities.MeasurementItem.delete(item.id)));
      
      // Excluir medição
      await base44.entities.Measurement.delete(id);
      window.location.reload();
    } catch (error) {
      alert('Erro ao excluir medição');
    }
  };

  const filteredData = measurements.filter(item => {
    const matchesSearch = !searchTerm || 
      item.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.obra_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.numero_medicao?.toString().includes(searchTerm);
    
    const matchesBudget = selectedBudget === 'all' || item.orcamento_id === selectedBudget;
    
    return matchesSearch && matchesBudget;
  });

  const columns = [
    {
      header: 'Nº',
      accessor: 'numero_medicao',
      render: (value) => <span className="font-semibold text-blue-600">{value}</span>
    },
    {
      header: 'Orçamento',
      accessor: 'orcamento_nome',
      sortable: true
    },
    {
      header: 'Obra',
      accessor: 'obra_nome',
      sortable: true
    },
    {
      header: 'Mês Ref.',
      accessor: 'mes_referencia',
      render: (value) => `Mês ${value}`
    },
    {
      header: 'Período',
      accessor: 'data_inicio',
      render: (value, row) => {
        if (!value || !row || !row.data_fim) return '-';
        return `${format(new Date(value), 'dd/MM/yy')} - ${format(new Date(row.data_fim), 'dd/MM/yy')}`;
      }
    },
    {
      header: 'Total Executado',
      accessor: 'total_executado',
      render: (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0),
      sortable: true
    },
    {
      header: '% Executado',
      accessor: 'percentual_executado',
      render: (value) => `${(value || 0).toFixed(1)}%`
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (value) => (
        <StatusBadge 
          status={value} 
          className={statusColors[value]}
        >
          {statusLabels[value]}
        </StatusBadge>
      ),
      sortable: true
    },
    {
      header: '',
      accessor: 'id',
      render: (value, row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(createPageUrl('MeasurementForm') + `?id=${value}`)}>
              <Eye className="h-4 w-4 mr-2" />
              Visualizar/Editar
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleDelete(value)}
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

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Medições"
        actionLabel="Nova Medição"
        actionIcon={Plus}
        onAction={() => navigate(createPageUrl('MeasurementForm'))}
      />

      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <SearchFilter
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Buscar por número, descrição ou obra..."
              />
            </div>
            <select
              value={selectedBudget}
              onChange={(e) => setSelectedBudget(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos os Orçamentos</option>
              {budgets.map(budget => (
                <option key={budget.id} value={budget.id}>
                  {budget.descricao}
                </option>
              ))}
            </select>
          </div>

          {filteredData.length === 0 && !isLoading ? (
            <EmptyState
              icon={FileText}
              title="Nenhuma medição cadastrada"
              description="Comece criando uma nova medição para registrar o progresso da obra"
              actionLabel="Nova Medição"
              onAction={() => navigate(createPageUrl('MeasurementForm'))}
            />
          ) : (
            <DataTable
              data={filteredData}
              columns={columns}
              isLoading={isLoading}
              onRowClick={(row) => navigate(createPageUrl('MeasurementForm') + `?id=${row.id}`)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}