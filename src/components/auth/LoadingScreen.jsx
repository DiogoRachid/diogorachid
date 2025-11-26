import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <img 
          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6926eb0b6c1242bf806695a4/4053fb920_logofundoescuro.png"
          alt="Virtual Construções" 
          className="h-16 object-contain mx-auto mb-8"
        />
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Verificando acesso...</p>
      </div>
    </div>
  );
}