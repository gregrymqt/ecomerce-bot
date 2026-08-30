/**
 * src/features/wallet/components/TransactionHistoryTable.tsx
 *
 * Componente de tabela de extrato e histórico de movimentações da carteira.
 * Utiliza os componentes genéricos de UI Card e Table de @/components/ui/display.
 * Em conformidade com acessibilidade WCAG 2.1 AA e touch targets >= 44px.
 */

import React, { useMemo } from 'react';
import {
  History,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import type { CreditTransaction, TransactionHistoryTableProps } from '../types';
import { Card } from '@/components/ui/display/Card';
import { Table, type TableColumn } from '@/components/ui/display/Table';

export const TransactionHistoryTable: React.FC<TransactionHistoryTableProps> = ({
  transactions,
  loading,
  activeFilter,
  onFilterChange,
  totalCount,
  currentPage,
  onPageChange,
  itemsPerPage = 10,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  /**
   * Formata a data ISO para exibição legível em português.
   */
  const formatDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  /**
   * Configuração das colunas para o componente genérico Table
   */
  const columns = useMemo<TableColumn<CreditTransaction>[]>(
    () => [
      {
        key: 'created_at',
        header: 'Data & Hora',
        align: 'left',
        render: (tx) => (
          <span className="font-mono text-xs text-[#cbc3d7]">{formatDate(tx.created_at)}</span>
        ),
      },
      {
        key: 'type',
        header: 'Tipo',
        align: 'left',
        render: (tx) => {
          const isRecharge = tx.type === 'RECHARGE';
          return isRecharge ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              Recarga
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
              Consumo
            </span>
          );
        },
      },
      {
        key: 'description',
        header: 'Descrição / Referência',
        align: 'left',
        render: (tx) => {
          const isRecharge = tx.type === 'RECHARGE';
          return (
            <div className="text-xs font-medium text-[#e7e0ed]">
              {tx.description || (isRecharge ? 'Recarga de Créditos SaaS' : 'Processamento LLM')}
              {tx.external_payment_id && (
                <span className="block text-[11px] font-mono text-[#887f91] mt-0.5">
                  Ref: #{tx.external_payment_id}
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'amount',
        header: 'Valor em Créditos',
        align: 'right',
        render: (tx) => {
          const isRecharge = tx.type === 'RECHARGE';
          const formattedAmount = isRecharge
            ? `+${tx.amount.toLocaleString('pt-BR')} CRD`
            : `-${Math.abs(tx.amount).toLocaleString('pt-BR')} CRD`;

          return (
            <span
              className={`font-mono text-xs font-bold ${
                isRecharge ? 'text-emerald-400' : 'text-[#cbc3d7]'
              }`}
            >
              {formattedAmount}
            </span>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        align: 'center',
        render: () => (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            Concluído
          </span>
        ),
      },
    ],
    []
  );

  /**
   * Retorna o rótulo de intervalo de itens exibidos na paginação.
   */
  const getPaginationInfo = () => {
    if (totalCount === 0) return 'Nenhuma movimentação';
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalCount);
    return `Exibindo ${start}–${end} de ${totalCount} movimentações`;
  };

  return (
    <Card
      glass
      className="bg-[#1d1a23]/70 backdrop-blur-xl border-[#494454] rounded-xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between"
    >
      {/* Header do Card com Título e Filtros (Pills) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <History className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Histórico de Movimentações
            </h3>
            <p className="text-xs text-slate-400">Extrato detalhado de recargas e usos de créditos</p>
          </div>
        </div>

        {/* Filtros em formato de Pills com A11y */}
        <div
          role="tablist"
          aria-label="Filtros de transação"
          className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === 'ALL'}
            onClick={() => onFilterChange('ALL')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all min-h-[44px] sm:min-h-[36px] flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              activeFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === 'RECHARGE'}
            onClick={() => onFilterChange('RECHARGE')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all min-h-[44px] sm:min-h-[36px] flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none ${
              activeFilter === 'RECHARGE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60'
            }`}
          >
            Recargas (+)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === 'USAGE'}
            onClick={() => onFilterChange('USAGE')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all min-h-[44px] sm:min-h-[36px] flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none ${
              activeFilter === 'USAGE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800/60'
            }`}
          >
            Consumos (-)
          </button>
        </div>
      </div>

      {/* Reutilização do componente genérico Table */}
      <div className="mb-6">
        <Table<CreditTransaction>
          columns={columns}
          data={transactions}
          keyExtractor={(tx) => tx.id}
          isLoading={loading}
          emptyMessage="Suas transações de recarga e consumo de créditos aparecerão listadas aqui."
          emptyIcon={<Inbox className="w-6 h-6 text-slate-400" />}
          className="border-slate-800 bg-slate-950/50 text-slate-100"
        />
      </div>

      {/* Paginação */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
        <span className="text-xs text-slate-400">{getPaginationInfo()}</span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1 || loading}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Página Anterior"
            className="flex items-center justify-center p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px] min-w-[44px] cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-semibold text-slate-200 px-2 font-mono">
            {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages || loading}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Próxima Página"
            className="flex items-center justify-center p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px] min-w-[44px] cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  );
};

export default TransactionHistoryTable;
