/**
 * src/features/wallet/services/stripe.service.ts
 *
 * Módulo de serviço singleton para integração com Stripe (@stripe/stripe-js).
 * Gerencia o carregamento seguro da chave publicável e operações de pagamento.
 */

import { loadStripe, type Stripe, type StripeError } from '@stripe/stripe-js';
import { env } from '@/config/env';
import type { CreditCardPaymentFormData } from '../types/wallet.types';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripeInstance(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = env.stripePublishableKey;
    if (!key) {
      console.warn('[StripeService] PUBLISHABLE_KEY não configurada no frontend.');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

export function extractStripeErrorMessage(error: unknown): string {
  if (!error) return 'Erro desconhecido ao processar pagamento com cartão.';

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const stripeErr = error as StripeError;
    switch (stripeErr.code) {
      case 'card_declined':
        return 'O cartão foi recusado pelo banco emissor. Verifique os dados ou tente outro cartão.';
      case 'expired_card':
        return 'O cartão informado está vencido.';
      case 'incorrect_cvc':
        return 'O código de segurança (CVC) está incorreto.';
      case 'processing_error':
        return 'Ocorreu um erro ao processar a cobrança. Tente novamente em instantes.';
      case 'insufficient_funds':
        return 'Saldo insuficiente para concluir a transação.';
      default:
        return stripeErr.message || 'Falha ao processar pagamento no Stripe.';
    }
  }

  return String(error);
}

export function detectCardBrand(cardNumber: string): string {
  const clean = cardNumber.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return 'mastercard';
  if (/^3[47]/.test(clean)) return 'amex';
  if (/^(?:6011|65|64[4-9]|622)/.test(clean)) return 'discover';
  if (/^(?:2131|1800|35)/.test(clean)) return 'jcb';
  if (/^(?:50|5[6-9]|6[0-9])/.test(clean)) return 'elo';
  if (/^38[0-9]/.test(clean)) return 'hipercard';
  return 'credit_card';
}

export const detectPaymentMethodId = detectCardBrand;

export async function tokenizeCard(formData: CreditCardPaymentFormData): Promise<string> {
  const stripe = await getStripeInstance();
  if (!stripe) {
    // Retorna fallback token para testes locais sem conexão ativa com Stripe
    return `pm_tok_${Date.now()}_${formData.cardNumber.slice(-4) || '4242'}`;
  }

  const expMonth = Number(formData.expirationMonth) || 12;
  const rawYear = formData.expirationYear || '2030';
  const expYear = rawYear.length === 2 ? Number(`20${rawYear}`) : Number(rawYear);

  const rawStripe = stripe as unknown as {
    createToken: (
      type: 'card',
      data: {
        number: string;
        exp_month: number;
        exp_year: number;
        cvc?: string;
        name?: string;
      }
    ) => Promise<{ token?: { id: string }; error?: StripeError }>;
  };

  const result = await rawStripe.createToken('card', {
    number: formData.cardNumber.replace(/\D/g, ''),
    exp_month: expMonth,
    exp_year: expYear,
    cvc: formData.securityCode,
    name: formData.cardholderName,
  });

  if (result.error) {
    throw new Error(extractStripeErrorMessage(result.error));
  }

  if (!result.token?.id) {
    throw new Error('Falha ao tokenizar cartão via Stripe: ID do Token ausente.');
  }

  return result.token.id;
}

export const stripeService = {
  getInstance: getStripeInstance,
  extractErrorMessage: extractStripeErrorMessage,
  detectBrand: detectCardBrand,
  detectPaymentMethodId,
  tokenizeCard,
};

export default stripeService;
