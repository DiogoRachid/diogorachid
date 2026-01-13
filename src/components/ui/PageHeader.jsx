import React from 'react';
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
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-blue-600" />
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
          className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}