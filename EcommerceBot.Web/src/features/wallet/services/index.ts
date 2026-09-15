/**
 * src/features/wallet/services/index.ts
 *
 * Barrel export dos serviços de Wallet.
 */

export * from './wallet.service';
export * from './billing.service';
export * from './mercadoPago.service';
export { default as walletService } from './wallet.service';
export { default as billingService } from './billing.service';
export { default as mercadoPagoService } from './mercadoPago.service';
