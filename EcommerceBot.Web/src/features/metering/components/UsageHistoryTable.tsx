/**
 * src/features/metering/components/UsageHistoryTable.tsx
 *
 * Tabela detalhada de extrato de consumo de LLM com filtros por data e paginação.
 * Em conformidade com acessibilidade WCAG 2.1 AA, inputs >= 16px e touch targets >= 44px.
 */

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Clock,
  Zap,
  Key,
  Cpu,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui';
import type {
  PaginatedLLMUsageResponse,
  LLMUsageFilterParams,
} from '../types';

export interface UsageHistoryTableProps {
  usageLogs: PaginatedLLMUsageResponse | null;
  isLoading: boolean;
  page: number;
  changePage: (newPage: number) => void;
  applyFilters: (filters: Omit<LLMUsageFilterParams, 'page' | 'limit'>) => void;
  className?: string;
}

export const UsageHistoryTable: React.FC<UsageHistoryTableProps> = ({
  usageLogs,
  isLoading,
  page,
  changePage,
  applyFilters,
}) => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const items = usageLogs?.items ?? [];
  const total = usageLogs?.total ?? 0;
  const limit = usageLogs?.limit ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({
      start_date: startDate ? new Date(startDate).toISOString() : undefined,
      end_date: endDate ? new Date(endDate).toISOString() : undefined,
    });
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    applyFilters({});
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div
      role="region"
      aria-label="Extrato de Consumo de IA"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all"
    >
      {/* Header & Filtros */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Extrato Detalhado de Consumo
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Histórico de requisições de LLM e uso de tokens
              </p>
            </div>
          </div>
        </div>

        {/* Formulário de Filtros de Data */}
        <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="start-date-input" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Data Inicial
            </label>
            <input
              id="start-date-input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[44px]"
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label htmlFor="end-date-input" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Data Final
            </label>
            <input
              id="end-date-input"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[44px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              aria-label="Aplicar Filtros"
              iconLeft={<Filter className="w-4 h-4" />}
              className="min-h-[44px] font-semibold"
            >
              Filtrar
            </Button>
            {(startDate || endDate) && (
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleResetFilters}
                aria-label="Limpar Filtros"
                iconLeft={<RefreshCw className="w-4 h-4" />}
                className="min-h-[44px] font-semibold"
              >
                Limpar
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Tabela de Histórico com Scroll Horizontal */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[650px]">
          <thead>
            <tr className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <th scope="col" className="py-3.5 px-4">Data / Hora</th>
              <th scope="col" className="py-3.5 px-4">Modelo / Provedor</th>
              <th scope="col" className="py-3.5 px-4">Tokens (Prompt / Comp / Total)</th>
              <th scope="col" className="py-3.5 px-4">Custo Est. (USD)</th>
              <th scope="col" className="py-3.5 px-4">Tempo</th>
              <th scope="col" className="py-3.5 px-4 text-right">Origem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            {isLoading ? (
              // Skeleton Loader Rows
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28" /></td>
                  <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-36" /></td>
                  <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24" /></td>
                  <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16" /></td>
                  <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16" /></td>
                  <td className="py-3.5 px-4 text-right"><div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-20 ml-auto" /></td>
                </tr>
              ))
            ) : items.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={6} className="py-12 px-4 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
                    <Zap className="w-8 h-8 stroke-1 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Nenhum registro de consumo de LLM encontrado.
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      As requisições de enriquecimento com IA aparecerão listadas aqui em tempo real.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              items.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                      {log.model_used}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 uppercase font-mono">
                      {log.provider}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono text-xs text-slate-700 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {log.total_tokens.toLocaleString('pt-BR')}
                      </span>{' '}
                      <span className="text-[11px] text-slate-400">
                        ({log.prompt_tokens} / {log.completion_tokens})
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    ${Number(log.estimated_cost_usd).toFixed(6)}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {log.execution_time_ms ?? 0}ms
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {log.is_byok ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <Key className="w-3 h-3 text-emerald-600" /> BYOK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        <Cpu className="w-3 h-3 text-indigo-600" /> SaaS
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer & Paginação */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div>
          Exibindo <span className="font-semibold text-slate-700 dark:text-slate-300">{items.length}</span> de{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-300">{total}</span> registros (Página {page} de {totalPages})
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => changePage(page - 1)}
            aria-label="Página Anterior"
            iconLeft={<ChevronLeft className="w-4 h-4" />}
            className="min-h-[44px] px-4 font-semibold"
          >
            Anterior
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => changePage(page + 1)}
            aria-label="Próxima Página"
            iconRight={<ChevronRight className="w-4 h-4" />}
            className="min-h-[44px] px-4 font-semibold"
          >
            Próximo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UsageHistoryTable;
