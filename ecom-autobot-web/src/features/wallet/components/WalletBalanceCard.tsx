/**
 * src/features/wallet/components/WalletBalanceCard.tsx
 *
 * Componente visual de resumo de saldo com estética Glassmorphism,
 * badge de status de garantia e botão de ação para recargas.
 */

import React from 'react';
import { Zap, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/display/Card';

export interface WalletBalanceCardProps {
  balance: number | null;
  loading: boolean;
  onOpenRechargeModal: () => void;
}

export const WalletBalanceCard: React.FC<WalletBalanceCardProps> = ({
  balance,
  loading,
  onOpenRechargeModal,
}) => {
  const formattedBalance = balance !== null ? balance.toLocaleString('pt-BR') : '0';

  return (
    <Card
      glass
      className="bg-slate-900/70 backdrop-blur-xl border-slate-800 rounded-xl p-6 relative overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-indigo-500/50 before:to-transparent flex flex-col justify-between shadow-xl"
    >
      {/* Header do Card com Título e Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <Zap className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Saldo Disponível
            </h3>
            <p className="text-[11px] text-slate-400">Carteira de Créditos SaaS</p>
          </div>
        </div>

        {/* Badge de Status Emerald */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Garantia de saldo ativo</span>
        </div>
      </div>

      {/* Exibição Numérica do Saldo */}
      <div className="mb-6">
        {loading ? (
          <div className="flex items-center gap-3 py-2">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <span className="text-sm font-medium text-slate-400">Carregando saldo...</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl sm:text-5xl font-bold text-white tracking-tight">
              {formattedBalance}
            </span>
            <span className="text-sm font-semibold uppercase tracking-wider text-indigo-400">
              Créditos
            </span>
          </div>
        )}
      </div>

      {/* Botão de Ação para Recarga */}
      <div>
        <Button
          type="button"
          onClick={onOpenRechargeModal}
          iconLeft={<Zap className="w-4 h-4 fill-current" />}
          className="w-full min-h-[44px] bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/20 border-0 transition-all cursor-pointer"
        >
          Recarregar Créditos
        </Button>
      </div>
    </Card>
  );
};

export default WalletBalanceCard;

