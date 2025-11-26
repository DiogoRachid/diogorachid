import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus, FileQuestion } from 'lucide-react';

export default function EmptyState({ 
  icon: Icon = FileQuestion,
  title, 
  description, 
  actionLabel, 
  onAction 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 text-center max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button 
          onClick={onAction}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}