import { useState, useCallback } from 'react';
import type {
  CreatePixCheckoutPayload,
  CreateCreditCardCheckoutPayload,
  CheckoutResultOutput,
  OrderDetails,
} from '../types/checkout.type';
import { checkoutService } from '../services/checkout.service';
import { getErrorMessage } from '@/utils/errors';

export function useCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResultOutput | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);

  /**
   * Executa pagamento PIX
   */
  const processPixPayment = async (payload: CreatePixCheckoutPayload) => {
    setLoading(true);
    setError(null);
    try {
      const result = await checkoutService.createPixPayment(payload);
      setCheckoutResult(result);
      return result;
    } catch (err) {
      const msg = getErrorMessage(err, 'Falha ao gerar cobrança PIX.');
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Executa pagamento por Cartão de Crédito
   */
  const processCreditCardPayment = async (payload: CreateCreditCardCheckoutPayload) => {
    setLoading(true);
    setError(null);
    try {
      const result = await checkoutService.createCreditCardPayment(payload);
      setCheckoutResult(result);
      return result;
    } catch (err) {
      const msg = getErrorMessage(err, 'Falha ao processar pagamento com cartão.');
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Consulta pedido por ID
   */
  const fetchOrder = useCallback(async (orderId: string) => {
    setLoading(true);
    setError(null);
    try {
      const order = await checkoutService.getOrderById(orderId);
      setOrderDetails(order);
      return order;
    } catch (err) {
      const msg = getErrorMessage(err, 'Pedido não encontrado.');
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Sincroniza estado com o Mercado Pago
   */
  const syncOrder = async (mpOrderId: string) => {
    try {
      const synced = await checkoutService.syncOrderStatus(mpOrderId);
      setOrderDetails(synced);
      if (checkoutResult && checkoutResult.mp_order_id === mpOrderId) {
        setCheckoutResult((prev) => (prev ? { ...prev, status: synced.status } : null));
      }
      return synced;
    } catch (err) {
      console.warn('Erro ao sincronizar order:', err);
    }
  };

  /**
   * Cancela pedido
   */
  const cancelOrder = async (orderId: string) => {
    setLoading(true);
    try {
      await checkoutService.cancelOrder(orderId);
      if (orderDetails) {
        setOrderDetails((prev) => (prev ? { ...prev, status: 'canceled' } : null));
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao cancelar pedido.'));
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    checkoutResult,
    orderDetails,
    processPixPayment,
    processCreditCardPayment,
    fetchOrder,
    syncOrder,
    cancelOrder,
  };
}