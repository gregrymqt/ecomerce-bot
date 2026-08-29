/**
 * src/features/admin/components/leads/LeadsToolbar.tsx
 *
 * Barra de ferramentas com busca dinâmica, filtro por estágio, alternador Kanban/Tabela e botão de atualização.
 */

import React from 'react';
import { Search, LayoutGrid, List, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { ViewMode } from '../../hooks/useAdminLeads';

interface LeadsToolbarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedStatusFilter: string;
  setSelectedStatusFilter: (status: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const LeadsToolbar: React.FC<LeadsToolbarProps> = ({
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  selectedStatusFilter,
  setSelectedStatusFilter,
  onRefresh,
  isLoading,
}) => {
  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por empresa, e-mail, telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-base sm:text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[44px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {viewMode === 'table' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold uppercase">Estágio:</span>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-base sm:text-sm text-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[44px]"
              >
                <option value="ALL">Todos os Estágios</option>
                <option value="PENDING">Novos Leads</option>
                <option value="CONTACTED">Em Contato</option>
                <option value="QUALIFIED">Em Negociação</option>
                <option value="CONVERTED">Convertidos</option>
                <option value="REJECTED">Descartados</option>
              </select>
            </div>
          )}

          {/* Alternador de Visão */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer min-h-[44px]',
                viewMode === 'kanban'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer min-h-[44px]',
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <List className="w-4 h-4" />
              Tabela
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            iconLeft={<RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />}
            className="min-h-[44px] bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800"
          >
            Atualizar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LeadsToolbar;
