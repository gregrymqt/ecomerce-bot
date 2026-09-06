/**
 * src/features/settings/components/BillingProfileTab.tsx
 *
 * Aba de Configurações de Faturamento e Dados Fiscais.
 * Em conformidade com acessibilidade WCAG 2.1 AA, inputs >= 16px e touch targets >= 44px.
 * Com fallback defensivo contra valores undefined vindos da API.
 */

import React from 'react';
import { Receipt, Building, FileText, Mail, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormField } from '@/components/ui/form/fields/FormField';
import type { BillingProfilePayload } from '../types';

export interface BillingProfileTabProps {
  data?: BillingProfilePayload;
  onChange: <K extends keyof BillingProfilePayload>(field: K, value: BillingProfilePayload[K]) => void;
  className?: string;
}

const DEFAULT_BILLING_PROFILE: BillingProfilePayload = {
  company_name: 'E-Commerce Bot Tech Ltda',
  tax_id: '12.345.678/0001-99',
  billing_email: 'financeiro@loja.com.br',
  commercial_address: 'Av. Paulista, 1000 - São Paulo, SP',
};

export const BillingProfileTab: React.FC<BillingProfileTabProps> = ({
  data,
  onChange,
  className,
}) => {
  const currentData: BillingProfilePayload = {
    ...DEFAULT_BILLING_PROFILE,
    ...(data || {}),
  };

  return (
    <div className={cn('space-y-8 text-slate-100', className)}>
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-[#1E293B] pb-4">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Dados Fiscais & Cobrança</h3>
            <p className="text-xs text-slate-400">Informações jurídicas para emissão de Notas Fiscais e faturas</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Razão Social / Nome Completo */}
          <FormField
            id="company-name-input"
            label="Razão Social / Nome Completo"
            value={currentData.company_name}
            onChange={(e) => onChange('company_name', e.target.value)}
            placeholder="Ex: Minha Empresa E-Commerce Ltda"
            iconLeft={<Building className="h-4 w-4 text-slate-500" />}
            className="bg-[#090D16] border-[#1E293B] text-slate-100"
          />

          {/* CNPJ / CPF */}
          <FormField
            id="tax-id-input"
            label="CNPJ / CPF (Documento Fiscal)"
            value={currentData.tax_id}
            onChange={(e) => onChange('tax_id', e.target.value)}
            placeholder="00.000.000/0001-00"
            iconLeft={<FileText className="h-4 w-4 text-slate-500" />}
            className="bg-[#090D16] border-[#1E293B] text-slate-100 font-mono"
          />

          {/* E-mail de Faturamento */}
          <FormField
            id="billing-email-input"
            label="E-mail de Faturamento (Recibos / NFs)"
            type="email"
            value={currentData.billing_email}
            onChange={(e) => onChange('billing_email', e.target.value)}
            placeholder="financeiro@loja.com.br"
            iconLeft={<Mail className="h-4 w-4 text-slate-500" />}
            className="bg-[#090D16] border-[#1E293B] text-slate-100"
          />

          {/* Endereço Comercial */}
          <FormField
            id="commercial-address-input"
            label="Endereço Comercial Completo"
            value={currentData.commercial_address}
            onChange={(e) => onChange('commercial_address', e.target.value)}
            placeholder="Av. Paulista, 1000 - São Paulo, SP - CEP 01310-100"
            iconLeft={<MapPin className="h-4 w-4 text-slate-500" />}
            containerClassName="sm:col-span-2"
            className="bg-[#090D16] border-[#1E293B] text-slate-100"
          />
        </div>
      </div>
    </div>
  );
};

export default BillingProfileTab;
