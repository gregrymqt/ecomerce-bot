import { apiClient } from '@/lib/apiClient';
import type {
  LoginCredentials,
  RegisterPayload,
  UpdateUserPayload,
  UserResponse,
  AuthenticatedUser,
  LogoutResponse,
} from '../types/auth.type';

/**
 * Serviço de comunicação HTTP com a API FastAPI de Autenticação.
 */
export const authService = {
  /**
   * Realiza login do usuário e estabelece o cookie JWT de sessão.
   */
  async login(credentials: LoginCredentials): Promise<UserResponse> {
    const response = await apiClient.post<UserResponse>('/api/v1/auth/login', credentials);
    return response.data;
  },

  /**
   * Cadastra um novo usuário na plataforma.
   */
  async register(payload: RegisterPayload): Promise<UserResponse> {
    const response = await apiClient.post<UserResponse>('/api/v1/auth/register', payload);
    return response.data;
  },

  /**
   * Encerra a sessão revogando o token no Redis e limpando o cookie HttpOnly.
   */
  async logout(): Promise<LogoutResponse> {
    const response = await apiClient.post<LogoutResponse>('/api/v1/auth/logout');
    return response.data;
  },

  /**
   * Obtém os dados do perfil do usuário autenticado no token JWT atual.
   */
  async getMe(): Promise<AuthenticatedUser> {
    const response = await apiClient.get<AuthenticatedUser>('/api/v1/auth/me');
    return response.data;
  },

  /**
   * Atualiza as informações de perfil do usuário autenticado.
   */
  async updateMe(payload: UpdateUserPayload): Promise<UserResponse> {
    const response = await apiClient.put<UserResponse>('/api/v1/auth/me', payload);
    return response.data;
  },
};
