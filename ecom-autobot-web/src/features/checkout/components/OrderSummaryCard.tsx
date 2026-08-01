/**
 * src/features/checkout/components/OrderSummaryCard.tsx
 *
 * Componente do card de resumo do pedido para o checkout.
 * Exibe plano selecionado, badge de trial grátis, benefícios e detalhamento de valores.
 */

import React from 'react';
import { CheckCircle, Sparkles, ShieldCheck } from 'lucide-react';
import { cn } from '@/utils/cn';

interface OrderSummaryCardProps {
  planName?: string;
  monthlyPrice?: number;
  trialDays?: number;
  className?: string;
}

export const OrderSummaryCard: React.FC<OrderSummaryCardProps> = ({
  planName = 'Plano Pro AI',
  monthlyPrice = 197.0,
  trialDays = 7,
  className,
}) => {
  const benefits = [
    'Scraping e ingestão ilimitada de produtos via JSON-LD/LLM',
    'Enriquecimento automático de títulos, descrições e SEO',
    'Chaves próprias BYOK (DeepSeek, Groq, OpenAI, Gemini)',
    'Sincronização em tempo real com Shopify e Nuvemshop',
    'Exportação ilimitada de catálogos completos para CSV',
    'Suporte prioritário e suporte técnico 24/7',
  ];

  return (
    <div
      className={cn(
        'rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 text-slate-100 flex flex-col justify-between shadow-xl',
        className
      )}
    >
      <div>
        {/* Cabeçalho do Plano */}
        <div className="flex items-center justify-between pb-5 border-b border-[#1E293B]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                Plano Selecionado
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                <Sparkles className="h-3 w-3" />
                {trialDays} Dias Grátis
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-white">{planName}</h2>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Após o trial</span>
            <span className="text-xl font-bold text-white">
              R$ {monthlyPrice.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-xs text-slate-400">/mês</span>
          </div>
        </div>

        {/* Lista de Benefícios */}
        <div className="py-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
            O que está incluso no seu plano:
          </h3>
          <ul className="space-y-3">
            {benefits.map((benefit, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Detalhamento de Cobrança e Total Hoje */}
      <div className="pt-5 border-t border-[#1E293B] space-y-3">
        <div className="flex justify-between text-sm text-slate-400">
          <span>Subtotal Assinatura</span>
          <span>R$ {monthlyPrice.toFixed(2).replace('.', ',')}</span>
        </div>
        <div className="flex justify-between text-sm text-emerald-400">
          <span>Desconto Período de Teste ({trialDays} dias)</span>
          <span>- R$ {monthlyPrice.toFixed(2).replace('.', ',')}</span>
        </div>

        <div className="pt-3 border-t border-[#1E293B]/60 flex items-center justify-between">
          <div>
            <span className="text-base font-semibold text-white block">Total Cobrado Hoje</span>
            <span className="text-xs text-slate-400">Primeira cobrança após {trialDays} dias</span>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-emerald-400">R$ 0,00</span>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-violet-500/10 p-3 border border-violet-500/20 flex items-center gap-3 text-xs text-violet-300">
          <ShieldCheck className="h-5 w-5 text-violet-400 shrink-0" />
          <span>
            Cancele a qualquer momento durante os {trialDays} dias sem nenhuma cobrança no seu cartão ou PIX.
          </span>
        </div>
      </div>
    </div>
  );
};
