/**
 * src/features/checkout/components/OrderSummaryCard.tsx
 *
 * Componente do card de resumo do pedido para o checkout.
 * Suporta dinamicamente Assinaturas de Planos SaaS e Recargas de Saldo de Carteira.
 */

import React from 'react';
import { CheckCircle, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface OrderSummaryCardProps {
  isTopup?: boolean;
  planName?: string;
  monthlyPrice?: number;
  trialDays?: number;
  className?: string;
}

export const OrderSummaryCard: React.FC<OrderSummaryCardProps> = ({
  isTopup = false,
  planName = 'Plano Pro AI',
  monthlyPrice = 197.0,
  trialDays = 7,
  className,
}) => {
  const planBenefits = [
    'Scraping e ingestão ilimitada de produtos via JSON-LD/LLM',
    'Enriquecimento automático de títulos, descrições e SEO',
    'Chaves próprias BYOK (DeepSeek, Groq, OpenAI, Gemini)',
    'Sincronização em tempo real com Shopify e Nuvemshop',
    'Exportação ilimitada de catálogos completos para CSV',
    'Suporte prioritário e suporte técnico 24/7',
  ];

  const topupBenefits = [
    `Saldo liberado instantaneamente na sua Carteira (R$ ${monthlyPrice.toFixed(2).replace('.', ',')})`,
    'Sem validade de expiração (créditos perpétuos)',
    'Consumo transparente por token de inferência (DeepSeek/Groq/OpenAI)',
    'Acesso a todos os modelos de IA gerenciados da plataforma',
    'Extrato detalhado de execuções e tokens em tempo real',
  ];

  const benefits = isTopup ? topupBenefits : planBenefits;

  return (
    <div
      className={cn(
        'rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 text-slate-100 flex flex-col justify-between shadow-xl',
        className
      )}
    >
      <div>
        {/* Cabeçalho do Card */}
        <div className="flex items-center justify-between pb-5 border-b border-[#1E293B]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                {isTopup ? 'Recarga de Saldo' : 'Plano Selecionado'}
              </span>
              {isTopup ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
                  <Zap className="h-3 w-3" />
                  Saldo Imediato
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="h-3 w-3" />
                  {trialDays} Dias Grátis
                </span>
              )}
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-white">{planName}</h2>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">{isTopup ? 'Valor do Crédito' : 'Mensalidade'}</span>
            <span className="text-xl font-bold text-white">
              R$ {monthlyPrice.toFixed(2).replace('.', ',')}
            </span>
            {!isTopup && <span className="text-xs text-slate-400">/mês</span>}
          </div>
        </div>

        {/* Lista de Benefícios */}
        <div className="py-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
            {isTopup ? 'Vantagens do pacote de créditos:' : 'O que está incluso no seu plano:'}
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
        {isTopup ? (
          <>
            <div className="flex justify-between text-sm text-slate-400">
              <span>Subtotal Recarga</span>
              <span>R$ {monthlyPrice.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="pt-3 border-t border-[#1E293B]/60 flex items-center justify-between">
              <div>
                <span className="text-base font-semibold text-white block">Total a Pagar</span>
                <span className="text-xs text-slate-400">Liberação imediata via Mercado Pago</span>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-emerald-400">
                  R$ {monthlyPrice.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}

        <div className="mt-4 rounded-xl bg-violet-500/10 p-3 border border-violet-500/20 flex items-center gap-3 text-xs text-violet-300">
          <ShieldCheck className="h-5 w-5 text-violet-400 shrink-0" />
          <span>
            {isTopup
              ? 'Seus créditos ficam disponíveis na carteira imediatamente após a confirmação.'
              : `Cancele a qualquer momento durante os ${trialDays} dias sem nenhuma cobrança no seu cartão ou PIX.`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default OrderSummaryCard;
