import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Shield, 
  UserPlus, 
  Users, 
  Pencil, 
  Trash2, 
  Search,
  CheckCircle,
  XCircle,
  Save,
  X
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/shared/DataTable';
import DeleteConfirmDialog from '@/components/shared/DeleteConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';

const MODULOS = [
  { id: 'Dashboard', label: 'Dashboard' },
  { id: 'Suppliers', label: 'Fornecedores' },
  { id: 'Clients', label: 'Clientes' },
  { id: 'Projects', label: 'Obras' },
  { id: 'BankAccounts', label: 'Contas Bancárias' },
  { id: 'CostCenters', label: 'Centros de Custo' },
  { id: 'AccountsPayable', label: 'Contas a Pagar' },
  { id: 'AccountsReceivable', label: 'Contas a Receber' },
  { id: 'Transactions', label: 'Transações' },
  { id: 'Employees', label: 'Colaboradores' },
  { id: 'Teams', label: 'Equipes' },
  { id: 'TimeRecords', label: 'Frequência' },
  { id: 'EmployeeContracts', label: 'Contratos' },
  { id: 'Benefits', label: 'Benefícios' },
  { id: 'HRReports', label: 'Relatórios RH' },
  { id: 'Investments', label: 'Investimentos' },
  { id: 'Reports', label: 'Relatórios' },
  { id: 'AdminPortal', label: 'Portal Admin' }
];

const NIVEIS_ACESSO = [
  { value: 'super_admin', label: 'Super Admin', color: 'bg-purple-100 text-purple-700' },
  { value: 'admin', label: 'Administrador', color: 'bg-blue-100 text-blue-700' },
  { value: 'gestor', label: 'Gestor', color: 'bg-emerald-100 text-emerald-700' }
];

export default function AdminPortal() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    nome: '',
    nivel_acesso: 'admin',
    modulos_permitidos: [],
    status: 'ativo'
  });

  const { data: adminUsers = [], isLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => base44.entities.AdminUser.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AdminUser.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setShowDialog(false);
      resetForm();
      toast.success('Administrador cadastrado com sucesso!');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AdminUser.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setShowDialog(false);
      resetForm();
      toast.success('Administrador atualizado com sucesso!');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AdminUser.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setDeleteId(null);
      toast.success('Administrador removido!');
    }
  });

  const resetForm = () => {
    setFormData({
      email: '',
      nome: '',
      nivel_acesso: 'admin',
      modulos_permitidos: [],
      status: 'ativo'
    });
    setEditingAdmin(null);
  };

  const handleEdit = (admin) => {
    setEditingAdmin(admin);
    setFormData({
      email: admin.email,
      nome: admin.nome,
      nivel_acesso: admin.nivel_acesso,
      modulos_permitidos: admin.modulos_permitidos || [],
      status: admin.status
    });
    setShowDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingAdmin) {
      updateMutation.mutate({ id: editingAdmin.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleModulo = (moduloId) => {
    setFormData(prev => ({
      ...prev,
      modulos_permitidos: prev.modulos_permitidos.includes(moduloId)
        ? prev.modulos_permitidos.filter(m => m !== moduloId)
        : [...prev.modulos_permitidos, moduloId]
    }));
  };

  const selectAllModulos = () => {
    setFormData(prev => ({
      ...prev,
      modulos_permitidos: MODULOS.map(m => m.id)
    }));
  };

  const clearAllModulos = () => {
    setFormData(prev => ({
      ...prev,
      modulos_permitidos: []
    }));
  };

  const filteredAdmins = adminUsers.filter(admin =>
    admin.nome?.toLowerCase().includes(search.toLowerCase()) ||
    admin.email?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      header: 'Administrador',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
            {row.nome?.[0]?.toUpperCase() || 'A'}
          </div>
          <div>
            <p className="font-medium text-slate-900">{row.nome}</p>
            <p className="text-sm text-slate-500">{row.email}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Nível de Acesso',
      render: (row) => {
        const nivel = NIVEIS_ACESSO.find(n => n.value === row.nivel_acesso);
        return (
          <Badge className={nivel?.color || 'bg-slate-100 text-slate-700'}>
            {nivel?.label || row.nivel_acesso}
          </Badge>
        );
      }
    },
    {
      header: 'Módulos',
      render: (row) => (
        <span className="text-sm text-slate-600">
          {row.nivel_acesso === 'super_admin' 
            ? 'Todos' 
            : row.modulos_permitidos?.length 
              ? `${row.modulos_permitidos.length} módulos`
              : 'Todos'
          }
        </span>
      )
    },
    {
      header: 'Status',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.status === 'ativo' ? (
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className={row.status === 'ativo' ? 'text-emerald-600' : 'text-red-600'}>
            {row.status === 'ativo' ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      )
    },
    {
      header: 'Ações',
      className: 'w-24',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-red-500 hover:text-red-700"
            onClick={() => setDeleteId(row.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Portal do Administrador"
        subtitle="Gerencie os usuários com acesso ao sistema"
        icon={Shield}
        actionLabel="Novo Administrador"
        onAction={() => {
          resetForm();
          setShowDialog(true);
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{adminUsers.length}</p>
                <p className="text-sm text-slate-500">Total de Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {adminUsers.filter(a => a.status === 'ativo').length}
                </p>
                <p className="text-sm text-slate-500">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {adminUsers.filter(a => a.nivel_acesso === 'super_admin').length}
                </p>
                <p className="text-sm text-slate-500">Super Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredAdmins}
        isLoading={isLoading}
        emptyComponent={
          <EmptyState
            icon={Shield}
            title="Nenhum administrador cadastrado"
            description="Cadastre o primeiro administrador para controlar o acesso ao sistema"
            actionLabel="Novo Administrador"
            onAction={() => setShowDialog(true)}
          />
        }
      />

      {/* Form Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAdmin ? 'Editar Administrador' : 'Novo Administrador'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Nome *</label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Email *</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Nível de Acesso *</label>
                <Select
                  value={formData.nivel_acesso}
                  onValueChange={(value) => setFormData({ ...formData, nivel_acesso: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NIVEIS_ACESSO.map((nivel) => (
                      <SelectItem key={nivel.value} value={nivel.value}>
                        {nivel.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Status *</label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.nivel_acesso !== 'super_admin' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-slate-700">
                    Módulos Permitidos
                  </label>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={selectAllModulos}>
                      Selecionar todos
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearAllModulos}>
                      Limpar
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Deixe vazio para permitir acesso a todos os módulos
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-4 bg-slate-50 rounded-xl">
                  {MODULOS.map((modulo) => (
                    <label
                      key={modulo.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={formData.modulos_permitidos.includes(modulo.id)}
                        onCheckedChange={() => toggleModulo(modulo.id)}
                      />
                      <span className="text-sm">{modulo.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {editingAdmin ? 'Salvar Alterações' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        title="Remover Administrador"
        description="Tem certeza que deseja remover este administrador? Ele perderá o acesso ao sistema."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}