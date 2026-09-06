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
  RechargePackage,
  RechargeRequest,
  CreditCardRechargePayload,
  RechargeResponse,
  PixPaymentResponse,
  CreditCardPaymentPayload,
  CreditCardPaymentResponse,
  OrderStatusSyncResponse,
} from '../types';

export const CANONICAL_RECHARGE_PACKAGES: RechargePackage[] = [
  {
    id: 'starter-package',
    name: 'Starter AI',
    credits: 500,
    price_brl: 49,
    description: 'Ideal para lojas iniciando a automação do catálogo com títulos e descrições SEO.',
    features: [
      '500 créditos perpétuos (sem expiração)',
      '1 produto enriquecido = 1 crédito',
      'Exportação para Shopify e Nuvemshop',
      'Ativação imediata via PIX e Cartão',
    ],
  },
  {
    id: 'pro-package',
    name: 'Pro AI',
    credits: 2000,
    price_brl: 149,
    description: 'Para operações em escala acelerada com copy magnética e sincronização contínua.',
    is_popular: true,
    discount_badge: 'Mais Popular',
    features: [
      '2.000 créditos perpétuos (sem expiração)',
      '1 produto enriquecido = 1 crédito',
      'Sincronização em lote ultra-rápida',
      'Melhor taxa por produto processado',
      'Suporte prioritário via WhatsApp',
    ],
  },
  {
    id: 'scale-package',
    name: 'Scale AI',
    credits: 6000,
    price_brl: 399,
    description: 'Alta demanda para grandes catálogos e automação profunda de e-commerce.',
    discount_badge: 'Melhor Custo',
    features: [
      '6.000 créditos perpétuos (sem expiração)',
      '1 produto enriquecido = 1 crédito',
      'Até 6.000 produtos enriquecidos',
      'Menor custo unitário por crédito',
      'Prioridade máxima na fila RabbitMQ',
    ],
  },
];

export const walletService = {
  /**
   * Obtém a lista de pacotes de recarga de créditos disponíveis.
   * Consulta o catálogo da API com fallback resiliente para pacotes canônicos.
   * Endpoint: GET /api/v1/plans?onlyActive=true
   */
  getCreditPackages: async (signal?: AbortSignal): Promise<RechargePackage[]> => {
    try {
      const response = await apiClient.get<
        Array<{
          id: string;
          name: string;
          description?: string;
          price?: number;
          price_brl?: number;
          creditsIncluded?: number;
          credits?: number;
        }>
      >('/api/v1/plans?onlyActive=true', { signal });

      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data.map((p) => {
          const credits = p.creditsIncluded ?? p.credits ?? 500;
          const price = p.price ?? p.price_brl ?? 49;
          const isPro = p.name.toLowerCase().includes('pro');
          const isScale = p.name.toLowerCase().includes('scale') || credits >= 5000;

          return {
            id: p.id,
            name: p.name,
            description: p.description || undefined,
            credits,
            price_brl: price,
            is_popular: isPro,
            discount_badge: isPro ? 'Mais Popular' : isScale ? 'Melhor Custo' : undefined,
            features: [
              `${credits.toLocaleString('pt-BR')} créditos perpétuos`,
              '1 produto enriquecido = 1 crédito',
              'Exportação para Shopify e Nuvemshop',
              'Ativação imediata via PIX e Cartão',
            ],
          };
        });
      }

      return CANONICAL_RECHARGE_PACKAGES;
    } catch {
      return CANONICAL_RECHARGE_PACKAGES;
    }
  },

  /**
   * Obtém o saldo atual de créditos da carteira do tenant.
   * Endpoint: GET /api/v1/wallet/balance
   */
  getWalletBalance: async (signal?: AbortSignal): Promise<WalletBalanceResponse> => {
    try {
      const response = await apiClient.get<WalletBalanceResponse>('/api/v1/wallet/balance', { signal });
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
  getWalletStatement: async (params?: StatementFilters, signal?: AbortSignal): Promise<WalletStatementResponse> => {
    try {
      const response = await apiClient.get<WalletStatementResponse>('/api/v1/wallet/statement', {
        params,
        signal,
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
