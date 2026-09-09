/**
 * src/features/wallet/components/payment/BillingProfileSummary.tsx
 *
 * Exibição compacta dos dados de faturamento salvos do Tenant (CPF/CNPJ e Endereço).
 * Permite que o usuário visualize rapidamente os dados fiscais e clique em "Alterar".
 * Acessível WCAG 2.1 AA com touch target >= 44px.
 */

import React from 'react';
import { Building2, Edit3, CheckCircle2 } from 'lucide-react';
import type { TenantBillingProfile } from '../../types/billing.type';

export interface BillingProfileSummaryProps {
  profile: TenantBillingProfile;
  onEdit: () => void;
  className?: string;
}

export const BillingProfileSummary: React.FC<BillingProfileSummaryProps> = ({
  profile,
  onEdit,
  className = '',
}) => {
  return (
    <div
      className={`bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors hover:border-slate-700/80 ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 text-indigo-400 mt-0.5 sm:mt-0">
          <Building2 className="w-4 h-4" />
        </div>

        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate max-w-[220px] sm:max-w-xs">
              {profile.legal_name}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              {profile.document_type} {profile.document_number_masked}
            </span>
          </div>

          <p className="text-xs text-slate-400 truncate max-w-sm">
            {profile.street_name}, {profile.street_number} • {profile.neighborhood}, {profile.city} - {profile.federal_unit} • CEP {profile.zip_code}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/30 rounded-lg transition-colors min-h-[44px] shrink-0 self-end sm:self-center"
        aria-label="Alterar dados fiscais e de endereço de faturamento"
      >
        <Edit3 className="w-3.5 h-3.5" />
        <span>Alterar</span>
      </button>
    </div>
  );
};

export default BillingProfileSummary;
