import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Shield, HardHat, ArrowLeft, Lock } from 'lucide-react';
import { useColorScheme } from '@/lib/useColorScheme';

const LOGO_ESCURA = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6926eb0b6c1242bf806695a4/4053fb920_logofundoescuro.png";

export default function PortalSelect() {
  const [companySettings, setCompanySettings] = useState(null);
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    base44.entities.CompanySettings.list().then(r => { if (r.length > 0) setCompanySettings(r[0]); });
  }, []);

  const logoUrl = companySettings?.logo_url_escura || LOGO_ESCURA;
  const nomeEmpresa = companySettings?.nome_empresa || 'Virtual Construções Civis';

  const portais = [
    {
      icon: Shield,
      titulo: "Portal Administrador",
      desc: "Acesso completo ao sistema ERP: financeiro, RH, orçamentos, obras, relatórios e configurações.",
      badge: "Acesso Total",
      href: createPageUrl('AdminLogin')
    },
    {
      icon: HardHat,
      titulo: "Portal Colaborador",
      desc: "Acesso restrito aos módulos liberados pela administração: obras, orçamentos, planejamento e mais.",
      badge: "Acesso Restrito",
      href: createPageUrl('ColaboradorLogin')
    }
  ];

  return (
    <div className={`min-h-screen bg-gradient-to-br ${colorScheme.gradient} flex flex-col items-center justify-center px-4 py-12`}>
      {/* Logo */}
      <div className="mb-10 text-center">
        <img src={logoUrl} alt={nomeEmpresa} className="h-14 object-contain mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Selecione o portal de acesso</p>
      </div>

      {/* Cards de portal */}
      <div className="grid sm:grid-cols-2 gap-6 w-full max-w-2xl">
        {portais.map((p, i) => (
          <Link key={i} to={p.href}
            className="group bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-7 transition-all duration-200 hover:bg-white/10 hover:scale-105 hover:shadow-2xl"
            style={{ '--hover-border': colorScheme.primary }}>
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-5 shadow-lg" style={{ background: `linear-gradient(135deg, ${colorScheme.primary}, ${colorScheme.primary}cc)` }}>
              <p.icon className="h-7 w-7 text-white" />
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full mb-3 inline-block text-white" style={{ backgroundColor: `${colorScheme.primary}33` }}>
              {p.badge}
            </span>
            <h2 className="text-xl font-bold text-white mb-2">{p.titulo}</h2>
            <p className="text-slate-400 text-sm leading-relaxed">{p.desc}</p>
            <div className="mt-5 flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all" style={{ color: colorScheme.primary }}>
              <Lock className="h-4 w-4" /> Entrar com autenticação
            </div>
          </Link>
        ))}
      </div>

      {/* Voltar */}
      <Link to={createPageUrl('LandingPage')} className="mt-10 flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm transition-colors">
        <ArrowLeft className="h-4 w-4" /> Voltar ao site
      </Link>

      <p className="mt-6 text-slate-600 text-xs text-center">
        © {new Date().getFullYear()} {nomeEmpresa} — Acesso restrito a usuários autorizados
      </p>
    </div>
  );
}