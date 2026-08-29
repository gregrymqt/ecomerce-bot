/**
 * src/features/auth/index.ts
 *
 * Ponto de entrada público do módulo de Autenticação, Multi-Tenancy e Controle de Acesso.
 */

// Types
export * from './types';

// Services
export * from './services';

// Context
export * from './context';

// Hooks
export * from './hooks';

// Components (Guards, Forms, SSO, Layout)
export * from './components';

// Page Props / Types (Páginas são lazy-loaded via @/features/auth/pages/* para otimização de bundle)
export type { AuthPageProps } from './pages/AuthPage';
