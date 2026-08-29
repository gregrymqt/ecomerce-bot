/**
 * src/features/admin/components/growth/GrowthFunnelCard.tsx
 *
 * Card visual do Funil de Conversão do SaaS (Visitantes -> Contas Criadas -> Clientes Pagantes).
 */

import React from 'react';
import type { AcquisitionFunnelData, UnitEconomicsData } from '../../types/growth.types';

interface GrowthFunnelCardProps {
  funnel: AcquisitionFunnelData | null;
  unitEconomics: UnitEconomicsData | null;
}

export const GrowthFunnelCard: React.FC<GrowthFunnelCardProps> = ({ funnel, unitEconomics }) => {
  if (!funnel) return null;

  return (
    <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">Funil de Conversão do SaaS</h2>
          <p className="text-xs text-slate-400">
            Jornada completa do visitante da Landing Page até a primeira fatura paga.
          </p>
        </div>
        <span className="self-start sm:self-auto text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          Conversão Global: {funnel.overall_conversion_rate}%
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
        {/* Etapa 1: Visitantes na LP */}
        <div className="rounded-xl bg-[#090D16] border border-[#1E293B] p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              1. Visitantes Únicos (LP)
            </span>
            <span className="text-3xl font-black text-white">{funnel.total_visitors}</span>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1E293B] text-[11px] text-slate-400 flex items-center justify-between">
            <span>Taxa para Cadastro:</span>
            <span className="font-bold text-indigo-400">{funnel.visitor_to_signup_rate}%</span>
          </div>
        </div>

        {/* Etapa 2: Cadastros Realizados */}
        <div className="rounded-xl bg-[#090D16] border border-[#1E293B] p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              2. Contas Criadas (Tenants)
            </span>
            <span className="text-3xl font-black text-indigo-400">{funnel.total_signups}</span>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1E293B] text-[11px] text-slate-400 flex items-center justify-between">
            <span>Taxa para Pagante:</span>
            <span className="font-bold text-emerald-400">{funnel.signup_to_paid_rate}%</span>
          </div>
        </div>

        {/* Etapa 3: Assinantes Pagantes */}
        <div className="rounded-xl bg-[#090D16] border border-emerald-500/30 p-5 flex flex-col justify-between bg-gradient-to-b from-[#090D16] to-emerald-950/20">
          <div>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
              3. Clientes Pagantes
            </span>
            <span className="text-3xl font-black text-emerald-400">{funnel.total_paying_customers}</span>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-500/20 text-[11px] text-slate-300 flex items-center justify-between">
            <span>LTV / CAC Ratio:</span>
            <span className="font-bold text-white">{unitEconomics?.ltv_cac_ratio || 0}x</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrowthFunnelCard;
