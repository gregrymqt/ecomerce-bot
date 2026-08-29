/**
 * src/features/admin/components/leads/LeadsMetricsCards.tsx
 *
 * 5 Cards de métricas dos estágios do pipeline de vendas corporativas (SSO Enterprise).
 */

import React from 'react';
import { Users, Clock, MessageSquare, Sparkles, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/display/Card';
import type { EnterpriseLeadsSummaryMetrics } from '../../types/leads.types';

interface LeadsMetricsCardsProps {
  metrics: EnterpriseLeadsSummaryMetrics | null;
}

export const LeadsMetricsCards: React.FC<LeadsMetricsCardsProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {/* Total de Leads */}
      <Card glass className="p-4 bg-slate-900/60 border-slate-800/80">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
          <span>Total de Leads</span>
          <Users className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="text-2xl sm:text-3xl font-black text-slate-100">
          {metrics?.totalLeads ?? 0}
        </div>
        <span className="text-xs text-slate-400">Oportunidades criadas</span>
      </Card>

      {/* Novos / Pendentes */}
      <Card glass className="p-4 bg-slate-900/60 border-indigo-900/40">
        <div className="flex items-center justify-between text-indigo-400 text-xs font-medium uppercase tracking-wider mb-2">
          <span>Novos (Pendentes)</span>
          <Clock className="w-4 h-4" />
        </div>
        <div className="text-2xl sm:text-3xl font-black text-indigo-300">
          {metrics?.pendingCount ?? 0}
        </div>
        <span className="text-xs text-indigo-400/80">Aguardando 1º contato</span>
      </Card>

      {/* Em Contato */}
      <Card glass className="p-4 bg-slate-900/60 border-sky-900/40">
        <div className="flex items-center justify-between text-sky-400 text-xs font-medium uppercase tracking-wider mb-2">
          <span>Em Contato</span>
          <MessageSquare className="w-4 h-4" />
        </div>
        <div className="text-2xl sm:text-3xl font-black text-sky-300">
          {metrics?.contactedCount ?? 0}
        </div>
        <span className="text-xs text-sky-400/80">Conversa iniciada</span>
      </Card>

      {/* Em Negociação */}
      <Card glass className="p-4 bg-slate-900/60 border-amber-900/40">
        <div className="flex items-center justify-between text-amber-400 text-xs font-medium uppercase tracking-wider mb-2">
          <span>Em Negociação</span>
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="text-2xl sm:text-3xl font-black text-amber-300">
          {metrics?.qualifiedCount ?? 0}
        </div>
        <span className="text-xs text-amber-400/80">Alinhando proposta</span>
      </Card>

      {/* Convertidos / Ativos */}
      <Card glass className="p-4 bg-slate-900/60 border-emerald-900/40 col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between text-emerald-400 text-xs font-medium uppercase tracking-wider mb-2">
          <span>Convertidos</span>
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div className="text-2xl sm:text-3xl font-black text-emerald-300">
          {metrics?.convertedCount ?? 0}
        </div>
        <span className="text-xs text-emerald-400/80">Contas Enterprise ativas</span>
      </Card>
    </div>
  );
};

export default LeadsMetricsCards;
