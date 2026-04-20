import React from 'react';
import { Check } from 'lucide-react';

const COLOR_SCHEMES = [
  {
    id: 'blue',
    label: 'Azul (Padrão)',
    primary: '#2563eb',
    accent: '#1d4ed8',
    heroOverlay: 'from-slate-900/85 via-blue-900/70 to-slate-900/80',
    numbersSection: 'bg-blue-700',
    ctaSection: 'from-blue-700 to-blue-900',
    preview: ['#2563eb', '#1d4ed8', '#1e40af'],
  },
  {
    id: 'green',
    label: 'Verde',
    primary: '#16a34a',
    accent: '#15803d',
    heroOverlay: 'from-slate-900/85 via-green-900/70 to-slate-900/80',
    numbersSection: 'bg-green-700',
    ctaSection: 'from-green-700 to-green-900',
    preview: ['#16a34a', '#15803d', '#14532d'],
  },
  {
    id: 'slate',
    label: 'Cinza Escuro',
    primary: '#475569',
    accent: '#334155',
    heroOverlay: 'from-slate-900/85 via-slate-700/70 to-slate-900/80',
    numbersSection: 'bg-slate-700',
    ctaSection: 'from-slate-700 to-slate-900',
    preview: ['#475569', '#334155', '#1e293b'],
  },
  {
    id: 'orange',
    label: 'Laranja',
    primary: '#ea580c',
    accent: '#c2410c',
    heroOverlay: 'from-slate-900/85 via-orange-900/70 to-slate-900/80',
    numbersSection: 'bg-orange-600',
    ctaSection: 'from-orange-600 to-orange-900',
    preview: ['#ea580c', '#c2410c', '#7c2d12'],
  },
  {
    id: 'violet',
    label: 'Roxo',
    primary: '#7c3aed',
    accent: '#6d28d9',
    heroOverlay: 'from-slate-900/85 via-violet-900/70 to-slate-900/80',
    numbersSection: 'bg-violet-700',
    ctaSection: 'from-violet-700 to-violet-900',
    preview: ['#7c3aed', '#6d28d9', '#4c1d95'],
  },
];

export { COLOR_SCHEMES };

export default function SiteColorSchemeEditor({ value, onChange }) {
  const current = value || 'blue';

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Escolha o esquema de cores principal do site da empresa.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {COLOR_SCHEMES.map(scheme => (
          <button
            key={scheme.id}
            onClick={() => onChange(scheme.id)}
            className={`relative rounded-xl border-2 p-3 flex flex-col items-center gap-2 transition-all hover:shadow-md ${
              current === scheme.id
                ? 'border-blue-600 shadow-md'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            {current === scheme.id && (
              <div className="absolute top-1.5 right-1.5 bg-blue-600 rounded-full p-0.5">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
            <div className="flex gap-1">
              {scheme.preview.map((color, i) => (
                <div
                  key={i}
                  className="h-6 w-6 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-slate-700">{scheme.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}