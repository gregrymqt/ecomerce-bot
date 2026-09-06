/**
 * src/features/wallet/components/CreditPackagesGrid.tsx
 *
 * Vitrine de Pacotes de Recarga de Créditos da Carteira (Ledger Pattern).
 * Elimina completamente a semântica de assinaturas mensais/anuais, exibindo
 * pacotes avulsos perpétuos com checkout transparente via Mercado Pago.
 * Em conformidade estrita com WCAG 2.1 AA e touch targets >= 44px.
 */

import React from 'react';
import { Zap, Check, Sparkles, Shield, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/display/Card';
import { Button } from '@/components/ui/Button';
import type { CreditPackagesGridProps, RechargePackage } from '../types';

export const CreditPackagesGrid: React.FC<CreditPackagesGridProps> = ({
  packages = [],
  loading = false,
  onSelectPackage,
  className = '',
}) => {
  if (loading) {
    return (
      <div
        role="region"
        aria-label="Carregando pacotes de recarga"
        className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}
      >
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="h-96 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse p-6 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="h-6 w-1/3 bg-slate-800 rounded" />
              <div className="h-10 w-2/3 bg-slate-800 rounded" />
              <div className="space-y-2 pt-4">
                <div className="h-4 w-full bg-slate-800 rounded" />
                <div className="h-4 w-5/6 bg-slate-800 rounded" />
                <div className="h-4 w-4/6 bg-slate-800 rounded" />
              </div>
            </div>
            <div className="h-12 w-full bg-slate-800 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <section
      role="region"
      aria-label="Pacotes de Recarga de Créditos de IA"
      className={`space-y-6 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span>Pacotes de Recarga Avulsa</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Créditos perpétuos sob demanda: sem mensalidade, sem renovação automática e sem expiração.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold self-start sm:self-auto">
          <Shield className="w-3.5 h-3.5" />
          <span>Créditos Perpétuos</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {packages.map((pkg: RechargePackage) => {
          const isPopular = Boolean(pkg.is_popular);
          const unitPrice = (pkg.price_brl / Math.max(1, pkg.credits)).toFixed(2);

          return (
            <Card
              key={pkg.id}
              glass
              className={`relative rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 ${
                isPopular
                  ? 'bg-slate-900/90 border-2 border-indigo-500 shadow-xl shadow-indigo-500/10'
                  : 'bg-slate-900/60 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Badge Superior */}
              {pkg.discount_badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide uppercase shadow-md ${
                      isPopular
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-indigo-500/30'
                        : 'bg-emerald-600 text-white shadow-emerald-500/20'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    {pkg.discount_badge}
                  </span>
                </div>
              )}

              {/* Informações do Pacote */}
              <div className="space-y-5">
                <div className="pt-2">
                  <h3 className="text-lg font-bold text-white flex items-center justify-between">
                    <span>{pkg.name}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {pkg.credits.toLocaleString('pt-BR')} CRD
                    </span>
                  </h3>
                  {pkg.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{pkg.description}</p>
                  )}
                </div>

                {/* Preço em Destaque */}
                <div className="py-2 border-y border-slate-800/80">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold text-slate-400">R$</span>
                    <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-mono">
                      {pkg.price_brl.toLocaleString('pt-BR')}
                    </span>
                    <span className="text-xs font-medium text-slate-400 ml-1">à vista</span>
                  </div>
                  <div className="text-[11px] text-indigo-300/80 font-mono mt-1">
                    R$ {unitPrice} por produto enriquecido
                  </div>
                </div>

                {/* Lista de Benefícios */}
                <ul className="space-y-2.5 text-xs text-slate-300">
                  {(pkg.features || [
                    `${pkg.credits.toLocaleString('pt-BR')} créditos perpétuos`,
                    '1 produto enriquecido = 1 crédito',
                    'Exportação para Shopify e Nuvemshop',
                    'Ativação imediata via PIX e Cartão',
                  ]).map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="p-0.5 rounded-full bg-emerald-500/10 text-emerald-400 mt-0.5 shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Botão de Checkout Transparente */}
              <div className="pt-6 mt-6 border-t border-slate-800/60">
                <Button
                  type="button"
                  variant={isPopular ? 'primary' : 'outline'}
                  size="md"
                  onClick={() => onSelectPackage(pkg)}
                  iconRight={<ArrowRight className="w-4 h-4" />}
                  iconLeft={<Zap className="w-4 h-4 fill-current" />}
                  className={`w-full min-h-[44px] text-sm font-bold shadow-md cursor-pointer transition-all ${
                    isPopular
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                      : 'border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Comprar Pacote
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
};

export default CreditPackagesGrid;
