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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-4">
        {backUrl && (
          <Link to={backUrl}>
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        )}
        <div>
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Icon className="h-5 w-5 text-blue-600" />
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          </div>
          {subtitle && (
            <p className="text-slate-500 mt-1 ml-0 sm:ml-13">{subtitle}</p>
          )}
        </div>
      </div>
      {actionLabel && onAction && (
        <Button 
          onClick={onAction}
          className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25"
        >
          <Plus className="h-4 w-4 mr-2" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}