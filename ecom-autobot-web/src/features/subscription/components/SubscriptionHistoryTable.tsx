import React, { useState } from 'react';
import {
  RefreshCw,
  Filter,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import type { Subscription, SubscriptionStatus } from '../types/subscription.type';
import { Table, type TableColumn } from '@/components/ui/display/Table';
import { Badge, type BadgeVariant } from '@/components/ui/feedback/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/overlay/ConfirmDialog';
import { cn } from '@/utils/cn';

export interface SubscriptionHistoryTableProps {
  subscriptions: Subscription[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  statusFilter?: SubscriptionStatus;
  onStatusFilterChange?: (status?: SubscriptionStatus) => void;
  loading?: boolean;
  actionLoading?: boolean;
  onExportCsv: () => void;
  onSyncSubscription?: (id: string) => Promise<unknown>;
  onCancelSubscription?: (id: string) => Promise<unknown>;
  className?: string;
}

export const SubscriptionHistoryTable: React.FC<SubscriptionHistoryTableProps> = ({
  subscriptions,
  total,
  page,
  limit,
  onPageChange,
  statusFilter,
  onStatusFilterChange,
  loading = false,
  actionLoading = false,
  onExportCsv,
  onSyncSubscription,
  onCancelSubscription,
  className,
}) => {
  const [selectedSubForCancel, setSelectedSubForCancel] = useState<Subscription | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const totalPages = Math.ceil(total / limit) || 1;

  // Formatação de Datas
  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  // Formatação de Moeda BRL
  const formatCurrency = (amount?: number | null, currency = 'BRL'): string => {
    if (amount == null) return 'R$ 0,00';
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency || 'BRL',
      }).format(amount);
    } catch {
      return `R$ ${amount.toFixed(2)}`;
    }
  };

  // Badge por Status com Cores Requeridas
  const renderStatusBadge = (status: SubscriptionStatus) => {
    const badgeMap: Record<SubscriptionStatus, { variant: BadgeVariant; label: string }> = {
      authorized: { variant: 'success', label: 'Autorizada' },
      pending: { variant: 'warning', label: 'Pendente' },
      cancelled: { variant: 'error', label: 'Cancelada' },
      paused: { variant: 'info', label: 'Pausada' },
    };

    const config = badgeMap[status] || { variant: 'default', label: status };

    return (
      <Badge variant={config.variant} dot>
        {config.label}
      </Badge>
    );
  };

  const handleSync = async (id: string) => {
    if (!onSyncSubscription) return;
    setSyncingId(id);
    try {
      await onSyncSubscription(id);
    } finally {
      setSyncingId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (selectedSubForCancel && onCancelSubscription) {
      await onCancelSubscription(selectedSubForCancel.id);
      setSelectedSubForCancel(null);
    }
  };

  // Definição das Colunas da Tabela
  const columns: TableColumn<Subscription>[] = [
    {
      key: 'reason',
      header: 'Plano / Referência',
      render: (sub) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
            {sub.reason || `Assinatura #${sub.id.slice(0, 8)}`}
          </span>
          <span className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">
            MP ID: {sub.preapproval_id}
          </span>
        </div>
      ),
    },
    {
      key: 'payer_email',
      header: 'E-mail do Pagador',
      render: (sub) => (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[180px] block" title={sub.payer_email}>
          {sub.payer_email || '-'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Valor Mensal',
      render: (sub) => {
        const amt = sub.auto_recurring?.transaction_amount;
        const curr = sub.auto_recurring?.currency_id || 'BRL';
        return (
          <span className="font-bold text-slate-900 dark:text-white text-xs">
            {formatCurrency(amt, curr)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (sub) => renderStatusBadge(sub.status),
    },
    {
      key: 'next_payment_date',
      header: 'Próx. Cobrança',
      render: (sub) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {formatDate(sub.next_payment_date)}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Data de Criação',
      render: (sub) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {formatDate(sub.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (sub) => (
        <div className="flex items-center justify-end gap-1.5">
          {onSyncSubscription && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Sincronizar dados com o Mercado Pago"
              isLoading={syncingId === sub.id}
              onClick={(e) => {
                e.stopPropagation();
                handleSync(sub.id);
              }}
            >
              {!syncingId && <RefreshCw className="w-4 h-4" />}
            </Button>
          )}

          {sub.init_point && (
            <a
              href={sub.init_point}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
              title="Abrir checkout no Mercado Pago"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {sub.status === 'authorized' && onCancelSubscription && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSubForCancel(sub);
              }}
            >
              Cancelar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Barra de Filtros e Exportação CSV */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Filtrar:
          </span>

          {[
            { id: undefined, label: 'Todas' },
            { id: 'authorized', label: 'Autorizadas' },
            { id: 'pending', label: 'Pendentes' },
            { id: 'cancelled', label: 'Canceladas' },
            { id: 'paused', label: 'Pausadas' },
          ].map((item) => {
            const isActive = statusFilter === item.id;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => onStatusFilterChange?.(item.id as SubscriptionStatus | undefined)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 shrink-0 min-h-[36px] cursor-pointer',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Botão de Exportação para CSV */}
        <Button
          type="button"
          variant="outline"
          size="md"
          className="w-full sm:w-auto h-11 min-h-[44px] text-sm font-semibold border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          iconLeft={<FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          onClick={onExportCsv}
          isLoading={actionLoading}
        >
          Exportar CSV
        </Button>
      </div>

      {/* Tabela de Assinaturas */}
      <Table
        columns={columns}
        data={subscriptions}
        keyExtractor={(sub) => sub.id}
        isLoading={loading}
        emptyMessage="Nenhuma assinatura encontrada para o filtro selecionado."
        emptyIcon={<AlertCircle className="w-8 h-8 text-slate-400" />}
      />

      {/* Rodapé de Paginação */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Mostrando <strong className="text-slate-900 dark:text-white">{subscriptions.length}</strong> de{' '}
            <strong className="text-slate-900 dark:text-white">{total}</strong> registros (Página {page} de {totalPages})
          </span>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
              className="h-11 min-h-[44px] sm:h-9 sm:min-h-0 px-3"
              iconLeft={<ChevronLeft className="w-4 h-4" />}
            >
              Anterior
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
              className="h-11 min-h-[44px] sm:h-9 sm:min-h-0 px-3"
              iconRight={<ChevronRight className="w-4 h-4" />}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Dialog de Confirmação de Cancelamento por Linha */}
      {selectedSubForCancel && (
        <ConfirmDialog
          isOpen={Boolean(selectedSubForCancel)}
          onClose={() => setSelectedSubForCancel(null)}
          onConfirm={handleConfirmCancel}
          variant="danger"
          title="Confirmar Cancelamento"
          description={
            <span>
              Deseja cancelar a assinatura do pagador{' '}
              <strong>{selectedSubForCancel.payer_email}</strong> (ID MP: {selectedSubForCancel.preapproval_id})?
            </span>
          }
          confirmText="Sim, Cancelar"
          cancelText="Voltar"
          isLoading={actionLoading}
        />
      )}
    </div>
  );
};
