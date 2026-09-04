/**
 * src/features/checkout/services/checkout.service.ts
 *
 * Camada de serviços HTTP para consumo dos endpoints de Checkout Transparente (/api/v1/checkout/*).
 * Integrado com o apiClient do projeto e tipado com os DTOs do checkout.
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type {
  CreditCardPaymentPayload,
  CreditCardPaymentResponse,
  OrderStatusSyncResponse,
  PixPaymentResponse,
} from '../types';

export const checkoutService = {
  /**
   * Gera uma preferência de pagamento transparente via PIX.
   * Endpoint: POST /api/v1/checkout/pix
   *
   * @param planId ID do plano a ser assinado
   * @returns Promessa contendo o QR Code Base64, chave copia e cola e expiração
   */
  createPixPayment: async (planId: string): Promise<PixPaymentResponse> => {
    try {
      const response = await apiClient.post<PixPaymentResponse>('/api/v1/checkout/pix', {
        plan_id: planId,
      });
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao gerar cobrança PIX. Por favor, tente novamente.'
      );
      throw new Error(message, { cause: error });
    }
  },

  /**
   * Processa uma cobrança transparente via Cartão de Crédito.
   * Endpoint: POST /api/v1/checkout/card
   *
   * @param payload Objeto contendo dados do cartão de crédito, parcelamento e titular
   * @returns Promessa contendo o status e ID do pagamento gerado
   */
  processCreditCard: async (
    payload: CreditCardPaymentPayload
  ): Promise<CreditCardPaymentResponse> => {
    try {
      const response = await apiClient.post<CreditCardPaymentResponse>(
        '/api/v1/checkout/card',
        payload
      );
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao processar o pagamento via cartão de crédito. Verifique os dados fornecidos.'
      );
      throw new Error(message, { cause: error });
    }
  },

  /**
   * Consulta/sincroniza o status atualizado de uma transação de pagamento.
   * Endpoint: GET /api/v1/checkout/status/{paymentId}
   *
   * @param paymentId ID da transação no gateway de pagamento
   * @returns Promessa contendo o status e flag de aprovação
   */
  syncOrderStatus: async (paymentId: string): Promise<OrderStatusSyncResponse> => {
    try {
      const response = await apiClient.get<OrderStatusSyncResponse>(
        `/api/v1/checkout/status/${paymentId}`
      );
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao sincronizar o status do pagamento. Tente novamente em instantes.'
      );
      throw new Error(message, { cause: error });
    }
  },
};

export default checkoutService;
