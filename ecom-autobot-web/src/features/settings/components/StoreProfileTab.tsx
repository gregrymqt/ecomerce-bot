/**
 * src/features/settings/components/StoreProfileTab.tsx
 *
 * Aba de Configurações do Perfil da Loja e Tenant.
 */

import React from 'react';
import { Store, Mail, Clock, DollarSign, Shield } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { StoreProfilePayload } from '../types/settings.type';

interface StoreProfileTabProps {
  data: StoreProfilePayload;
  onChange: <K extends keyof StoreProfilePayload>(field: K, value: StoreProfilePayload[K]) => void;
  className?: string;
}

export const StoreProfileTab: React.FC<StoreProfileTabProps> = ({
  data,
  onChange,
  className,
}) => {
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
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Nome da Loja
            </label>
            <div className="relative">
              <input
                type="text"
                value={data.store_name}
                onChange={(e) => onChange('store_name', e.target.value)}
                placeholder="Ex: Minha Loja E-Commerce"
                className="w-full min-h-[44px] h-11 px-4 pl-10 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base focus:border-violet-500 focus:outline-none transition-all"
              />
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            </div>
          </div>

          {/* Tenant ID (Readonly) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tenant ID (Identificador do Sistema)
            </label>
            <div className="relative">
              <input
                type="text"
                value={data.tenant_id}
                readOnly
                className="w-full min-h-[44px] h-11 px-4 pl-10 rounded-xl bg-[#090D16]/50 border border-[#1E293B] text-slate-400 font-mono text-base cursor-not-allowed"
              />
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            </div>
          </div>

          {/* E-mail Admin */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              E-mail do Administrador
            </label>
            <div className="relative">
              <input
                type="email"
                value={data.admin_email}
                onChange={(e) => onChange('admin_email', e.target.value)}
                placeholder="admin@loja.com.br"
                className="w-full min-h-[44px] h-11 px-4 pl-10 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base focus:border-violet-500 focus:outline-none transition-all"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            </div>
          </div>

          {/* Fuso Horário */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Fuso Horário (Timezone)
            </label>
            <div className="relative">
              <select
                value={data.timezone}
                onChange={(e) => onChange('timezone', e.target.value)}
                className="w-full min-h-[44px] h-11 px-4 pl-10 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base focus:border-violet-500 focus:outline-none transition-all cursor-pointer"
              >
                <option value="America/Sao_Paulo">América / São Paulo (GMT-3)</option>
                <option value="America/Manaus">América / Manaus (GMT-4)</option>
                <option value="America/New_York">América / New York (EST)</option>
                <option value="Europe/Lisbon">Europa / Lisboa (WET)</option>
              </select>
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            </div>
          </div>

          {/* Moeda Base */}
          <div className="space-y-2 sm:col-span-2 max-w-md">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Moeda Base da Loja
            </label>
            <div className="relative">
              <select
                value={data.base_currency}
                onChange={(e) => onChange('base_currency', e.target.value)}
                className="w-full min-h-[44px] h-11 px-4 pl-10 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base focus:border-violet-500 focus:outline-none transition-all cursor-pointer"
              >
                <option value="BRL">Real Brasileiro (R$ - BRL)</option>
                <option value="USD">Dólar Americano ($ - USD)</option>
                <option value="EUR">Euro (€ - EUR)</option>
              </select>
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
