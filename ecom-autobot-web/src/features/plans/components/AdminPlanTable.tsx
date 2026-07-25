import React, { useState } from 'react';
import {
  Edit2,
  ExternalLink,
  RefreshCw,
  Gift,
  AlertCircle,
  Layers,
} from 'lucide-react';
import type { Plan } from '../types/plan.type';
import { Table, type TableColumn } from '@/components/ui/display/Table';
import { Badge, type BadgeVariant } from '@/components/ui/feedback/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/overlay/ConfirmDialog';
import { cn } from '@/utils/cn';

export interface AdminPlanTableProps {
  plans: Plan[];
  loading?: boolean;
  actionLoading?: boolean;
  onEditPlan?: (plan: Plan) => void;
  onCancelPlan?: (planId: string) => Promise<unknown>;
  onRefresh?: () => void;
  className?: string;
}

export const AdminPlanTable: React.FC<AdminPlanTableProps> = ({
  plans,
  loading = false,
  actionLoading = false,
  onEditPlan,
  onCancelPlan,
  onRefresh,
  className,
}) => {
  const [selectedPlanForCancel, setSelectedPlanForCancel] = useState<Plan | null>(null);

  // Formatação de valor em Reais R$
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

  // Formatação de ciclo
  const formatCycle = (autoRecurring: any): string => {
    if (!autoRecurring) return '/mês';
    const freq = autoRecurring.frequency || 1;
    const type = autoRecurring.frequency_type === 'months' ? 'mês' : 'dia';
    return freq === 1 ? `/${type}` : `a cada ${freq} ${type}s`;
  };

  // Badge de Status do Plano (ativo = verde, cancelado = vermelho)
  const renderStatusBadge = (status: string) => {
    const isCanceled = status === 'canceled' || status === 'cancelled';
    const variant: BadgeVariant = isCanceled ? 'error' : 'success';
    const label = isCanceled ? 'Cancelado' : 'Ativo';

    return (
      <Badge variant={variant} dot>
        {label}
      </Badge>
    );
  };

  const handleConfirmCancel = async () => {
    if (selectedPlanForCancel && onCancelPlan) {
      await onCancelPlan(selectedPlanForCancel.id);
      setSelectedPlanForCancel(null);
    }
  };

  // Definição das colunas
  const columns: TableColumn<Plan>[] = [
    {
      key: 'id',
      header: 'ID do Plano',
      render: (plan) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400 select-all" title={plan.id}>
          {plan.id}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Nome / Razão',
      render: (plan) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900 dark:text-white truncate max-w-[220px]">
            {plan.reason}
          </span>
          {plan.external_id && (
            <span className="text-[11px] font-mono text-slate-400">Ext ID: {plan.external_id}</span>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Valor Mensal',
      render: (plan) => {
        const auto = plan.auto_recurring as any;
        const amt = auto?.transaction_amount;
        const curr = auto?.currency_id || 'BRL';
        return (
          <div className="flex flex-col">
            <span className="font-extrabold text-slate-900 dark:text-white text-xs">
              {formatCurrency(amt, curr)} {formatCycle(auto)}
            </span>
            {auto?.free_trial?.frequency > 0 && (
              <span className="text-[10px] text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <Gift className="w-3 h-3" /> {auto.free_trial.frequency}d grátis
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (plan) => renderStatusBadge(plan.status),
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (plan) => {
        const isCanceled = plan.status === 'canceled' || plan.status === 'cancelled';

        return (
          <div className="flex items-center justify-end gap-1.5">
            {plan.init_point && (
              <a
                href={plan.init_point}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                title="Abrir Checkout do Mercado Pago"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {onEditPlan && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Editar Plano"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditPlan(plan);
                }}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            )}

            {!isCanceled && onCancelPlan && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                title="Cancelar Plano"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlanForCancel(plan);
                }}
              >
                Inativar
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Barra Superior da Tabela */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Planos Cadastrados ({plans.length})
          </span>
        </div>

        {onRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-9 px-3 text-xs"
            iconLeft={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Atualizar
          </Button>
        )}
      </div>

      {/* Tabela de Dados */}
      <Table
        columns={columns}
        data={plans}
        keyExtractor={(p) => p.id}
        isLoading={loading}
        emptyMessage="Nenhum plano cadastrado no sistema."
        emptyIcon={<AlertCircle className="w-8 h-8 text-slate-400" />}
      />

      {/* Dialog de Confirmação de Cancelamento de Plano */}
      {selectedPlanForCancel && (
        <ConfirmDialog
          isOpen={Boolean(selectedPlanForCancel)}
          onClose={() => setSelectedPlanForCancel(null)}
          onConfirm={handleConfirmCancel}
          variant="danger"
          title="Inativar Plano de Assinatura?"
          description={
            <div className="space-y-2 text-left">
              <p>
                Deseja inativar o plano <strong>{selectedPlanForCancel.reason}</strong> (ID:{' '}
                <span className="font-mono">{selectedPlanForCancel.id}</span>)?
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60">
                O status será alterado para &quot;canceled&quot; no Mercado Pago. Nenhuma nova assinatura poderá ser criada sob este plano.
              </p>
            </div>
          }
          confirmText="Sim, Inativar Plano"
          cancelText="Cancelar"
          isLoading={actionLoading}
        />
      )}
    </div>
  );
};
