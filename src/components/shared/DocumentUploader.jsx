import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, Loader2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function DocumentUploader({ documents = [], onChange, disabled }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    const newDocs = [...documents];

    for (const file of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        newDocs.push({
          nome: file.name,
          url: file_url,
          data_upload: new Date().toISOString()
        });
      } catch (error) {
        console.error('Erro ao fazer upload:', error);
      }
    }

    onChange(newDocs);
    setUploading(false);
  };

  const handleRemove = (index) => {
    const newDocs = documents.filter((_, i) => i !== index);
    onChange(newDocs);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="cursor-pointer">
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={disabled || uploading}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
          />
          <div className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            ) : (
              <Upload className="h-5 w-5 text-slate-400" />
            )}
            <span className="text-sm text-slate-600">
              {uploading ? 'Enviando...' : 'Anexar documentos'}
            </span>
          </div>
        </label>
      </div>

      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{doc.nome}</p>
                  {doc.data_upload && (
                    <p className="text-xs text-slate-500">
                      {format(new Date(doc.data_upload), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={doc.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <ExternalLink className="h-4 w-4 text-slate-500" />
                </a>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}