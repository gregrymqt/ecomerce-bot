export type BillingCycle = 'monthly' | 'yearly';
export type PaymentMethodType = 'credit_card' | 'pix';
export type InvoiceStatus = 'PAGO' | 'PENDENTE' | 'CANCELADO';

export interface PlanTier {
  id: 'starter' | 'pro' | 'enterprise';
  name: string;
  priceMonthly: number;
  priceYearly: number;
  credits: number;
  features: string[];
  isPopular?: boolean;
}

export interface SubscriptionDetails {
  planName: string;
  priceFormatted: string;
  status: 'active' | 'canceled' | 'past_due';
  renewalDate: string;
  creditsUsed: number;
  creditsTotal: number;
  resetDaysLeft: number;
}

export interface Invoice {
  id: string;
  date: string;
  planName: string;
  amountFormatted: string;
  method: PaymentMethodType;
  status: InvoiceStatus;
  pdfUrl?: string;
}
