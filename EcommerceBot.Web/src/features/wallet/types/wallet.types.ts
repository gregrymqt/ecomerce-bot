/**
 * src/features/wallet/types/wallet.types.ts
 *
 * Contratos de tipos e DTOs canônicos para a feature Wallet (Carteira, Saldo e Recargas).
 * Alinhado estritamente com os padrões de arquitetura em 4 camadas e WCAG 2.1 AA.
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
  payment_method_id: string; // ex: 'visa', 'master'
  issuer_id?: string;
  installments: number;
  payer: CardPaymentPayer;
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
  onOpenRechargeModal: () => void;
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

export interface PixRechargeTabProps {
  pixQrCode?: string;
  pixCopiaECola?: string;
  expirationDate?: string;
  loading: boolean;
  onGeneratePix?: () => void;
}

export interface CreditCardRechargeTabProps {
  packageId?: string;
  amountBrl?: number;
  loading?: boolean;
  onSuccessPayment?: () => void;
  onSubmitCard?: (payload: CreditCardRechargePayload) => Promise<void>;
  className?: string;
}
