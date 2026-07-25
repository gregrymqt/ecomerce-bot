import { apiClient } from '@/lib/apiClient';
import type {
  CreatePixCheckoutPayload,
  CreateCreditCardCheckoutPayload,
  CheckoutResultOutput,
  OrderDetails,
} from '../types/checkout.type';

export const checkoutService = {
  /**
   * Gera preferência e cobrança instantânea via PIX com QR Code
   */
  createPixPayment: async (payload: CreatePixCheckoutPayload): Promise<CheckoutResultOutput> => {
    const response = await apiClient.post<CheckoutResultOutput>('/api/v1/checkout/pix', payload);
    return response.data;
  },

  /**
   * Processa cobrança transparente direta no cartão de crédito via token
   */
  createCreditCardPayment: async (
    payload: CreateCreditCardCheckoutPayload
  ): Promise<CheckoutResultOutput> => {
    const response = await apiClient.post<CheckoutResultOutput>(
      '/api/v1/checkout/credit-card',
      payload
    );
    return response.data;
  },

  /**
   * Busca detalhes do pedido pelo ID interno da aplicação
   */
  getOrderById: async (orderId: string): Promise<OrderDetails> => {
    const response = await apiClient.get<OrderDetails>(`/api/v1/checkout/orders/${orderId}`);
    return response.data;
  },

  /**
   * Força sincronização do status diretamente com a API do Mercado Pago
   */
  syncOrderStatus: async (mpOrderId: string): Promise<OrderDetails> => {
    const response = await apiClient.post<OrderDetails>(
      `/api/v1/checkout/orders/${mpOrderId}/sync`
    );
    return response.data;
  },

  /**
   * Cancela pedido pendente
   */
  cancelOrder: async (orderId: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(
      `/api/v1/checkout/orders/${orderId}/cancel`
    );
    return response.data;
  },

  /**
   * Solicita reembolso total ou parcial de um pedido aprovado
   */
  refundOrder: async (
    orderId: string,
    amount?: number
  ): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(
      `/api/v1/checkout/orders/${orderId}/refund`,
      null,
      { params: { amount } }
    );
    return response.data;
  },
};