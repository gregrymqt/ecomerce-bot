/**
 * src/features/plans/components/AdminPlanTable.tsx
 *
 * Tabela responsiva de alta performance para exibição de planos de assinatura.
 * Em conformidade com acessibilidade WCAG 2.1 AA e touch targets mínimos de 44px.
 */

import React from 'react';
import { Edit2, ExternalLink, Power, RefreshCw, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import type { PlanResponse } from '../types';

export interface AdminPlanTableProps {
  plans: PlanResponse[];
  loading: boolean;
  onEdit: (plan: PlanResponse) => void;
  onToggleStatus: (plan: PlanResponse) => void;
  onRefresh: () => void;
}

export const AdminPlanTable: React.FC<AdminPlanTableProps> = ({
  plans,
  loading,
  onEdit,
  onToggleStatus,
  onRefresh,
}) => {
  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  const getStatusBadge = (plan: PlanResponse) => {
    const isAct = plan.isActive ?? plan.status === 'active';
    return (
      <Badge
        variant={isAct ? 'success' : 'error'}
        icon={isAct ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      >
        {isAct ? 'Ativo' : 'Inativo'}
      </Badge>
    );
  };

  const getFrequencyLabel = (interval?: string, auto?: PlanResponse['auto_recurring']) => {
    if (interval) {
      switch (interval.toUpperCase()) {
        case 'MONTHLY':
          return 'Mensal';
        case 'YEARLY':
          return 'Anual';
        case 'WEEKLY':
          return 'Semanal';
        default:
          return interval;
      }
    }
    if (auto) {
      const freq = auto.frequency || 1;
      const type = auto.frequency_type === 'months' ? 'Mês(es)' : 'Dia(s)';
      return `A cada ${freq} ${type}`;
    }
    return 'Mensal';
  };

  if (loading && plans.length === 0) {
    return (
      <div
        role="status"
        aria-label="Carregando catálogo de planos"
        className="flex flex-col items-center justify-center p-12 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md"
      >
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
        <p className="text-slate-400 font-medium font-mono text-sm">Carregando catálogo de planos...</p>
      </div>
    );
  }

  if (!loading && plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-900/90 border border-slate-800 rounded-2xl text-center shadow-xl backdrop-blur-md">
        <ShieldAlert className="w-12 h-12 text-slate-500 mb-3" />
        <h3 className="text-lg font-semibold text-slate-200">Nenhum plano encontrado</h3>
        <p className="text-slate-400 max-w-md mt-1 text-sm">
          Não foram encontrados planos com os filtros selecionados. Crie um novo plano ou altere os termos de busca.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onRefresh}
          iconLeft={<RefreshCw className="w-4 h-4" />}
          className="mt-4 min-h-[44px]"
        >
          Recarregar
        </Button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Tabela de Planos de Assinatura"
      className="w-full overflow-hidden bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              <th scope="col" className="py-4 px-6 font-mono uppercase">Plano & Descrição</th>
              <th scope="col" className="py-4 px-4 font-mono uppercase">Valor Recorrente</th>
              <th scope="col" className="py-4 px-4 font-mono uppercase">Frequência</th>
              <th scope="col" className="py-4 px-4 font-mono uppercase">Créditos</th>
              <th scope="col" className="py-4 px-4 font-mono uppercase">Trial</th>
              <th scope="col" className="py-4 px-4 text-center font-mono uppercase">Status</th>
              <th scope="col" className="py-4 px-6 text-right font-mono uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {plans.map((plan) => {
              const amount = plan.price ?? plan.auto_recurring?.transaction_amount;
              const trialDays = plan.trialDays ?? plan.auto_recurring?.free_trial?.frequency;
              const credits = plan.creditsIncluded ?? 0;
              const isAct = plan.isActive ?? plan.status === 'active';

              return (
                <tr
                  key={plan.id}
                  className="hover:bg-slate-800/40 transition-colors group"
                >
                  <td className="py-4 px-6">
                    <div className="font-semibold text-slate-100 group-hover:text-indigo-400 transition-colors">
                      {plan.name || plan.reason || 'Sem Nome'}
                    </div>
                    {plan.description && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                        {plan.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                      <span>ID: {plan.id.slice(0, 8)}...</span>
                      {plan.mpPreapprovalPlanId && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-400">MP: {plan.mpPreapprovalPlanId}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-slate-200">
                    {formatCurrency(amount)}
                  </td>
                  <td className="py-4 px-4 text-slate-300">
                    {getFrequencyLabel(plan.billingInterval, plan.auto_recurring)}
                  </td>
                  <td className="py-4 px-4 font-mono text-slate-300 text-xs">
                    {credits.toLocaleString('pt-BR')} créditos
                  </td>
                  <td className="py-4 px-4 text-slate-400">
                    {trialDays ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                        {trialDays} dias grátis
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs font-mono">— Sem Trial</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    {getStatusBadge(plan)}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {plan.init_point && (
                        <a
                          href={plan.init_point}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir Link do Mercado Pago"
                          aria-label="Abrir link do Mercado Pago"
                          className="p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(plan)}
                        title="Editar Plano"
                        aria-label={`Editar plano ${plan.name || plan.reason}`}
                        className="p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-xl transition-colors border border-indigo-500/20 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleStatus(plan)}
                        title={isAct ? 'Desativar Plano' : 'Ativar Plano'}
                        aria-label={isAct ? `Desativar plano ${plan.name || plan.reason}` : `Ativar plano ${plan.name || plan.reason}`}
                        className={`p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl transition-colors border cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                          isAct
                            ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/20'
                            : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border-emerald-500/20'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPlanTable;
