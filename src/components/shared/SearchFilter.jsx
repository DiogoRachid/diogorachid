import React from 'react';
import { Input } from "@/components/ui/input";
import { Search, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function SearchFilter({ 
  searchValue, 
  onSearchChange, 
  placeholder = "Buscar...",
  filters = [],
  onClearFilters
}) {
  const hasActiveFilters = filters.some(f => f.value && f.value !== 'all');

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="pl-10 border-slate-200"
        />
      </div>
      
      {filters.map((filter, index) => (
        <Select
          key={index}
          value={filter.value}
          onValueChange={filter.onChange}
        >
          <SelectTrigger className="w-full sm:w-40 border-slate-200">
            <SelectValue placeholder={filter.placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {filter.options.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {hasActiveFilters && onClearFilters && (
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onClearFilters}
          className="text-slate-500"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}