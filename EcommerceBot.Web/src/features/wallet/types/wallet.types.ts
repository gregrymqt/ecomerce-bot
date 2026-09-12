/**
 * src/features/wallet/types/wallet.types.ts
 *
 * Contratos de tipos e DTOs canônicos para o Hub Financeiro da Wallet:
 * Gestão de Saldo, Extrato, Pacotes de Recarga, Planos SaaS e Pagamento Unificado Mercado Pago.
 * Alinhado estritamente com os padrões de arquitetura em 4 camadas e WCAG 2.1 AA.
 */

import React from 'react';

export type TransactionType =
  | 'RECHARGE'
  | 'USAGE'
  | 'WELCOME_BONUS'
  | 'PRODUCT_ENRICHMENT'
  | 'REFUND'
  | 'CHARGEBACK_REVERSAL'
  | 'ML_ANALYSIS';
export type WalletTab = 'BALANCE' | 'PLANS';
export type PaymentMethod = 'pix' | 'credit_card';
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface WalletBalanceResponse {
  tenant_id: string;
  balance_credits: number;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  tenant_id: string;
  amount: number;
  balance_after?: number;
  type: TransactionType;
  category?: 'RECHARGE' | 'USAGE';
  is_positive?: boolean;
  description: string | null;
  reference_id?: string | null;
  external_payment_id: string | null;
  created_at: string;
}

export interface WalletStatementResponse {
  balance_credits: number;
  transactions: CreditTransaction[];
  total_count: number;
}

export interface RechargePackage {
  id: string;
  name: string;
  credits: number;
  price_brl: number;
  description?: string;
  discount_badge?: string;
  is_popular?: boolean;
  features?: string[];
}

export interface SaaSPlan {
  id: string;
  name: string;
  description: string;
  price_monthly_brl: number;
  price_annual_brl: number;
  credits_included: number;
  features: string[];
  is_popular?: boolean;
  tier: 'free' | 'starter' | 'pro' | 'enterprise';
  trial_days?: number;
}

export type CheckoutTargetType = 'plan' | 'recharge';

export interface CheckoutTarget {
  type: CheckoutTargetType;
  id: string;
  name: string;
  amountBrl: number;
  credits: number;
  description?: string;
  trialDays?: number;
  billingPeriod?: 'monthly' | 'yearly';
}

export interface PixRechargeTabProps {
  loading: boolean;
  pixQrCode?: string;
  pixCopiaECola?: string;
  expirationDate?: string;
  onGeneratePix: () => void;
}

export interface CreditCardRechargeTabProps {
  packageId?: string;
  amountBrl?: number;
  loading?: boolean;
  onSuccessPayment?: () => void;
  onSubmitCard?: (payload: CreditCardRechargePayload) => Promise<void>;
  className?: string;
}


export interface RechargeRequest {
  credits_package: number;
  payment_method: 'pix' | 'credit_card';
  card_token?: string;
  payer_email: string;
  package_id?: string;
  amount?: number;
  payer?: {
    email?: string;
    identification?: {
      type: 'CPF' | 'CNPJ';
      number: string;
    };
    address?: {
      zip_code?: string;
      street_name?: string;
      street_number?: string;
      neighborhood?: string;
      city?: string;
      federal_unit?: string;
      complement?: string;
    };
  };
}

export interface CardPaymentPayer {
  email: string;
  identification: {
    type: 'CPF' | 'CNPJ';
    number: string;
  };
}

export interface CreditCardRechargePayload {
  package_id: string;
  amount: number;
  payment_method: 'credit_card';
  card_token: string;
  payment_method_id: string;
  issuer_id?: string;
  installments: number;
  payer: CardPaymentPayer;
}

export interface CreditCardPaymentPayload {
  plan_id: string;
  card_number: string;
  cardholder_name: string;
  expiration_month: string;
  expiration_year: string;
  security_code: string;
  installments: number;
  doc_number: string;
  card_token?: string;
  payment_method_id?: string;
}

export interface CreditCardPaymentResponse {
  payment_id: string;
  status: PaymentStatus;
  message?: string;
}

export interface PixPaymentResponse {
  payment_id: string;
  qr_code_base64: string;
  qr_code_copy_paste: string;
  expires_at: string;
  status: PaymentStatus;
}

export interface OrderStatusSyncResponse {
  payment_id: string;
  status: PaymentStatus;
  is_approved: boolean;
}

export interface RechargeResponse {
  payment_id: string;
  status: string;
  pix_qr_code?: string;
  pix_copia_e_cola?: string;
  expiration_date?: string;
}

export interface StatementFilters {
  page?: number;
  limit?: number;
  type?: TransactionType | 'ALL';
}

export interface UseWalletReturn {
  balance: number | null;
  transactions: CreditTransaction[];
  totalCount: number;
  loadingBalance: boolean;
  loadingStatement: boolean;
  error: string | null;
  page: number;
  typeFilter: TransactionType | 'ALL';
  setPage: React.Dispatch<React.SetStateAction<number>>;
  setTypeFilter: React.Dispatch<React.SetStateAction<TransactionType | 'ALL'>>;
  refetchWallet: () => Promise<[void, void]>;
}

export interface CreditCardFormData {
  cardNumber: string;
  cardholderName: string;
  expirationDate: string;
  securityCode: string;
  installments: number;
}

export interface UseCreditCardFormProps {
  onSubmitCard: (cardData: CreditCardFormData) => Promise<void>;
  amountBrl?: number;
}

export interface UseRechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessPayment?: () => void;
}

export interface WalletBalanceCardProps {
  balance: number | null;
  loading: boolean;
  onOpenRechargeModal?: () => void;
  onRechargeClick?: () => void;
}

export interface CreditPackagesGridProps {
  packages?: RechargePackage[];
  loading?: boolean;
  onSelectPackage: (pkg: RechargePackage) => void;
  className?: string;
}

export interface UsageInsightsCardProps {
  monthlyUsage: number;
  successRate?: number;
}

export interface TransactionHistoryTableProps {
  transactions: CreditTransaction[];
  loading: boolean;
  activeFilter: 'ALL' | TransactionType;
  onFilterChange: (filter: 'ALL' | TransactionType) => void;
  totalCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
}

export type RechargeModalProps = UseRechargeModalProps;

export interface UnifiedPaymentModalProps {
  isOpen: boolean;
  target: CheckoutTarget | null;
  onClose: () => void;
  onSuccessPayment?: () => void;
}
