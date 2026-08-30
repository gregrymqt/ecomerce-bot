/**
 * src/features/wallet/services/wallet.service.ts
 *
 * Camada de integração HTTP para os endpoints do módulo de Carteira (Wallet).
 * Integrado com o apiClient do projeto e tipado com os DTOs em types.
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
      throw new Error(msg);
    }
  },

  /**
   * Obtém o extrato de movimentações e transações da carteira.
   * Endpoint: GET /api/v1/wallet/statement
   *
   * @param params Filtros opcionais contendo page, limit e type ('RECHARGE' | 'USAGE' | 'ALL')
   */
  getWalletStatement: async (params?: StatementFilters): Promise<WalletStatementResponse> => {
    try {
      const response = await apiClient.get<WalletStatementResponse>('/api/v1/wallet/statement', {
        params,
      });
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Falha ao consultar o extrato de movimentações.');
      throw new Error(msg);
    }
  },

  /**
   * Solicita a criação de uma nova recarga de créditos na carteira.
   * Endpoint: POST /api/v1/wallet/recharge
   *
   * @param payload Objeto contendo pacote de créditos, método de pagamento e dados do pagador
   */
  createRecharge: async (payload: RechargeRequest): Promise<RechargeResponse> => {
    try {
      const response = await apiClient.post<RechargeResponse>('/api/v1/wallet/recharge', payload);
      return response.data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Falha ao solicitar recarga de créditos.');
      throw new Error(msg);
    }
  },

  /**
   * Processa a cobrança de recarga de carteira via Cartão de Crédito com tokenização MP.
   * Endpoint: POST /api/v1/wallet/recharge
   *
   * @param payload Payload contendo package_id, card_token, installments e dados do pagador
   */
  processCreditCardRecharge: async (payload: CreditCardRechargePayload): Promise<RechargeResponse> => {
    try {
      const { data } = await apiClient.post<RechargeResponse>('/api/v1/wallet/recharge', payload);
      return data;
    } catch (error: unknown) {
      const msg = getErrorMessage(error, 'Falha ao processar pagamento com cartão de crédito.');
      throw new Error(msg);
    }
  },
};

export default walletService;
