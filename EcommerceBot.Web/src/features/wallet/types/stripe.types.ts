/**
 * src/features/wallet/types/stripe.types.ts
 *
 * Contratos fortemente tipados para a integração com Stripe no Frontend.
 * Cobre suporte a Stripe Elements, criação de PaymentMethod/Token e confirmação de pagamentos.
 */

import type { Stripe, StripeElements } from '@stripe/stripe-js';

export type StripeInstance = Stripe | null;

export interface StripePaymentMethodResult {
  paymentMethodId: string;
  brand?: string;
  last4?: string;
}

export interface StripeCardFormData {
  cardholderName: string;
  cardNumber?: string;
  cardExpiration?: string;
  securityCode?: string;
  installments?: number;
  docType?: 'CPF' | 'CNPJ';
  docNumber?: string;
}

export interface ConfirmStripePaymentOptions {
  clientSecret: string;
  elements?: StripeElements;
  paymentMethod?: string;
  returnUrl?: string;
}
