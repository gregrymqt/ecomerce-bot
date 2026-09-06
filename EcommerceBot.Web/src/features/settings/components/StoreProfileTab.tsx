/**
 * src/features/settings/components/StoreProfileTab.tsx
 *
 * Aba de Configurações do Perfil da Loja e Tenant.
 * Em conformidade com acessibilidade WCAG 2.1 AA, inputs >= 16px e touch targets >= 44px.
 * Com fallback defensivo contra valores undefined vindos da API.
 */

import React from 'react';
import { Store, Mail, Clock, DollarSign, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormField } from '@/components/ui/form/fields/FormField';
import { Select } from '@/components/ui/form/Select';
import type { StoreProfilePayload } from '../types';

export interface StoreProfileTabProps {
  data?: StoreProfilePayload;
  onChange: <K extends keyof StoreProfilePayload>(field: K, value: StoreProfilePayload[K]) => void;
  className?: string;
}

const DEFAULT_STORE_PROFILE: StoreProfilePayload = {
  store_name: 'Minha Loja E-Commerce',
  tenant_id: 'tenant-default',
  admin_email: 'admin@loja.com.br',
  timezone: 'America/Sao_Paulo',
  base_currency: 'BRL',
};

export const StoreProfileTab: React.FC<StoreProfileTabProps> = ({
  data,
  onChange,
  className,
}) => {
  const currentData: StoreProfilePayload = {
    ...DEFAULT_STORE_PROFILE,
    ...(data || {}),
  };

  return (
    <div className={cn('space-y-8 text-slate-100', className)}>
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-[#1E293B] pb-4">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Perfil da Loja & Tenant</h3>
            <p className="text-xs text-slate-400">Identificação e preferências regionais da sua organização</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Nome da Loja */}
          <FormField
            id="store-name-input"
            label="Nome da Loja"
            value={currentData.store_name}
            onChange={(e) => onChange('store_name', e.target.value)}
            placeholder="Ex: Minha Loja E-Commerce"
            iconLeft={<Store className="h-4 w-4 text-slate-500" />}
            className="bg-[#090D16] border-[#1E293B] text-slate-100"
          />

          {/* Tenant ID (Readonly) */}
          <FormField
            id="tenant-id-input"
            label="Tenant ID (Identificador do Sistema)"
            value={currentData.tenant_id}
            readOnly
            disabled
            iconLeft={<Shield className="h-4 w-4 text-slate-500" />}
            className="bg-[#090D16]/50 border-[#1E293B] text-slate-400 font-mono cursor-not-allowed"
          />

          {/* E-mail Admin */}
          <FormField
            id="admin-email-input"
            label="E-mail do Administrador"
            type="email"
            value={currentData.admin_email}
            onChange={(e) => onChange('admin_email', e.target.value)}
            placeholder="admin@loja.com.br"
            iconLeft={<Mail className="h-4 w-4 text-slate-500" />}
            className="bg-[#090D16] border-[#1E293B] text-slate-100"
          />

          {/* Fuso Horário */}
          <FormField id="timezone-select" label="Fuso Horário (Timezone)">
            <Select
              id="timezone-select"
              value={currentData.timezone}
              onChange={(e) => onChange('timezone', e.target.value)}
              iconLeft={<Clock className="h-4 w-4 text-slate-500" />}
              className="bg-[#090D16] border-[#1E293B] text-slate-100"
              options={[
                { value: 'America/Sao_Paulo', label: 'América / São Paulo (GMT-3)' },
                { value: 'America/Manaus', label: 'América / Manaus (GMT-4)' },
                { value: 'America/New_York', label: 'América / New York (EST)' },
                { value: 'Europe/Lisbon', label: 'Europa / Lisboa (WET)' },
              ]}
            />
          </FormField>

          {/* Moeda Base */}
          <FormField id="base-currency-select" label="Moeda Base da Loja" containerClassName="sm:col-span-2 max-w-md">
            <Select
              id="base-currency-select"
              value={currentData.base_currency}
              onChange={(e) => onChange('base_currency', e.target.value)}
              iconLeft={<DollarSign className="h-4 w-4 text-slate-500" />}
              className="bg-[#090D16] border-[#1E293B] text-slate-100"
              options={[
                { value: 'BRL', label: 'Real Brasileiro (R$ - BRL)' },
                { value: 'USD', label: 'Dólar Americano ($ - USD)' },
                { value: 'EUR', label: 'Euro (€ - EUR)' },
              ]}
            />
          </FormField>
        </div>
      </div>
    </div>
  );
};

export default StoreProfileTab;
