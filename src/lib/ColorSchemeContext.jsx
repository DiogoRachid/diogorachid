import React, { createContext, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const COLOR_SCHEMES = {
  blue:   { primary: '#2563eb', gradient: 'from-slate-900 via-blue-950 to-slate-900', via: 'blue-950', darkest: '#0f172a', footer: '#0c0f1e', heroOverlay: 'from-blue-950/85 via-blue-950/90 to-slate-950/85' },
  green:  { primary: '#16a34a', gradient: 'from-slate-900 via-green-950 to-slate-900', via: 'green-950', darkest: '#0f172a', footer: '#0c3d1a', heroOverlay: 'from-green-950/85 via-green-950/90 to-slate-950/85' },
  slate:  { primary: '#475569', gradient: 'from-slate-950 via-slate-800 to-slate-950', via: 'slate-800', darkest: '#020617', footer: '#0f1419', heroOverlay: 'from-slate-950/85 via-slate-950/90 to-slate-950/85' },
  orange: { primary: '#ea580c', gradient: 'from-slate-900 via-orange-950 to-slate-900', via: 'orange-950', darkest: '#0f172a', footer: '#2a1a0c', heroOverlay: 'from-orange-950/85 via-orange-950/90 to-slate-950/85' },
  violet: { primary: '#7c3aed', gradient: 'from-slate-900 via-violet-950 to-slate-900', via: 'violet-950', darkest: '#0f172a', footer: '#1d0f35', heroOverlay: 'from-violet-950/85 via-violet-950/90 to-slate-950/85' },
};

const ColorSchemeContext = createContext(null);

export function ColorSchemeProvider({ children }) {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-slate-300 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ColorSchemeContext.Provider value={{ colorScheme }}>
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function useColorScheme() {
  const context = useContext(ColorSchemeContext);
  if (!context) {
    return { colorScheme: COLOR_SCHEMES.blue, loading: false };
  }
  return context;
}

export { COLOR_SCHEMES };