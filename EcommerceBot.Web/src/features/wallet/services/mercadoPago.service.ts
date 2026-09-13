/**
 * src/features/wallet/services/mercadoPago.service.ts
 *
 * Serviço canônico de integração com o SDK oficial do Mercado Pago no Frontend.
 * Utiliza o singleton MercadoPagoInstance e métodos nativos do pacote oficial
 * (@mercadopago/sdk-react e @mercadopago/sdk-js) sem duplicação ou tipos manuais.
 */

import initMercadoPago, { MercadoPagoInstance } from '@mercadopago/sdk-react/esm/mercadoPago/initMercadoPago';
import type {
  TInstanceMercadoPago,
  CardToken,
  CardTokenParams,
  IdentificationType,
  Installments,
  InstallmentsParams,
  Issuers,
  IssuersParams,
  PaymentMethods,
  PaymentMethodsParams,
} from '../types/mercadopago.types';
import { env } from '@/config/env';

// Mapa amigável de códigos de validação de token do Mercado Pago
const MP_ERROR_MESSAGES: Record<string, string> = {
  '205': 'Digite o número do seu cartão de crédito.',
  '208': 'Escolha o mês de vencimento do cartão.',
  '209': 'Escolha o ano de vencimento do cartão.',
  '214': 'Informe o documento do titular (CPF ou CNPJ).',
  '220': 'Informe o banco emissor do cartão.',
  '221': 'Informe o nome e sobrenome do titular como impresso no cartão.',
  '224': 'Digite o código de segurança (CVV).',
  'E301': 'Número de cartão inválido ou bandeira não reconhecida.',
  'E302': 'Código de segurança (CVV) inválido para este cartão.',
  '316': 'Nome do titular inválido.',
  '322': 'Tipo de documento inválido.',
  '323': 'Tipo de documento não confere com o número informado.',
  '324': 'Número de documento (CPF/CNPJ) inválido.',
  '325': 'Mês de vencimento inválido.',
  '326': 'Ano de vencimento inválido ou cartão expirado.',
  'default': 'Não foi possível validar os dados do cartão de crédito no Mercado Pago. Verifique os dados digitados.',
};

/**
 * Inicializa e obtém a instância singleton oficial do Mercado Pago via SDK.
 */
export async function getMercadoPagoInstance(): Promise<TInstanceMercadoPago> {
  const publicKey = env.mercadoPagoPublicKey;
  if (!publicKey) {
    throw new Error('Chave pública do Mercado Pago (VITE_MERCADOPAGO_PUBLIC_KEY) não configurada.');
  }

  if (typeof window === 'undefined') {
    throw new Error('Mercado Pago SDK requer ambiente de navegador.');
  }

  initMercadoPago(publicKey, { locale: 'pt-BR' });

  const instance = await MercadoPagoInstance.getInstance();
  if (!instance) {
    throw new Error('Falha ao instanciar o SDK oficial do Mercado Pago.');
  }

  return instance;
}

/**
 * Identifica a bandeira/id do método de pagamento a partir do BIN do cartão.
 */
export function detectPaymentMethodId(cardNumber: string): string {
  const clean = cardNumber.replace(/\D/g, '');
  if (clean.startsWith('4')) return 'visa';
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return 'master';
  if (/^3[47]/.test(clean)) return 'amex';
  if (/^(6011|65|64[4-9])/.test(clean)) return 'elo';
  if (/^(38|60)/.test(clean)) return 'hipercard';
  return 'visa';
}

/**
 * Serviço de integração Mercado Pago no Frontend.
 */
export const mercadoPagoService = {
  /**
   * Obtém a instância singleton nativa do Mercado Pago SDK (TInstanceMercadoPago).
   */
  getInstance: getMercadoPagoInstance,

  /**
   * Tokeniza os dados de cartão de crédito no cofre PCI-DSS do Mercado Pago
   * utilizando diretamente o método nativo createCardToken do SDK.
   * Retorna estritamente o token de segurança (id com comprimento >= 32).
   */
  tokenizeCard: async (params: CardTokenParams): Promise<string> => {
    const rawNumber = params.cardNumber || '';
    const cleanCardNumber = rawNumber.replace(/\D/g, '');
    const cleanDocNumber = (params.identificationNumber || '').replace(/\D/g, '');
    const expYearRaw = params.cardExpirationYear || '';
    const fullYear = expYearRaw.length === 2 ? `20${expYearRaw}` : expYearRaw;
    const expMonthRaw = params.cardExpirationMonth || '';

    const mp = await getMercadoPagoInstance();

    const cardTokenParams: CardTokenParams = {
      cardNumber: cleanCardNumber,
      cardholderName: (params.cardholderName || '').trim(),
      cardExpirationMonth: expMonthRaw.padStart(2, '0'),
      cardExpirationYear: fullYear,
      securityCode: (params.securityCode || '').trim(),
      identificationType: params.identificationType || (cleanDocNumber.length > 11 ? 'CNPJ' : 'CPF'),
      identificationNumber: cleanDocNumber,
    };

    let tokenResult: CardToken;
    try {
      tokenResult = await mp.createCardToken(cardTokenParams);
    } catch (sdkError: unknown) {
      const rawError = sdkError as {
        cause?: Array<{ code: string; description?: string; message?: string }>;
        message?: string;
      };
      if (Array.isArray(rawError?.cause) && rawError.cause.length > 0) {
        const firstCause = rawError.cause[0];
        const mapped = MP_ERROR_MESSAGES[firstCause.code] || firstCause.description || firstCause.message || MP_ERROR_MESSAGES.default;
        throw new Error(mapped, { cause: sdkError });
      }
      const msg = sdkError instanceof Error ? sdkError.message : 'Erro na comunicação com o Mercado Pago.';
      throw new Error(msg, { cause: sdkError });
    }

    const rawResult = tokenResult as unknown as {
      id?: string;
      cause?: Array<{ code: string; description?: string; message?: string }>;
      message?: string;
    };

    if (!rawResult || !rawResult.id) {
      if (Array.isArray(rawResult?.cause) && rawResult.cause.length > 0) {
        const firstCause = rawResult.cause[0];
        const mapped = MP_ERROR_MESSAGES[firstCause.code] || firstCause.description || firstCause.message || MP_ERROR_MESSAGES.default;
        throw new Error(mapped);
      }
      throw new Error(rawResult?.message || MP_ERROR_MESSAGES.default);
    }

    if (rawResult.id.length < 32) {
      throw new Error('Token gerado pelo Mercado Pago é inválido (comprimento inferior a 32 caracteres).');
    }

    return rawResult.id;
  },

  /**
   * Executa a tokenização direta utilizando os parâmetros nativos CardTokenParams.
   */
  createCardToken: async (params: CardTokenParams): Promise<CardToken> => {
    const mp = await getMercadoPagoInstance();
    return mp.createCardToken(params);
  },

  /**
   * Busca os tipos de identificação suportados (CPF, CNPJ, etc.).
   */
  getIdentificationTypes: async (): Promise<IdentificationType[]> => {
    const mp = await getMercadoPagoInstance();
    return mp.getIdentificationTypes();
  },

  /**
   * Busca métodos de pagamento disponíveis para o BIN/condições fornecidas.
   */
  getPaymentMethods: async (params: PaymentMethodsParams): Promise<PaymentMethods> => {
    const mp = await getMercadoPagoInstance();
    return mp.getPaymentMethods(params);
  },

  /**
   * Busca os emissores (bancos) disponíveis para o método e BIN.
   */
  getIssuers: async (params: IssuersParams): Promise<Issuers[]> => {
    const mp = await getMercadoPagoInstance();
    return mp.getIssuers(params);
  },

  /**
   * Busca as opções de parcelamento (installments) disponíveis.
   */
  getInstallments: async (params: InstallmentsParams): Promise<Installments[]> => {
    const mp = await getMercadoPagoInstance();
    return mp.getInstallments(params);
  },
};
