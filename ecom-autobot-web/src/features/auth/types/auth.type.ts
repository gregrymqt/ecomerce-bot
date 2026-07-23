/**
 * src/features/auth/types.ts
 * Contratos de tipos para a feature de Autenticação e Multi-Tenancy.
 * Alinhado estritamente com os Schemas Pydantic da API FastAPI.
 */

// --- RESPOSTAS DA API ---

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  tenants: string[];
  created_at?: string;
}

export interface AuthenticatedUser {
  sub?: string;
  user_id?: string;
  email: string;
  name: string;
  tenants: string[];
  plan: string;
}

export interface LogoutResponse {
  message: string;
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
