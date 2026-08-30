/**
 * src/features/settings/components/BillingProfileTab.tsx
 *
 * Aba de Configurações de Faturamento e Dados Fiscais.
 * Em conformidade com acessibilidade WCAG 2.1 AA, inputs >= 16px e touch targets >= 44px.
 */

import React from 'react';
import { Receipt, Building, FileText, Mail, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BillingProfilePayload } from '../types';

export interface BillingProfileTabProps {
  data: BillingProfilePayload;
  onChange: <K extends keyof BillingProfilePayload>(field: K, value: BillingProfilePayload[K]) => void;
  className?: string;
}

export const BillingProfileTab: React.FC<BillingProfileTabProps> = ({
  data,
  onChange,
  className,
}) => {
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
          <div className="space-y-2">
            <label htmlFor="company-name-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Razão Social / Nome Completo
            </label>
            <div className="relative">
              <input
                id="company-name-input"
                type="text"
                value={data.company_name}
                onChange={(e) => onChange('company_name', e.target.value)}
                placeholder="Ex: Minha Empresa E-Commerce Ltda"
                className="w-full min-h-[44px] h-11 px-4 pl-10 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base focus:border-violet-500 focus:outline-none transition-all"
              />
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            </div>
          </div>

          {/* CNPJ / CPF */}
          <div className="space-y-2">
            <label htmlFor="tax-id-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              CNPJ / CPF (Documento Fiscal)
            </label>
            <div className="relative">
              <input
                id="tax-id-input"
                type="text"
                value={data.tax_id}
                onChange={(e) => onChange('tax_id', e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full min-h-[44px] h-11 px-4 pl-10 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base font-mono focus:border-violet-500 focus:outline-none transition-all"
              />
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            </div>
          </div>

          {/* E-mail de Faturamento */}
          <div className="space-y-2">
            <label htmlFor="billing-email-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              E-mail de Faturamento (Recibos / NFs)
            </label>
            <div className="relative">
              <input
                id="billing-email-input"
                type="email"
                value={data.billing_email}
                onChange={(e) => onChange('billing_email', e.target.value)}
                placeholder="financeiro@loja.com.br"
                className="w-full min-h-[44px] h-11 px-4 pl-10 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base focus:border-violet-500 focus:outline-none transition-all"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            </div>
          </div>

          {/* Endereço Comercial */}
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="commercial-address-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Endereço Comercial Completo
            </label>
            <div className="relative">
              <input
                id="commercial-address-input"
                type="text"
                value={data.commercial_address}
                onChange={(e) => onChange('commercial_address', e.target.value)}
                placeholder="Av. Paulista, 1000 - São Paulo, SP - CEP 01310-100"
                className="w-full min-h-[44px] h-11 px-4 pl-10 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base focus:border-violet-500 focus:outline-none transition-all"
              />
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingProfileTab;
