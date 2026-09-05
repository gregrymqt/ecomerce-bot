/**
 * src/features/auth/services/authService.ts
 *
 * Serviço de comunicação HTTP com a Core API (.NET 9) para Autenticação.
 */

import { apiClient } from '@/lib/apiClient';
import type {
  LoginCredentials,
  RegisterPayload,
  UpdateUserPayload,
  UserResponse,
  AuthenticatedUser,
  LogoutResponse,
  GoogleLoginUrlResponse,
  GoogleCallbackRequest,
  AuthTokenResponse,
  EnterpriseLeadPayload,
  EnterpriseLeadResponse,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  ResetPasswordResponse,
} from '../types/auth.types';

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

  /**
   * Obtém a URL de consentimento do Google OAuth 2.0.
   */
  async getGoogleLoginUrl(state?: string): Promise<GoogleLoginUrlResponse> {
    const params = state ? { state } : {};
    const response = await apiClient.get<GoogleLoginUrlResponse>('/api/v1/auth/google/login', { params });
    return response.data;
  },

  /**
   * Envia o código de autorização e recupera o token de acesso e tenants.
   */
  async googleCallback(payload: GoogleCallbackRequest): Promise<AuthTokenResponse> {
    const response = await apiClient.post<AuthTokenResponse>('/api/v1/auth/google/callback', payload);
    return response.data;
  },

  /**
   * Envia a solicitação de lead corporativo para o SSO Enterprise (Fake Door Test).
   */
  async submitEnterpriseLead(payload: EnterpriseLeadPayload): Promise<EnterpriseLeadResponse> {
    const response = await apiClient.post<EnterpriseLeadResponse>('/api/v1/auth/sso-enterprise/lead', payload);
    return response.data;
  },

  /**
   * Solicita o envio de link de recuperação de senha por e-mail.
   */
  async forgotPassword(payload: ForgotPasswordPayload): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/api/v1/auth/forgot-password', payload);
    return response.data;
  },

  /**
   * Define uma nova senha a partir de um token de recuperação válido.
   */
  async resetPassword(payload: ResetPasswordPayload): Promise<ResetPasswordResponse> {
    const response = await apiClient.post<ResetPasswordResponse>('/api/v1/auth/reset-password', {
      token: payload.token,
      newPassword: payload.newPassword,
    });
    return response.data;
  },
};

export default authService;
