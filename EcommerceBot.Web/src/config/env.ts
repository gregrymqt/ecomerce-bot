/**
 * src/config/env.ts
 *
 * Módulo centralizado e fortemente tipado de variáveis de ambiente do Frontend Web SPA.
 * Lê as variáveis injetadas pelo Vite a partir do arquivo .env da raiz do monorepo.
 */

export interface AppEnvConfig {
  /** URL Base da Core API (ex: http://localhost:5183 ou túnel ngrok) */
  readonly apiUrl: string;
  /** Chave Pública do Mercado Pago para Tokenização PCI-DSS */
  readonly mercadoPagoPublicKey: string;
  /** ID de Medição do Google Analytics 4 (ex: G-XXXXXXXXXX) */
  readonly gaMeasurementId: string;
  /** ID do Projeto do Microsoft Clarity (ex: XXXXXXXXXX) */
  readonly clarityProjectId: string;
  /** Ambiente de execução (development, staging, production) */
  readonly environment: string;
  /** Flag indicativa se está em modo de desenvolvimento */
  readonly isDev: boolean;
  /** Flag indicativa se está em modo de produção */
  readonly isProd: boolean;
}

export const env: AppEnvConfig = Object.freeze({
  apiUrl: (import.meta.env.VITE_API_URL || 'http://localhost:5183').replace(/\/$/, ''),
  mercadoPagoPublicKey: import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '',
  gaMeasurementId: import.meta.env.VITE_GA_MEASUREMENT_ID || '',
  clarityProjectId: import.meta.env.VITE_CLARITY_PROJECT_ID || '',
  environment: import.meta.env.MODE || 'development',
  isDev: Boolean(import.meta.env.DEV ?? true),
  isProd: Boolean(import.meta.env.PROD ?? false),
});

export default env;
