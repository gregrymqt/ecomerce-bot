/**
 * src/features/wallet/types/wallet.type.ts
 *
 * Contratos de tipos e DTOs para a feature de Carteira (Wallet), Saldo e Recargas.
 * Alinhado estritamente com a arquitetura DDD e os Schemas do backend (ecom-autobot-api).
 */

export type TransactionType = 'RECHARGE' | 'USAGE';

export interface WalletBalanceResponse {
  tenant_id: string;
  balance_credits: number;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  tenant_id: string;
  amount: number;
  type: TransactionType;
  description: string | null;
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
  credits: number;
  price_brl: number;
  discount_badge?: string;
  is_popular?: boolean;
}

export interface RechargeRequest {
  credits_package: number;
  payment_method: 'pix' | 'credit_card';
  card_token?: string;
  payer_email: string;
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
