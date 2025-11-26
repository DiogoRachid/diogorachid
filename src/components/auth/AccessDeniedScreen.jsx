import React from 'react';
import { ShieldX, LogOut, Mail } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';

export default function AccessDeniedScreen({ userEmail }) {
  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 text-center border border-white/20 shadow-2xl">
          <div className="h-20 w-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <ShieldX className="h-10 w-10 text-red-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">
            Acesso Negado
          </h1>
          
          <p className="text-slate-300 mb-6">
            Você não possui permissão para acessar este sistema. 
            Entre em contato com o administrador para solicitar acesso.
          </p>

          {userEmail && (
            <div className="bg-white/5 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Mail className="h-4 w-4" />
                <span className="text-sm">{userEmail}</span>
              </div>
            </div>
          )}

          <Button 
            onClick={handleLogout}
            variant="outline"
            className="w-full border-white/20 text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair e tentar com outra conta
          </Button>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Virtual Construções - Sistema de Gestão
        </p>
      </div>
    </div>
  );
}