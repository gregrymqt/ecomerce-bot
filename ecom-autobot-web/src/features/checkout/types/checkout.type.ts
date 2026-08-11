/**
 * src/features/checkout/types/checkout.type.ts
 *
 * Contratos de tipos e DTOs para o fluxo de Checkout Transparente (PIX e Cartão de Crédito).
 * Alinhado estritamente com a arquitetura DDD e os schemas do backend (ecom-autobot-api).
 */

/**
 * Métodos de pagamento suportados no checkout transparente.
 */
export type PaymentMethod = 'PIX' | 'CREDIT_CARD';

/**
 * Status possíveis de uma transação de pagamento.
 */
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

/**
 * Payload para requisição de criação de pagamento via PIX.
 */
export interface PixPaymentRequest {
  /** ID do plano de assinatura a ser contratado */
  plan_id: string;
  /** Identificador opcional do tenant (caso não enviado via X-Tenant-ID header) */
  tenant_id?: string;
}

/**
 * Resposta retornada pela API ao gerar um pagamento via PIX.
 */
export interface PixPaymentResponse {
  /** ID único do pagamento gerado no gateway/banco */
  payment_id: string;
  /** Imagem do QR Code em string Base64 para renderização direta */
  qr_code_base64: string;
  /** Código "Copia e Cola" do PIX para transferência manual */
  qr_code_copy_paste: string;
  /** Data e hora de expiração da chave PIX em formato ISO 8601 */
  expires_at: string;
  /** Status atual da transação PIX */
  status: PaymentStatus;
}

/**
 * Payload completo para processar pagamento via Cartão de Crédito.
 */
export interface CreditCardPaymentPayload {
  /** ID do plano de assinatura selecionado */
  plan_id: string;
  /** Número do cartão de crédito (apenas dígitos ou formatado) */
  card_number: string;
  /** Nome impresso no cartão de crédito */
  cardholder_name: string;
  /** Mês de expiração do cartão (ex: "08" ou "8") */
  expiration_month: string;
  /** Ano de expiração do cartão (ex: "2028" ou "28") */
  expiration_year: string;
  /** Código de segurança (CVV/CVC) */
  security_code: string;
  /** Número de parcelas escolhido (ex: 1 até 12) */
  installments: number;
  /** Número de documento do titular do cartão (CPF/CNPJ) */
  doc_number: string;
  /** Token gerado via SDK do Mercado Pago (PCI-DSS) */
  card_token?: string;
  /** Identificador da bandeira (ex: 'visa', 'master', 'elo') */
  payment_method_id?: string;
}

/**
 * Resposta retornada pela API ao processar um pagamento via Cartão de Crédito.
 */
export interface CreditCardPaymentResponse {
  /** ID único da transação de cartão de crédito */
  payment_id: string;
  /** Status do pagamento após tentativa de autorização/captura */
  status: PaymentStatus;
  /** Mensagem descritiva adicional (ex: motivo de recusa ou instrução) */
  message?: string;
}

/**
 * Resposta da sincronização/polling do status de um pedido/pagamento.
 */
export interface OrderStatusSyncResponse {
  /** ID do pagamento sincronizado */
  payment_id: string;
  /** Status atualizado do pagamento */
  status: PaymentStatus;
  /** Indicador booleano de aprovação do pagamento */
  is_approved: boolean;
}
