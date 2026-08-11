/**
 * src/features/wallet/services/wallet.service.ts
 *
 * Camada de integração HTTP para os endpoints do módulo de Carteira (Wallet).
 * Integrado com o apiClient do projeto e tipado com os DTOs em wallet.type.ts.
 */

import { apiClient } from '@/lib/apiClient';
import type {
  WalletBalanceResponse,
  StatementFilters,
  WalletStatementResponse,
  RechargeRequest,
  CreditCardRechargePayload,
  RechargeResponse,
} from '../types/wallet.type';

export const walletService = {
  /**
   * Obtém o saldo atual de créditos da carteira do tenant.
   * Endpoint: GET /api/v1/wallet/balance
   */
  getWalletBalance: async (): Promise<WalletBalanceResponse> => {
    const response = await apiClient.get<WalletBalanceResponse>('/api/v1/wallet/balance');
    return response.data;
  },

  /**
   * Obtém o extrato de movimentações e transações da carteira.
   * Endpoint: GET /api/v1/wallet/statement
   *
   * @param params Filtros opcionais contendo page, limit e type ('RECHARGE' | 'USAGE' | 'ALL')
   */
  getWalletStatement: async (params?: StatementFilters): Promise<WalletStatementResponse> => {
    const response = await apiClient.get<WalletStatementResponse>('/api/v1/wallet/statement', {
      params,
    });
    return response.data;
  },

  /**
   * Solicita a criação de uma nova recarga de créditos na carteira.
   * Endpoint: POST /api/v1/wallet/recharge
   *
   * @param payload Objeto contendo pacote de créditos, método de pagamento e dados do pagador
   */
  createRecharge: async (payload: RechargeRequest): Promise<RechargeResponse> => {
    const response = await apiClient.post<RechargeResponse>('/api/v1/wallet/recharge', payload);
    return response.data;
  },

  /**
   * Processa a cobrança de recarga de carteira via Cartão de Crédito com tokenização MP.
   * Endpoint: POST /api/v1/wallet/recharge
   *
   * @param payload Payload contendo package_id, card_token, installments e dados do pagador
   */
  processCreditCardRecharge: async (payload: CreditCardRechargePayload): Promise<RechargeResponse> => {
    const { data } = await apiClient.post<RechargeResponse>('/api/v1/wallet/recharge', payload);
    return data;
  },
};

export default walletService;
