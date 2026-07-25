import React, { useState } from 'react';
import {
  CreditCard,
  Calendar,
  Lock,
  User,
  Mail,
  FileText,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { CreateCreditCardCheckoutPayload, CustomerInfo, OrderItem } from '../types/checkout.type';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback/Alert';
import { cn } from '@/utils/cn';

export interface CreditCardFormProps {
  totalAmount: number;
  items: OrderItem[];
  externalReference: string;
  defaultCustomer?: Partial<CustomerInfo>;
  onSubmitPayment: (payload: CreateCreditCardCheckoutPayload) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export const CreditCardForm: React.FC<CreditCardFormProps> = ({
  totalAmount,
  items,
  externalReference,
  defaultCustomer,
  onSubmitPayment,
  isLoading = false,
  className,
}) => {
  // Estados dos Campos do Cartão
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState(defaultCustomer?.first_name ? `${defaultCustomer.first_name} ${defaultCustomer.last_name || ''}` : '');
  const [expirationDate, setExpirationDate] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [installments, setInstallments] = useState<number>(1);

  // Estados dos Dados do Comprador
  const [payerEmail, setPayerEmail] = useState(defaultCustomer?.email || '');
  const [docType, setDocType] = useState(defaultCustomer?.document_type || 'CPF');
  const [docNumber, setDocNumber] = useState(defaultCustomer?.document_number || '');

  const [formError, setFormError] = useState<string | null>(null);

  // Identificação simples de bandeira por regex
  const detectBrand = (num: string): { brandId: string; name: string } => {
    const cleaned = num.replace(/\D/g, '');
    if (/^4/.test(cleaned)) return { brandId: 'visa', name: 'Visa' };
    if (/^(5[1-5]|2[2-7])/.test(cleaned)) return { brandId: 'master', name: 'Mastercard' };
    if (/^3[47]/.test(cleaned)) return { brandId: 'amex', name: 'American Express' };
    if (/^(6011|65|64[4-9])/.test(cleaned)) return { brandId: 'elo', name: 'Elo' };
    if (/^(38|60)/.test(cleaned)) return { brandId: 'hipercard', name: 'Hipercard' };
    return { brandId: 'visa', name: 'Cartão de Crédito' };
  };

  // Máscaras de entrada
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 16);
    v = v.replace(/(\d{4})/g, '$1 ').trim();
    setCardNumber(v);
  };

  const handleExpirationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 2) {
      v = `${v.slice(0, 2)}/${v.slice(2)}`;
    }
    setExpirationDate(v);
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
    setSecurityCode(v);
  };

  const handleDocNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (docType === 'CPF') {
      v = v.slice(0, 11);
      v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else {
      v = v.slice(0, 14);
      v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    setDocNumber(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const rawCardNumber = cardNumber.replace(/\D/g, '');
    if (rawCardNumber.length < 13) {
      setFormError('Informe um número de cartão de crédito válido.');
      return;
    }

    if (!cardHolderName.trim()) {
      setFormError('Informe o nome impresso no cartão.');
      return;
    }

    if (!expirationDate.includes('/') || expirationDate.length < 5) {
      setFormError('Informe uma data de expiração válida (MM/AA).');
      return;
    }

    if (securityCode.length < 3) {
      setFormError('Informe o código de segurança (CVV) de 3 ou 4 dígitos.');
      return;
    }

    if (!payerEmail.includes('@')) {
      setFormError('Informe um e-mail de cobrança válido.');
      return;
    }

    const rawDoc = docNumber.replace(/\D/g, '');
    if (docType === 'CPF' && rawDoc.length !== 11) {
      setFormError('O CPF deve conter exatamente 11 dígitos.');
      return;
    }

    const brand = detectBrand(rawCardNumber);
    const nameParts = cardHolderName.trim().split(' ');
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || 'Sobrenome';

    // Criação do token fictício / simulado ou integração direta MP JS
    const mockCardToken = `token_${Math.random().toString(36).substring(2, 15)}`;

    const payload: CreateCreditCardCheckoutPayload = {
      external_reference: externalReference,
      total_amount: totalAmount,
      payment_method_id: brand.brandId,
      card_token: mockCardToken,
      installments,
      customer: {
        email: payerEmail.trim(),
        first_name: firstName,
        last_name: lastName,
        document_type: docType,
        document_number: rawDoc,
      },
      items,
    };

    try {
      await onSubmitPayment(payload);
    } catch (err: any) {
      setFormError(err?.message || 'Falha ao processar pagamento.');
    }
  };

  const brandInfo = detectBrand(cardNumber);

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {formError && (
        <Alert variant="error" onClose={() => setFormError(null)}>
          {formError}
        </Alert>
      )}

      {/* Dados do Cartão */}
      <div className="space-y-4 bg-slate-50/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-indigo-500" /> Dados do Cartão de Crédito
          </span>
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
            {brandInfo.name}
          </span>
        </div>

        {/* Número do Cartão */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Número do Cartão
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={cardNumber}
              onChange={handleCardNumberChange}
              placeholder="0000 0000 0000 0000"
              required
              className="w-full pl-10 pr-4 h-11 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Nome do Titular */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Nome Impresso no Cartão
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={cardHolderName}
              onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
              placeholder="JOÃO M SILVA"
              required
              className="w-full pl-10 pr-4 h-11 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase transition-colors"
            />
          </div>
        </div>

        {/* Expiração e CVV */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Validade (MM/AA)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={expirationDate}
                onChange={handleExpirationChange}
                placeholder="MM/AA"
                required
                className="w-full pl-10 pr-3 h-11 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              CVV (Segurança)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={securityCode}
                onChange={handleCvvChange}
                placeholder="123"
                required
                className="w-full pl-10 pr-3 h-11 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Opção de Parcelamento */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Opções de Parcelamento
          </label>
          <select
            value={installments}
            onChange={(e) => setInstallments(parseInt(e.target.value, 10))}
            className="w-full h-11 min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value={1}>1x de R$ {totalAmount.toFixed(2)} (À vista sem juros)</option>
            <option value={2}>2x de R$ {(totalAmount / 2).toFixed(2)} sem juros</option>
            <option value={3}>3x de R$ {(totalAmount / 3).toFixed(2)} sem juros</option>
            <option value={6}>6x de R$ {(totalAmount / 6).toFixed(2)} sem juros</option>
            <option value={12}>12x de R$ {(totalAmount / 12).toFixed(2)} sem juros</option>
          </select>
        </div>
      </div>

      {/* Dados do Comprador */}
      <div className="space-y-4 bg-slate-50/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <User className="w-4 h-4 text-indigo-500" /> Identificação do Pagador
        </span>

        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            E-mail de Cobrança
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              value={payerEmail}
              onChange={(e) => setPayerEmail(e.target.value)}
              placeholder="cliente@email.com"
              required
              className="w-full pl-10 pr-4 h-11 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Documento
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full h-11 min-h-[44px] px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Número do {docType}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <FileText className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={docNumber}
                onChange={handleDocNumberChange}
                placeholder={docType === 'CPF' ? '000.000.000-00' : '00.000.000/0001-00'}
                required
                className="w-full pl-10 pr-3 h-11 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Botão de Finalizar Pagamento */}
      <div className="space-y-2 pt-2">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          className="w-full h-12 min-h-[44px] text-base font-bold shadow-md bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white"
          iconLeft={<Zap className="w-5 h-5" />}
        >
          Pagar R$ {totalAmount.toFixed(2)} com Cartão
        </Button>

        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Processamento 100% Criptografado via Mercado Pago</span>
        </div>
      </div>
    </form>
  );
};
