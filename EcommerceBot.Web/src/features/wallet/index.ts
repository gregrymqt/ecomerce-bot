/**
 * src/features/wallet/index.ts
 *
 * Barrel export canônico da Feature Wallet (Carteira, Saldo e Recargas).
 */

export * from './types';
export * from './services';
export * from './hooks';
export * from './components';
export * from './pages/WalletPage';
export { default as WalletPage } from './pages/WalletPage';
