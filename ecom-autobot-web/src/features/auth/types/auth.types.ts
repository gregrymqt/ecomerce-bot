/**
 * src/features/auth/types/auth.types.ts
 * Tipos específicos para controle de formulário e modos de exibição de Autenticação.
 */

export type AuthMode = 'login' | 'register';

export interface LoginFormData {
  tenant?: string;
  email: string;
  password: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  tenantName: string;
  password: string;
  confirmPassword: string;
}
