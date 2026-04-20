import React, { createContext, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const COLOR_SCHEMES = {
  blue:   { primary: '#2563eb', gradient: 'from-slate-900 via-blue-950 to-slate-900', via: 'blue-950', darkest: '#0f172a', footer: '#1e3a8a' },
  green:  { primary: '#16a34a', gradient: 'from-slate-900 via-green-950 to-slate-900', via: 'green-950', darkest: '#0f172a', footer: '#15803d' },
  slate:  { primary: '#475569', gradient: 'from-slate-950 via-slate-800 to-slate-950', via: 'slate-800', darkest: '#020617', footer: '#1e293b' },
  orange: { primary: '#ea580c', gradient: 'from-slate-900 via-orange-950 to-slate-900', via: 'orange-950', darkest: '#0f172a', footer: '#c2410c' },
  violet: { primary: '#7c3aed', gradient: 'from-slate-900 via-violet-950 to-slate-900', via: 'violet-950', darkest: '#0f172a', footer: '#6d28d9' },
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