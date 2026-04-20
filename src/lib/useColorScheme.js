import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export const COLOR_SCHEMES = {
  blue:   { primary: '#2563eb', gradient: 'from-slate-900 via-blue-950 to-slate-900', via: 'blue-950', darkest: '#0f172a', footer: '#0f172a', heroOverlay: 'from-blue-900/60 via-blue-950/70 to-slate-900/60' },
  green:  { primary: '#16a34a', gradient: 'from-slate-900 via-green-950 to-slate-900', via: 'green-950', darkest: '#0f172a', footer: '#0f172a', heroOverlay: 'from-green-900/60 via-green-950/70 to-slate-900/60' },
  slate:  { primary: '#475569', gradient: 'from-slate-950 via-slate-800 to-slate-950', via: 'slate-800', darkest: '#020617', footer: '#020617', heroOverlay: 'from-slate-900/60 via-slate-950/70 to-slate-950/60' },
  orange: { primary: '#ea580c', gradient: 'from-slate-900 via-orange-950 to-slate-900', via: 'orange-950', darkest: '#0f172a', footer: '#0f172a', heroOverlay: 'from-orange-900/60 via-orange-950/70 to-slate-900/60' },
  violet: { primary: '#7c3aed', gradient: 'from-slate-900 via-violet-950 to-slate-900', via: 'violet-950', darkest: '#0f172a', footer: '#0f172a', heroOverlay: 'from-violet-900/60 via-violet-950/70 to-slate-900/60' },
};

export function useColorScheme() {
  const [colorScheme, setColorScheme] = useState(COLOR_SCHEMES.blue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.CompanySettings.list().then(r => {
      if (r.length > 0 && r[0].site_color_scheme) {
        setColorScheme(COLOR_SCHEMES[r[0].site_color_scheme] || COLOR_SCHEMES.blue);
      }
      setLoading(false);
    });
  }, []);

  return { colorScheme, loading };
}