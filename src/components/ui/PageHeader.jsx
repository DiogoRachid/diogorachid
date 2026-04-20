import React from 'react';
import { useColorScheme } from '@/lib/useColorScheme';
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PageHeader({ 
  title, 
  subtitle, 
  actionLabel, 
  onAction, 
  backUrl,
  icon: Icon
}) {
  const { colorScheme } = useColorScheme();

  return (
    <div className="flex flex-col gap-4 mb-6 sm:mb-8">
      <div className="flex items-start gap-3">
        {backUrl && (
          <Link to={backUrl}>
            <Button variant="ghost" size="icon" className="rounded-full flex-shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            {Icon && (
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${colorScheme.primary}19`, color: colorScheme.primary }}>
                <Icon className="h-5 w-5" />
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{title}</h1>
          </div>
          {subtitle && (
            <p className="text-sm sm:text-base text-slate-500 mt-2">{subtitle}</p>
          )}
        </div>
      </div>
      {actionLabel && onAction && (
        <Button 
          onClick={onAction}
          className="text-white w-full sm:w-auto"
          style={{ backgroundColor: colorScheme.primary }}
        >
          <Plus className="h-4 w-4 mr-2" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}