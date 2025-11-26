import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AdminAuthContext = createContext(null);

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

export default function AdminAuthProvider({ children, onAccessDenied }) {
  const [adminUser, setAdminUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessStatus, setAccessStatus] = useState('checking'); // 'checking', 'granted', 'denied'

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const user = await base44.auth.me();
      
      if (!user?.email) {
        setAccessStatus('denied');
        setIsLoading(false);
        return;
      }

      // Buscar na entidade AdminUser
      const adminUsers = await base44.entities.AdminUser.filter({ 
        email: user.email,
        status: 'ativo'
      });

      if (adminUsers && adminUsers.length > 0) {
        const admin = adminUsers[0];
        setAdminUser({
          ...admin,
          base44User: user
        });
        
        // Atualizar último acesso
        await base44.entities.AdminUser.update(admin.id, {
          ultimo_acesso: new Date().toISOString()
        });
        
        setAccessStatus('granted');
      } else {
        setAccessStatus('denied');
      }
    } catch (error) {
      console.error('Erro ao verificar acesso admin:', error);
      setAccessStatus('denied');
    } finally {
      setIsLoading(false);
    }
  };

  const hasModuleAccess = (moduleName) => {
    if (!adminUser) return false;
    if (adminUser.nivel_acesso === 'super_admin') return true;
    if (!adminUser.modulos_permitidos || adminUser.modulos_permitidos.length === 0) return true;
    return adminUser.modulos_permitidos.includes(moduleName);
  };

  const value = {
    adminUser,
    isLoading,
    accessStatus,
    hasModuleAccess,
    refreshAccess: checkAdminAccess
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}