/**
 * src/features/auth/types/auth.types.ts
 *
 * Contratos de tipos para a feature de Autenticação e Multi-Tenancy.
 * Alinhado com a Core API (.NET 9).
 * Camada 1: Contratos e Interfaces Canônicas.
 */

// --- RESPOSTAS DA API ---

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  tenants: string[];
  created_at?: string;
  plan?: string;
  is_admin?: boolean;
  role?: string;
}

export interface AuthenticatedUser {
  sub?: string;
  user_id?: string;
  email: string;
  name: string;
  tenants: string[];
  plan: string;
  is_admin?: boolean;
  role?: string;
}

export interface LogoutResponse {
  message: string;
}

export interface GoogleLoginUrlResponse {
  url: string;
}

export interface GoogleCallbackRequest {
  code: string;
  state?: string;
  tenant_name?: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  name: string;
  tenants: string[];
  tenant_id?: string;
}

export interface EnterpriseLeadPayload {
  email: string;
  company_name: string;
  team_size?: string;
  phone?: string;
  notes?: string;
}

export interface EnterpriseLeadResponse {
  id: string;
  email: string;
  company_name: string;
  message: string;
  created_at?: string;
}

// --- PAYLOADS DE REQUISIÇÃO (HTTP REQUESTS) ---

export interface LoginCredentials {
  email: string;
  password: string;
  tenant_id?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  tenants?: string[];
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  ad_id?: string;
}

export interface UpdateUserPayload {
  name?: string;
  password?: string;
  tenants?: string[];
}

// --- ESTADO REATIVO DO REACT / FRONTEND ---

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  user: AuthenticatedUser | UserResponse | null;
  currentTenant: string | null;
  status: AuthStatus;
  isLoading: boolean;
  error: string | null;
}

// --- FORMULÁRIOS & MODOS DE AUTENTICAÇÃO ---

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
