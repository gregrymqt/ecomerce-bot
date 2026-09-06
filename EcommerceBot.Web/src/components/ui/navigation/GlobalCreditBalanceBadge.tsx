/**
 * src/components/ui/navigation/GlobalCreditBalanceBadge.tsx
 *
 * Badge de Saldo de Créditos Global em Tempo Real.
 * Exibe a quota de IA atualizada via SSE e permite recarga instantânea
 * através do UnifiedPaymentModal com conformidade estrita com WCAG 2.1 AA.
 */

import React, { useState } from 'react';
import { Zap, Plus, Loader2 } from 'lucide-react';
import { useRealtimeWalletBalance } from '@/features/wallet/hooks/useRealtimeWalletBalance';
import { UnifiedPaymentModal } from '@/features/wallet/components/UnifiedPaymentModal';
import type { CheckoutTarget } from '@/features/wallet/types';

export interface GlobalCreditBalanceBadgeProps {
  className?: string;
}

const DEFAULT_RECHARGE_TARGET: CheckoutTarget = {
  type: 'recharge',
  id: 'quick-recharge-pro',
  name: 'Pacote Pro AI (2.000 Créditos)',
  amountBrl: 149,
  credits: 2000,
  description: '2.000 créditos para enriquecimento de catálogo e IA.',
};

export const GlobalCreditBalanceBadge: React.FC<GlobalCreditBalanceBadgeProps> = ({
  className = '',
}) => {
  const { balance, isLoading, refresh } = useRealtimeWalletBalance();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formattedBalance = balance !== null ? balance.toLocaleString('pt-BR') : '...';

  const handleOpenModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
  };

  const handleSuccessPayment = () => {
    refresh();
    window.dispatchEvent(new CustomEvent('wallet:balance-updated'));
  };

  return (
    <>
      <div
        role="group"
        aria-label={`Saldo de créditos: ${formattedBalance} créditos`}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs font-semibold shadow-sm hover:border-amber-500/50 hover:bg-amber-500/20 transition-all cursor-pointer select-none min-h-[44px] ${className}`}
        onClick={handleOpenModal}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsModalOpen(true);
          }
        }}
      >
        <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400/40 shrink-0 animate-pulse" />

        <span className="font-mono font-bold tracking-tight">
          {isLoading && balance === null ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              <span>Carregando...</span>
            </span>
          ) : (
            <span>{formattedBalance} créditos</span>
          )}
        </span>

        <button
          type="button"
          onClick={handleOpenModal}
          title="Recarregar créditos de IA"
          aria-label="Recarregar créditos de IA"
          className="ml-1 p-1 rounded-full bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 transition-colors flex items-center justify-center shrink-0 min-w-[24px] min-h-[24px] cursor-pointer"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Modal de Pagamento Unificado para Recarga Rápida */}
      <UnifiedPaymentModal
        isOpen={isModalOpen}
        target={DEFAULT_RECHARGE_TARGET}
        onClose={() => setIsModalOpen(false)}
        onSuccessPayment={handleSuccessPayment}
      />
    </>
  );
};

export default GlobalCreditBalanceBadge;
