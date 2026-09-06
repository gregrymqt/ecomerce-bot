/**
 * src/features/wallet/services/wallet.service.ts
 *
 * Camada de integração HTTP para os endpoints do Hub Financeiro:
 * Saldo, Extrato, Recarga de Créditos e Assinatura de Planos SaaS via Mercado Pago.
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type {
  WalletBalanceResponse,
  StatementFilters,
  WalletStatementResponse,
  RechargeRequest,
  CreditCardRechargePayload,
  RechargeResponse,
  PixPaymentResponse,
  CreditCardPaymentPayload,
  CreditCardPaymentResponse,
  OrderStatusSyncResponse,
} from '../types';

export const walletService = {
  /**
   * Obtém o saldo atual de créditos da carteira do tenant.
   * Endpoint: GET /api/v1/wallet/balance
   */
  getWalletBalance: async (): Promise<WalletBalanceResponse> => {
    try {
      const response = await apiClient.get<WalletBalanceResponse>('/api/v1/wallet/balance');
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Falha ao obter saldo da carteira.');
      throw new Error(msg, { cause: error });
    }
  },

  /**
   * Obtém o extrato de movimentações e transações da carteira.
   * Endpoint: GET /api/v1/wallet/statement
   */
  getWalletStatement: async (params?: StatementFilters): Promise<WalletStatementResponse> => {
    try {
      const response = await apiClient.get<WalletStatementResponse>('/api/v1/wallet/statement', {
        params,
      });
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Falha ao consultar o extrato de movimentações.');
      throw new Error(msg, { cause: error });
    }
  },

  /**
   * Solicita a criação de uma nova recarga de créditos na carteira via PIX.
   * Endpoint: POST /api/v1/wallet/recharge
   */
  createRecharge: async (payload: RechargeRequest): Promise<RechargeResponse> => {
    try {
      const response = await apiClient.post<RechargeResponse>('/api/v1/wallet/recharge', payload);
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Falha ao solicitar recarga de créditos.');
      throw new Error(msg, { cause: error });
    }
  },

  /**
   * Processa a cobrança de recarga de carteira via Cartão de Crédito.
   * Endpoint: POST /api/v1/wallet/recharge
   */
  processCreditCardRecharge: async (payload: CreditCardRechargePayload): Promise<RechargeResponse> => {
    try {
      const { data } = await apiClient.post<RechargeResponse>('/api/v1/wallet/recharge', payload);
      return data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Falha ao processar pagamento com cartão de crédito.');
      throw new Error(msg, { cause: error });
    }
  },

  /**
   * Gera cobrança transparente via PIX para assinatura de Plano SaaS.
   * Endpoint: POST /api/v1/checkout/pix
   */
  createPixPlanPayment: async (planId: string): Promise<PixPaymentResponse> => {
    try {
      const response = await apiClient.post<PixPaymentResponse>('/api/v1/checkout/pix', {
        plan_id: planId,
      });
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Erro ao gerar cobrança PIX para o plano.');
      throw new Error(msg, { cause: error });
    }
  },

  /**
   * Processa pagamento via Cartão de Crédito para assinatura de Plano SaaS.
   * Endpoint: POST /api/v1/checkout/card
   */
  processCreditCardPlanPayment: async (
    payload: CreditCardPaymentPayload
  ): Promise<CreditCardPaymentResponse> => {
    try {
      const response = await apiClient.post<CreditCardPaymentResponse>(
        '/api/v1/checkout/card',
        payload
      );
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Erro ao processar pagamento do plano com cartão.');
      throw new Error(msg, { cause: error });
    }
  },

  /**
   * Consulta/sincroniza o status de uma transação de pagamento.
   * Endpoint: GET /api/v1/checkout/status/{paymentId}
   */
  syncPaymentStatus: async (paymentId: string): Promise<OrderStatusSyncResponse> => {
    try {
      const response = await apiClient.get<OrderStatusSyncResponse>(
        `/api/v1/checkout/status/${paymentId}`
      );
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Erro ao sincronizar status do pagamento.');
      throw new Error(msg, { cause: error });
    }
  },
};

export default walletService;
