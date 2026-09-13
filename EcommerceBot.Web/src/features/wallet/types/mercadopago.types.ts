/**
 * src/features/wallet/types/mercadopago.types.ts
 *
 * Re-exportação canônica e tipada dos contratos oficiais do SDK do Mercado Pago
 * (@mercadopago/sdk-react e @mercadopago/sdk-js).
 */

export type {
  ProcessingMode,
  Issuer,
  PayerCost,
  Identification,
  Cardholder,
  CardToken,
} from '@mercadopago/sdk-react/esm/coreMethods/util/types';

export type {
  CardTokenParams,
  CardTokenUpdateParams,
} from '@mercadopago/sdk-react/esm/coreMethods/cardToken/types';

export type {
  TOptions,
  TInstanceMercadoPago,
  BricksBuilderType,
} from '@mercadopago/sdk-react/esm/mercadoPago/initMercadoPago/type';

export type {
  IdentificationType,
} from '@mercadopago/sdk-react/esm/coreMethods/getIdentificationTypes/types';

export type {
  Installments,
  InstallmentsParams,
} from '@mercadopago/sdk-react/esm/coreMethods/getInstallments/types';

export type {
  Issuers,
  IssuersParams,
} from '@mercadopago/sdk-react/esm/coreMethods/getIssuers/types';

export type {
  PaymentMethods,
  PaymentMethodsParams,
} from '@mercadopago/sdk-react/esm/coreMethods/getPaymentMethods/types';
