/**
 * src/features/auth/services/authService.ts
 *
 * Serviço de comunicação HTTP com a Core API (.NET 9) para Autenticação.
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
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
    try {
      const response = await apiClient.post<UserResponse>('/api/v1/auth/login', credentials);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao autenticar usuário.'), { cause: error });
    }
  },

  /**
   * Cadastra um novo usuário na plataforma.
   */
  async register(payload: RegisterPayload): Promise<UserResponse> {
    try {
      const response = await apiClient.post<UserResponse>('/api/v1/auth/register', payload);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao cadastrar usuário.'), { cause: error });
    }
  },

  /**
   * Encerra a sessão revogando o token no Redis e limpando o cookie HttpOnly.
   */
  async logout(): Promise<LogoutResponse> {
    try {
      const response = await apiClient.post<LogoutResponse>('/api/v1/auth/logout');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao encerrar sessão.'), { cause: error });
    }
  },

  /**
   * Obtém os dados do perfil do usuário autenticado no token JWT atual.
   */
  async getMe(): Promise<AuthenticatedUser> {
    try {
      const response = await apiClient.get<AuthenticatedUser>('/api/v1/auth/me');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao obter perfil do usuário.'), { cause: error });
    }
  },

  /**
   * Atualiza as informações de perfil do usuário autenticado.
   */
  async updateMe(payload: UpdateUserPayload): Promise<UserResponse> {
    try {
      const response = await apiClient.put<UserResponse>('/api/v1/auth/me', payload);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao atualizar perfil do usuário.'), { cause: error });
    }
  },

  /**
   * Obtém a URL de consentimento do Google OAuth 2.0.
   */
  async getGoogleLoginUrl(state?: string): Promise<GoogleLoginUrlResponse> {
    try {
      const params = state ? { state } : {};
      const response = await apiClient.get<GoogleLoginUrlResponse>('/api/v1/auth/google/login', { params });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao obter URL de autenticação do Google.'), { cause: error });
    }
  },

  /**
   * Envia o código de autorização e recupera o token de acesso e tenants.
   */
  async googleCallback(payload: GoogleCallbackRequest): Promise<AuthTokenResponse> {
    try {
      const response = await apiClient.post<AuthTokenResponse>('/api/v1/auth/google/callback', payload);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao processar callback do Google.'), { cause: error });
    }
  },

  /**
   * Envia a solicitação de lead corporativo para o SSO Enterprise (Fake Door Test).
   */
  async submitEnterpriseLead(payload: EnterpriseLeadPayload): Promise<EnterpriseLeadResponse> {
    try {
      const response = await apiClient.post<EnterpriseLeadResponse>('/api/v1/auth/sso-enterprise/lead', payload);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao enviar solicitação de SSO corporativo.'), { cause: error });
    }
  },

  /**
   * Solicita o envio de link de recuperação de senha por e-mail.
   */
  async forgotPassword(payload: ForgotPasswordPayload): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('/api/v1/auth/forgot-password', payload);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao solicitar recuperação de senha.'), { cause: error });
    }
  },

  /**
   * Define uma nova senha a partir de um token de recuperação válido.
   */
  async resetPassword(payload: ResetPasswordPayload): Promise<ResetPasswordResponse> {
    try {
      const response = await apiClient.post<ResetPasswordResponse>('/api/v1/auth/reset-password', {
        token: payload.token,
        newPassword: payload.newPassword,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Falha ao redefinir senha.'), { cause: error });
    }
  },
};

export default authService;
