/**
 * src/features/dashboard/components/TokenTelemetryCard.tsx
 *
 * Widget de Telemetria de Consumo de Tokens por Provedor de IA (BYOK).
 * Exibe a latência média da pipeline e selo de economia de custos com chaves próprias.
 */

import React from 'react';
import { Brain, ShieldCheck, Activity, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TokenProviderUsage } from '../types';

export interface TokenTelemetryCardProps {
  providers?: TokenProviderUsage[];
  averageLatencyMs?: number;
  className?: string;
}

const DEFAULT_PROVIDERS: TokenProviderUsage[] = [
  {
    provider_name: 'DeepSeek V3 (BYOK)',
    used_tokens_display: '420.5K',
    max_tokens_display: '500.0K',
    percentage: 84,
    is_byok: true,
  },
  {
    provider_name: 'Groq Llama 3 (BYOK)',
    used_tokens_display: '280.1K',
    max_tokens_display: '400.0K',
    percentage: 70,
    is_byok: true,
  },
  {
    provider_name: 'OpenAI GPT-4o (Global)',
    used_tokens_display: '95.4K',
    max_tokens_display: '150.0K',
    percentage: 63,
    is_byok: false,
  },
];

export const TokenTelemetryCard: React.FC<TokenTelemetryCardProps> = ({
  providers = DEFAULT_PROVIDERS,
  averageLatencyMs = 120,
  className,
}) => {
  const items = providers && providers.length > 0 ? providers : DEFAULT_PROVIDERS;

  return (
    <div
      className={cn(
        'rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 text-slate-100 shadow-xl space-y-5 flex flex-col justify-between',
        className
      )}
    >
      <div>
        {/* Cabeçalho do Card */}
        <div className="flex items-start justify-between pb-4 border-b border-[#1E293B]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Telemetria de Tokens & IA</h3>
              <p className="text-xs text-slate-400">Consumo em tempo real por LLM Provider</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono font-bold text-emerald-400 block flex items-center gap-1 justify-end">
              <Activity className="h-3.5 w-3.5" />
              {averageLatencyMs} ms
            </span>
            <span className="text-[10px] text-slate-400">Latência média</span>
          </div>
        </div>

        {/* Lista de Provedores com Barra de Consumo */}
        <div className="py-4 space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  {item.is_byok && <Key className="h-3.5 w-3.5 text-violet-400" />}
                  {item.provider_name}
                </span>
                <span className="font-mono text-xs text-slate-400">
                  {item.used_tokens_display} / {item.max_tokens_display}
                </span>
              </div>
              <div className="w-full bg-[#090D16] rounded-full h-2 border border-[#1E293B] overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-600 to-violet-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, item.percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selo BYOK Econômico */}
      <div className="pt-3 border-t border-[#1E293B]">
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center gap-2 text-xs text-emerald-300">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">
            BYOK Ativo — Reduzindo custos operacionais em até 80%
          </span>
        </div>
      </div>
    </div>
  );
};

export default TokenTelemetryCard;
