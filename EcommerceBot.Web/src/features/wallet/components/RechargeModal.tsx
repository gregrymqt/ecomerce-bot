/**
 * src/features/wallet/components/RechargeModal.tsx
 *
 * Componente visual de apresentação (UI Pura) do Modal de Recargas.
 * Consome o hook customizado useRechargeModal para gerenciar toda a lógica de negócio,
 * chamadas HTTP, seleções de pacotes e polling de confirmação de pagamento.
 * Em conformidade com acessibilidade WCAG 2.1 AA e touch targets >= 44px.
 */

import React from 'react';
import { Zap, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRechargeModal } from '../hooks/useRechargeModal';
import type { RechargeModalProps } from '../types';
import { Modal } from '@/components/ui/overlay/Modal';
import { Card } from '@/components/ui/display/Card';
import { Button } from '@/components/ui/Button';
import { PixRechargeTab } from './PixRechargeTab';
import { CreditCardRechargeTab } from './CreditCardRechargeTab';

export const RechargeModal: React.FC<RechargeModalProps> = ({
  isOpen,
  onClose,
  onSuccessPayment,
}) => {
  // Consome toda a lógica de estado, requisições HTTP e polling desacoplada
  const {
    selectedPackage,
    setSelectedPackage,
    paymentMethod,
    setPaymentMethod,
    loading,
    error,
    successMessage,
    rechargeData,
    activePackage,
    packages,
    handleCreateRecharge,
  } = useRechargeModal({ isOpen, onClose, onSuccessPayment });

  // Rodapé customizado do Modal usando os componentes genéricos Button
  const modalFooter = (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full text-xs text-[#978e9e]">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          Pagamento de{' '}
          <strong className="text-[#e7e0ed] font-mono">R$ {activePackage.price_brl}</strong> (
          {activePackage.credits} créditos).
        </span>
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onClose}
          disabled={loading}
          className="w-full sm:w-auto border-[#494454] text-[#e7e0ed] min-h-[44px]"
        >
          Cancelar
        </Button>

        {paymentMethod === 'pix' && (
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => handleCreateRecharge('pix')}
            isLoading={loading}
            iconLeft={<Zap className="w-4 h-4 fill-current" />}
            className="w-full sm:w-auto bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white font-semibold min-h-[44px]"
          >
            {rechargeData?.pix_copia_e_cola ? 'Recarregar Novamente' : 'Gerar Cobrança PIX'}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Recarregar Créditos"
      description="Selecione o pacote de créditos e a forma de pagamento"
      size="lg"
      footer={modalFooter}
    >
      <div className="space-y-6 text-[#e7e0ed]">
        {/* Banner de Mensagem de Sucesso */}
        {successMessage && (
          <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm flex items-center gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Banner de Mensagem de Erro */}
        {error && (
          <div className="p-4 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-sm flex items-center gap-2.5 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Seção 1: Seleção de Pacotes usando componentes genéricos Card */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#cabed0] mb-3">
            1. Escolha o Pacote de Créditos
          </label>

          <div
            role="radiogroup"
            aria-label="Pacotes de créditos disponíveis"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {packages.map((pkg) => {
              const isSelected = pkg.id === selectedPackage;

              return (
                <Card
                  key={pkg.id}
                  glass
                  hoverable
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => setSelectedPackage(pkg.id)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setSelectedPackage(pkg.id);
                    }
                  }}
                  className={`relative p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between min-h-[44px] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                    isSelected
                      ? 'border-2 border-[#d0bcff] bg-[#a078ff]/15 shadow-lg shadow-[#6d3bd7]/20'
                      : 'border-[#494454] bg-[#221e2c] hover:border-[#6d3bd7]/50'
                  }`}
                >
                  {pkg.discount_badge && (
                    <span className="absolute -top-2.5 right-3 px-2.5 py-0.5 bg-[#a078ff] text-white text-[10px] font-extrabold uppercase tracking-wide rounded-full shadow-xs">
                      {pkg.discount_badge}
                    </span>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#cabed0] font-mono">
                        {pkg.credits} CRD
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'border-[#d0bcff] bg-[#a078ff] text-white'
                            : 'border-[#494454]'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3 h-3 fill-current" />}
                      </div>
                    </div>

                    <div className="text-2xl font-extrabold text-[#e7e0ed] tracking-tight font-mono">
                      R$ {pkg.price_brl}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#3c3647]/50 text-[11px] text-[#978e9e]">
                    ~{(pkg.price_brl / pkg.credits).toFixed(2)} por crédito
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Seção 2: Abas de Método de Pagamento */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#cabed0] mb-3">
            2. Forma de Pagamento
          </label>

          <div
            role="tablist"
            aria-label="Métodos de Pagamento"
            className="grid grid-cols-2 gap-3 p-1.5 bg-[#201c27] border border-[#3c3647] rounded-xl mb-4"
          >
            <Button
              type="button"
              role="tab"
              aria-selected={paymentMethod === 'pix'}
              variant={paymentMethod === 'pix' ? 'primary' : 'ghost'}
              onClick={() => setPaymentMethod('pix')}
              className={`w-full min-h-[44px] ${
                paymentMethod === 'pix'
                  ? 'bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white'
                  : 'text-[#978e9e] hover:text-[#e7e0ed] hover:bg-[#2c2832]'
              }`}
            >
              PIX (Instantâneo)
            </Button>

            <Button
              type="button"
              role="tab"
              aria-selected={paymentMethod === 'credit_card'}
              variant={paymentMethod === 'credit_card' ? 'primary' : 'ghost'}
              onClick={() => setPaymentMethod('credit_card')}
              className={`w-full min-h-[44px] ${
                paymentMethod === 'credit_card'
                  ? 'bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white'
                  : 'text-[#978e9e] hover:text-[#e7e0ed] hover:bg-[#2c2832]'
              }`}
            >
              Cartão de Crédito
            </Button>
          </div>

          {/* Conteúdo da Aba Selecionada */}
          <div>
            {paymentMethod === 'pix' ? (
              <PixRechargeTab
                loading={loading}
                pixQrCode={rechargeData?.pix_qr_code}
                pixCopiaECola={rechargeData?.pix_copia_e_cola}
                expirationDate={rechargeData?.expiration_date}
                onGeneratePix={() => handleCreateRecharge('pix')}
              />
            ) : (
              <CreditCardRechargeTab
                packageId={activePackage.id}
                amountBrl={activePackage.price_brl}
                loading={loading}
                onSuccessPayment={onSuccessPayment}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default RechargeModal;
