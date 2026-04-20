import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export const COLOR_SCHEMES = {
  blue:   { primary: '#2563eb', gradient: 'from-slate-900 via-blue-950 to-slate-900', via: 'blue-950', darkest: '#0f172a', footer: '#0c0f1e', heroOverlay: 'from-blue-950/85 via-blue-950/90 to-slate-950/85' },
  green:  { primary: '#16a34a', gradient: 'from-slate-900 via-green-950 to-slate-900', via: 'green-950', darkest: '#0f172a', footer: '#0c3d1a', heroOverlay: 'from-green-950/85 via-green-950/90 to-slate-950/85' },
  slate:  { primary: '#475569', gradient: 'from-slate-950 via-slate-800 to-slate-950', via: 'slate-800', darkest: '#020617', footer: '#0f1419', heroOverlay: 'from-slate-950/85 via-slate-950/90 to-slate-950/85' },
  orange: { primary: '#ea580c', gradient: 'from-slate-900 via-orange-950 to-slate-900', via: 'orange-950', darkest: '#0f172a', footer: '#2a1a0c', heroOverlay: 'from-orange-950/85 via-orange-950/90 to-slate-950/85' },
  violet: { primary: '#7c3aed', gradient: 'from-slate-900 via-violet-950 to-slate-900', via: 'violet-950', darkest: '#0f172a', footer: '#1d0f35', heroOverlay: 'from-violet-950/85 via-violet-950/90 to-slate-950/85' },
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