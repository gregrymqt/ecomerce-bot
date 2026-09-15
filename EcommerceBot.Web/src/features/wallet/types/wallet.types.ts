/**
 * src/features/wallet/types/wallet.types.ts
 *
 * Contratos de tipos e DTOs canônicos para o Hub Financeiro da Wallet:
 * Gestão de Saldo, Extrato, Pacotes de Recarga, Planos SaaS e Pagamento Unificado Mercado Pago.
 * Alinhado estritamente com os padrões de arquitetura em 4 camadas e WCAG 2.1 AA.
 */

import React from 'react';
import type { CardTokenParams } from './mercadopago.types';

export type TransactionType =
  | 'RECHARGE'
  | 'USAGE'
  | 'WELCOME_BONUS'
  | 'PRODUCT_ENRICHMENT'
  | 'REFUND'
  | 'CHARGEBACK_REVERSAL'
  | 'ML_ANALYSIS';
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


export interface CheckoutTarget {
  id: string;
  name: string;
  amountBrl: number;
  credits: number;
  description?: string;
}

export interface RechargeBillingAddress {
  zip_code?: string;
  street_name?: string;
  street_number?: string;
  neighborhood?: string;
  city?: string;
  federal_unit?: string;
  complement?: string;
}

export interface RechargePayer {
  first_name?: string;
  last_name?: string;
  email?: string;
  identification_type?: string;
  identification_number?: string;
  address?: RechargeBillingAddress;
}

export interface RechargeRequest {
  amount: number;
  package_id?: string;
  payment_method: 'pix' | 'credit_card';
  card_token?: string;
  payment_method_id?: string;
  installments?: number;
  payer?: RechargePayer;
}

export interface CreditCardRechargePayload {
  amount: number;
  package_id?: string;
  payment_method: 'credit_card';
  card_token: string;
  payment_method_id: string;
  installments: number;
  payer?: RechargePayer;
}

export interface RechargeResponse {
  order_id: string;
  payment_id: string;
  status: string;
  payment_method?: string;
  total_amount?: number;
  credits_added?: number;
  pix_qr_code?: string;
  pix_qr_code_base64?: string;
  ticket_url?: string;
  expiration_date?: string;
}

export interface PixPaymentData {
  order_id: string;
  payment_id: string;
  pix_qr_code: string;
  pix_qr_code_base64?: string;
  expires_at: string;
  status: PaymentStatus;
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

export interface CreditCardPaymentFormData extends CardTokenParams {
  cardNumber: string;
  cardholderName: string;
  securityCode: string;
  installments: number;
  expirationMonth: string;
  expirationYear: string;
  docNumber: string;
}

export interface WalletBalanceCardProps {
  balance: number | null;
  loading: boolean;
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

export interface UnifiedPaymentModalProps {
  isOpen: boolean;
  target: CheckoutTarget | null;
  onClose: () => void;
  onSuccessPayment?: () => void;
}
