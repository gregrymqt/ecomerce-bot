/**
 * src/features/plans/components/AdminPlanTable.tsx
 * Tabela responsiva de alta performance para exibição de planos de assinatura administrativos (Synthetica Dark).
 */

import React from 'react';
import { Edit2, ExternalLink, Power, RefreshCw, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import type { PlanResponse } from '../types/plans.type';

interface AdminPlanTableProps {
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
  const formatCurrency = (amount?: number, currency = 'BRL') => {
    if (amount === undefined || amount === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const isAct = status?.toLowerCase() === 'active';
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider font-mono ${
          isAct
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
        }`}
      >
        {isAct ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
        {isAct ? 'Ativo' : 'Cancelado'}
      </span>
    );
  };

  const getFrequencyLabel = (auto: any) => {
    if (!auto) return 'N/A';
    const freq = auto.frequency || 1;
    const type = auto.frequency_type === 'months' ? 'Mês(es)' : 'Dia(s)';
    return `A cada ${freq} ${type}`;
  };

  if (loading && plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-[#15121B]/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
        <p className="text-slate-400 font-medium font-mono text-sm">Carregando catálogo de planos no Mercado Pago...</p>
      </div>
    );
  }

  if (!loading && plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-[#15121B]/90 border border-slate-800 rounded-2xl text-center shadow-xl backdrop-blur-md">
        <ShieldAlert className="w-12 h-12 text-slate-500 mb-3" />
        <h3 className="text-lg font-semibold text-slate-200">Nenhum plano encontrado</h3>
        <p className="text-slate-400 max-w-md mt-1 text-sm">
          Não foram encontrados planos com os filtros selecionados. Crie um novo plano ou altere os termos de busca.
        </p>
        <button
          onClick={onRefresh}
          className="mt-4 min-h-[44px] min-w-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-slate-700/50"
        >
          <RefreshCw className="w-4 h-4" /> Recarregar
        </button>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden bg-[#15121B]/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-[#100D14]/80 text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              <th className="py-4 px-6 font-mono uppercase">Plano & Descrição</th>
              <th className="py-4 px-4 font-mono uppercase">Valor Recorrente</th>
              <th className="py-4 px-4 font-mono uppercase">Frequência</th>
              <th className="py-4 px-4 font-mono uppercase">Trial / Teste</th>
              <th className="py-4 px-4 text-center font-mono uppercase">Status</th>
              <th className="py-4 px-6 text-right font-mono uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {plans.map((plan) => {
              const amount = plan.auto_recurring?.transaction_amount;
              const currency = plan.auto_recurring?.currency_id || 'BRL';
              const trialDays = plan.auto_recurring?.free_trial?.frequency;

              return (
                <tr
                  key={plan.id}
                  className="hover:bg-slate-800/40 transition-colors group"
                >
                  <td className="py-4 px-6">
                    <div className="font-semibold text-slate-100 group-hover:text-indigo-400 transition-colors">
                      {plan.reason || 'Sem Nome'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                      <span>ID MP: {plan.id}</span>
                      {plan.external_id && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-400">Ext: {plan.external_id}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-slate-200">
                    {formatCurrency(amount, currency)}
                  </td>
                  <td className="py-4 px-4 text-slate-300">
                    {getFrequencyLabel(plan.auto_recurring)}
                  </td>
                  <td className="py-4 px-4 text-slate-400">
                    {trialDays ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                        {trialDays} {plan.auto_recurring?.free_trial?.frequency_type || 'dias'} grátis
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs font-mono">— Sem Trial</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    {getStatusBadge(plan.status)}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {plan.init_point && (
                        <a
                          href={plan.init_point}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir Link do Mercado Pago"
                          className="p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => onEdit(plan)}
                        title="Editar Plano"
                        className="p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-xl transition-colors border border-indigo-500/20"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onToggleStatus(plan)}
                        title={plan.status === 'active' ? 'Desativar Plano' : 'Ativar Plano'}
                        className={`p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl transition-colors border ${
                          plan.status === 'active'
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

