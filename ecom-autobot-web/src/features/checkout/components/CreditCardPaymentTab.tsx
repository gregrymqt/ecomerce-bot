/**
 * src/features/checkout/components/CreditCardPaymentTab.tsx
 *
 * Aba de Pagamento Transparente via Cartão de Crédito.
 * Formulário com máscaras dinâmicas de cartão, validade, CVV, seleção de parcelamento e CPF/CNPJ.
 */

import React, { useState } from 'react';
import { CreditCard, Calendar, Lock, User, FileText, ShieldCheck, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { CreditCardPaymentPayload } from '../types/checkout.type';

interface CreditCardPaymentTabProps {
  planId: string;
  loading: boolean;
  onSubmit: (payload: CreditCardPaymentPayload) => Promise<void>;
  className?: string;
}

export const CreditCardPaymentTab: React.FC<CreditCardPaymentTabProps> = ({
  planId,
  loading,
  onSubmit,
  className,
}) => {
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [installments, setInstallments] = useState<number>(1);
  const [docNumber, setDocNumber] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Formatação de Número de Cartão (0000 0000 0000 0000)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.replace(/(\d{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  };

  // Formatação de Validade (MM/AA)
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      setExpiry(`${raw.slice(0, 2)}/${raw.slice(2)}`);
    } else {
      setExpiry(raw);
    }
  };

  // Formatação de CPF/CNPJ
  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 14);
    setDocNumber(raw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCardNumber = cardNumber.replace(/\D/g, '');
    const [month, year] = expiry.split('/');

    if (cleanCardNumber.length < 13) {
      setFormError('Por favor, informe um número de cartão de crédito válido.');
      return;
    }
    if (!cardholderName.trim()) {
      setFormError('Por favor, informe o nome do titular como impresso no cartão.');
      return;
    }
    if (!month || !year || month.length !== 2 || year.length !== 2) {
      setFormError('Por favor, informe a validade no formato MM/AA.');
      return;
    }
    if (securityCode.length < 3) {
      setFormError('Informe o código de segurança (CVV/CVC).');
      return;
    }
    if (docNumber.length < 11) {
      setFormError('Informe um CPF ou CNPJ válido.');
      return;
    }

    const fullYear = `20${year}`;

    await onSubmit({
      plan_id: planId,
      card_number: cleanCardNumber,
      cardholder_name: cardholderName.trim(),
      expiration_month: month,
      expiration_year: fullYear,
      security_code: securityCode,
      installments,
      doc_number: docNumber,
    });
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4 text-slate-100', className)}>
      {formError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
          {formError}
        </div>
      )}

      {/* Número do Cartão */}
      <div className="space-y-1.5">
        <label htmlFor="card-number" className="text-xs font-semibold text-slate-300 block">
          Número do Cartão
        </label>
        <div className="relative">
          <input
            id="card-number"
            type="text"
            value={cardNumber}
            onChange={handleCardNumberChange}
            placeholder="0000 0000 0000 0000"
            required
            maxLength={19}
            className="w-full min-h-[44px] h-11 pl-10 pr-4 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-sm sm:text-base placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
          <CreditCard className="absolute left-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Nome do Titular */}
      <div className="space-y-1.5">
        <label htmlFor="cardholder-name" className="text-xs font-semibold text-slate-300 block">
          Nome Impresso no Cartão
        </label>
        <div className="relative">
          <input
            id="cardholder-name"
            type="text"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
            placeholder="NOME COMO ESTÁ NO CARTÃO"
            required
            className="w-full min-h-[44px] h-11 pl-10 pr-4 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-sm sm:text-base placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors uppercase"
          />
          <User className="absolute left-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Validade e CVV (Grid) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="card-expiry" className="text-xs font-semibold text-slate-300 block">
            Validade (MM/AA)
          </label>
          <div className="relative">
            <input
              id="card-expiry"
              type="text"
              value={expiry}
              onChange={handleExpiryChange}
              placeholder="MM/AA"
              required
              maxLength={5}
              className="w-full min-h-[44px] h-11 pl-10 pr-4 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-sm sm:text-base placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <Calendar className="absolute left-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="card-cvv" className="text-xs font-semibold text-slate-300 block">
            CVV / CVC
          </label>
          <div className="relative">
            <input
              id="card-cvv"
              type="password"
              value={securityCode}
              onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="123"
              required
              maxLength={4}
              className="w-full min-h-[44px] h-11 pl-10 pr-4 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-sm sm:text-base placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Parcelamento e Documento (CPF/CNPJ) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="card-installments" className="text-xs font-semibold text-slate-300 block">
            Parcelamento
          </label>
          <select
            id="card-installments"
            value={installments}
            onChange={(e) => setInstallments(Number(e.target.value))}
            className="w-full min-h-[44px] h-11 px-3 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-sm sm:text-base focus:outline-none focus:border-violet-500 transition-colors"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
              <option key={num} value={num} className="bg-[#090D16] text-slate-100">
                {num}x {num === 1 ? 'de R$ 197,00 à vista' : `de R$ ${(197 / num).toFixed(2).replace('.', ',')}`}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="doc-number" className="text-xs font-semibold text-slate-300 block">
            CPF ou CNPJ do Titular
          </label>
          <div className="relative">
            <input
              id="doc-number"
              type="text"
              value={docNumber}
              onChange={handleDocChange}
              placeholder="000.000.000-00"
              required
              maxLength={14}
              className="w-full min-h-[44px] h-11 pl-10 pr-4 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-sm sm:text-base placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <FileText className="absolute left-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Botão de Envio Gradiente Violeta */}
      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[44px] h-12 mt-4 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Processando Pagamento...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="h-5 w-5" />
            <span>Finalizar Assinatura Segura</span>
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-1">
        <Lock className="h-3.5 w-3.5 text-emerald-400" />
        <span>Criptografia SSL de 256-Bits. Seus dados estão 100% seguros.</span>
      </div>
    </form>
  );
};
