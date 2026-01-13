import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Registra automaticamente uma entrada no histórico de versões
 * Uso: await base44.functions.invoke('autoVersionLog', { titulo, descricao, alteracoes })
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { titulo, descricao, alteracoes } = await req.json();

    // Buscar a última versão registrada
    const versions = await base44.asServiceRole.entities.VersionHistory.list('-created_date', 1);
    
    // Calcular próximo número de versão
    let nextVersion = '1.0.0';
    if (versions.length > 0) {
      const lastVersion = versions[0].versao;
      const parts = lastVersion.split('.');
      const patch = parseInt(parts[2] || 0) + 1;
      nextVersion = `${parts[0]}.${parts[1]}.${patch}`;
    }

    // Criar nova entrada de versão
    const today = new Date().toISOString().split('T')[0];
    const newVersion = await base44.asServiceRole.entities.VersionHistory.create({
      versao: nextVersion,
      data_lancamento: today,
      titulo: titulo || 'Atualização automática',
      descricao: descricao || '',
      alteracoes: alteracoes || [],
      status: 'ativo'
    });

    return Response.json({ 
      success: true, 
      version: newVersion,
      message: `Versão ${nextVersion} registrada automaticamente`
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});