import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { History, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import DeleteConfirmDialog from '@/components/shared/DeleteConfirmDialog';
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

export default function VersionHistoryForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const versionId = urlParams.get('id');
  const isEdit = !!versionId;

  const today = new Date().toISOString().split('T')[0];
  
  const [formData, setFormData] = useState({
    versao: '',
    data_lancamento: today,
    titulo: '',
    descricao: '',
    status: 'ativo'
  });

  const [alteracoes, setAlteracoes] = useState([]);

  const { data: version, isLoading } = useQuery({
    queryKey: ['version', versionId],
    queryFn: () => base44.entities.VersionHistory.filter({ id: versionId }).then(res => res[0]),
    enabled: isEdit
  });

  useEffect(() => {
    if (version) {
      setFormData({
        versao: version.versao || '',
        data_lancamento: version.data_lancamento || today,
        titulo: version.titulo || '',
        descricao: version.descricao || '',
        status: version.status || 'ativo'
      });
      setAlteracoes(version.alteracoes || []);
    }
  }, [version]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        alteracoes
      };

      if (isEdit) {
        return base44.entities.VersionHistory.update(versionId, payload);
      }
      return base44.entities.VersionHistory.create(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Versão atualizada!' : 'Versão registrada!');
      window.location.href = createPageUrl('VersionHistory');
    },
    onError: (error) => {
      toast.error('Erro ao salvar versão');
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

  const addAlteracao = () => {
    setAlteracoes(prev => [...prev, { tipo: 'novo', descricao: '' }]);
  };

  const removeAlteracao = (index) => {
    setAlteracoes(prev => prev.filter((_, i) => i !== index));
  };

  const updateAlteracao = (index, field, value) => {
    setAlteracoes(prev => prev.map((alt, i) => 
      i === index ? { ...alt, [field]: value } : alt
    ));
  };

  if (isEdit && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={isEdit ? 'Editar Versão' : 'Nova Versão'}
        subtitle={isEdit ? 'Atualize os dados da versão' : 'Registre uma nova atualização'}
        icon={History}
        backUrl={createPageUrl('VersionHistory')}
      />

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Dados da Versão */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados da Versão</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="versao">Número da Versão *</Label>
                <Input
                  id="versao"
                  value={formData.versao}
                  onChange={(e) => handleChange('versao', e.target.value)}
                  placeholder="1.0.0"
                  required
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="data_lancamento">Data de Lançamento *</Label>
                <Input
                  id="data_lancamento"
                  type="date"
                  value={formData.data_lancamento}
                  onChange={(e) => handleChange('data_lancamento', e.target.value)}
                  required
                  className="mt-1.5"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => handleChange('titulo', e.target.value)}
                  placeholder="Ex: Melhorias no módulo financeiro"
                  required
                  className="mt-1.5"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => handleChange('descricao', e.target.value)}
                  rows={3}
                  placeholder="Descreva resumidamente as mudanças desta versão..."
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>

          {/* Alterações */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Alterações</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addAlteracao}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent>
              {alteracoes.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">
                  Nenhuma alteração adicionada. Clique em "Adicionar" para começar.
                </p>
              ) : (
                <div className="space-y-4">
                  {alteracoes.map((alt, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-3 p-4 bg-slate-50 rounded-lg">
                      <div className="w-full sm:w-40">
                        <Select
                          value={alt.tipo}
                          onValueChange={(value) => updateAlteracao(index, 'tipo', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="novo">Novo</SelectItem>
                            <SelectItem value="melhoria">Melhoria</SelectItem>
                            <SelectItem value="correcao">Correção</SelectItem>
                            <SelectItem value="removido">Removido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Input
                          value={alt.descricao}
                          onChange={(e) => updateAlteracao(index, 'descricao', e.target.value)}
                          placeholder="Descrição da alteração..."
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAlteracao(index)}
                        className="text-red-600 hover:text-red-700 self-start sm:self-center"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
              {isEdit ? 'Salvar Alterações' : 'Registrar Versão'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.href = createPageUrl('VersionHistory')}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}