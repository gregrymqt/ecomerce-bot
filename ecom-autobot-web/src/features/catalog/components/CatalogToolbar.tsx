import React from 'react';
import { Search, Plus, Download, Package, RefreshCw } from 'lucide-react';
import { Button, Input, Badge } from '@/components/ui';
import { cn } from '@/utils/cn';
import type { FilterStatus } from '@/features/catalog';

export interface CatalogToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: FilterStatus;
  onStatusFilterChange: (status: FilterStatus) => void;
  onNewIngestionClick?: () => void;
  onExportBatchClick?: () => void;
  onBulkSyncClick?: () => void;
  selectedCount?: number;
  totalCount?: number;
}

interface FilterOption {
  key: FilterStatus;
  label: string;
  activeClass: string;
  badgeClass?: string;
  count?: number;
}

export const CatalogToolbar: React.FC<CatalogToolbarProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onNewIngestionClick,
  onExportBatchClick,
  onBulkSyncClick,
  selectedCount = 0,
  totalCount,
}) => {
  const filterOptions: FilterOption[] = [
    {
      key: 'ALL',
      label: 'Todos',
      activeClass: 'bg-violet-600/20 text-violet-300 border-violet-500/50 shadow-sm shadow-violet-500/10',
    },
    {
      key: 'PROCESSED',
      label: 'Processados',
      activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/10',
    },
    {
      key: 'PROCESSING',
      label: 'Em Processamento',
      activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/10',
    },
    {
      key: 'RAW',
      label: 'Brutos/RAW',
      activeClass: 'bg-slate-700/60 text-slate-200 border-slate-600 shadow-sm',
    },
    {
      key: 'FAILED',
      label: 'Erros',
      activeClass: 'bg-red-500/20 text-red-300 border-red-500/50 shadow-sm shadow-red-500/10',
    },
  ];

  return (
    <div className="w-full space-y-5 bg-[#15121B] p-5 rounded-2xl border border-slate-800 shadow-xl">
      {/* Top Header: Title & Main Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-600/10 border border-violet-500/20 rounded-xl text-violet-400">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              Central de Catálogo
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Gerencie, filtre e expanda seus produtos enriquecidos por IA</span>
              {typeof totalCount === 'number' && (
                <Badge variant="info">
                  {totalCount} {totalCount === 1 ? 'produto' : 'produtos'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {onBulkSyncClick && (
            <Button
              variant="secondary"
              onClick={onBulkSyncClick}
              disabled={selectedCount === 0}
              iconLeft={<RefreshCw className="w-4 h-4 text-violet-400" />}
              className={selectedCount > 0 ? 'border-violet-500/50 text-violet-300 bg-violet-600/10' : ''}
            >
              Sincronizar em Lote {selectedCount > 0 ? `(${selectedCount})` : ''}
            </Button>
          )}

          {onExportBatchClick && (
            <Button
              variant="secondary"
              onClick={onExportBatchClick}
              iconLeft={<Download className="w-4 h-4 text-slate-400" />}
            >
              Exportar Lote
            </Button>
          )}

          {onNewIngestionClick && (
            <Button
              variant="primary"
              onClick={onNewIngestionClick}
              iconLeft={<Plus className="w-4 h-4 stroke-[2.5]" />}
            >
              Nova Ingestão
            </Button>
          )}
        </div>
      </div>

      {/* Middle Row: Search Bar & Filter Pills */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-2 border-t border-slate-800/60">
        {/* Search Input */}
        <div className="relative flex-1 max-w-full lg:max-w-md">
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por título, SKU ou marca..."
            iconLeft={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {filterOptions.map((filter) => {
            const isActive = statusFilter === filter.key;
            return (
              <button
                key={filter.key}
                onClick={() => onStatusFilterChange(filter.key)}
                className={cn(
                  'min-h-[44px] h-11 px-3.5 py-2 rounded-xl text-xs font-medium border whitespace-nowrap transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer',
                  isActive
                    ? filter.activeClass
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800/60 hover:text-slate-200'
                )}
              >
                {filter.key === 'PROCESSING' && isActive && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
                <span>{filter.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

