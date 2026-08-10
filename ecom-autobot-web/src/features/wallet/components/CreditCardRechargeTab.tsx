/**
 * src/features/wallet/components/CreditCardRechargeTab.tsx
 *
 * Componente visual de apresentação (UI Pura) da aba de Pagamento via Cartão de Crédito.
 * Consome o hook useCreditCardForm para gerenciar estado do formulário, validações e parcelas.
 */

import React from 'react';
import { CreditCard, User, Calendar, Lock, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/display/Card';
import { Input } from '@/components/ui/form/Input';
import { Select } from '@/components/ui/form/Select';
import { Button } from '@/components/ui/Button';
import { useCreditCardForm, type CreditCardFormData } from '../hooks/useCreditCardForm';

export type { CreditCardFormData };

export interface CreditCardRechargeTabProps {
  onSubmitCard: (cardData: CreditCardFormData) => Promise<void>;
  loading: boolean;
  amountBrl?: number;
}

export const CreditCardRechargeTab: React.FC<CreditCardRechargeTabProps> = ({
  onSubmitCard,
  loading,
  amountBrl = 80,
}) => {
  // Consome a lógica do formulário desacoplada via custom hook
  const { formData, errors, installmentOptions, handleChange, handleSubmit } = useCreditCardForm({
    onSubmitCard,
    amountBrl,
  });

  return (
    <Card
      glass
      className="bg-[#221e2c]/90 border-[#3c3647] rounded-xl p-5 sm:p-6 relative overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-[#a078ff] before:to-[#6d3bd7] text-[#e7e0ed]"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#3c3647] mb-4">
          <CreditCard className="w-5 h-5 text-[#a078ff]" />
          <h3 className="text-sm font-bold text-[#e7e0ed]">
            Pagamento com Cartão de Crédito
          </h3>
        </div>

        {/* Campo: Número do Cartão */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#cabed0] mb-1.5">
            Número do Cartão
          </label>
          <Input
            type="text"
            placeholder="0000 0000 0000 0000"
            value={formData.cardNumber}
            onChange={(e) => handleChange('cardNumber', e.target.value)}
            iconLeft={<CreditCard className="w-4 h-4" />}
            error={Boolean(errors.cardNumber)}
            className="bg-[#17141d] border-[#494454] text-[#e7e0ed] font-mono min-h-[44px]"
          />
          {errors.cardNumber && (
            <span className="text-xs text-rose-400 mt-1 block">{errors.cardNumber}</span>
          )}
        </div>

        {/* Campo: Nome do Titular */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#cabed0] mb-1.5">
            Nome do Titular
          </label>
          <Input
            type="text"
            placeholder="Como impresso no cartão"
            value={formData.cardholderName}
            onChange={(e) => handleChange('cardholderName', e.target.value)}
            iconLeft={<User className="w-4 h-4" />}
            error={Boolean(errors.cardholderName)}
            className="bg-[#17141d] border-[#494454] text-[#e7e0ed] min-h-[44px]"
          />
          {errors.cardholderName && (
            <span className="text-xs text-rose-400 mt-1 block">{errors.cardholderName}</span>
          )}
        </div>

        {/* Linha Dupla: Validade + CVV */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#cabed0] mb-1.5">
              Validade (MM/AA)
            </label>
            <Input
              type="text"
              placeholder="MM/AA"
              value={formData.expirationDate}
              onChange={(e) => handleChange('expirationDate', e.target.value)}
              iconLeft={<Calendar className="w-4 h-4" />}
              error={Boolean(errors.expirationDate)}
              className="bg-[#17141d] border-[#494454] text-[#e7e0ed] font-mono min-h-[44px]"
            />
            {errors.expirationDate && (
              <span className="text-xs text-rose-400 mt-1 block">{errors.expirationDate}</span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#cabed0] mb-1.5">
              Código CVV
            </label>
            <Input
              type="password"
              placeholder="123"
              maxLength={4}
              value={formData.securityCode}
              onChange={(e) => handleChange('securityCode', e.target.value)}
              iconLeft={<Lock className="w-4 h-4" />}
              error={Boolean(errors.securityCode)}
              className="bg-[#17141d] border-[#494454] text-[#e7e0ed] font-mono min-h-[44px]"
            />
            {errors.securityCode && (
              <span className="text-xs text-rose-400 mt-1 block">{errors.securityCode}</span>
            )}
          </div>
        </div>

        {/* Campo: Parcelamento */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#cabed0] mb-1.5">
            Opções de Parcelamento
          </label>
          <Select
            value={formData.installments}
            onChange={(e) => handleChange('installments', Number(e.target.value))}
            options={installmentOptions}
            className="bg-[#17141d] border-[#494454] text-[#e7e0ed] min-h-[44px]"
          />
        </div>

        {/* Botão de Envio */}
        <div className="pt-2">
          <Button
            type="submit"
            isLoading={loading}
            iconLeft={<ShieldCheck className="w-4 h-4" />}
            className="w-full min-h-[44px] bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white font-semibold shadow-md hover:opacity-90 transition-all cursor-pointer"
          >
            Pagar Agora R$ {amountBrl}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default CreditCardRechargeTab;
