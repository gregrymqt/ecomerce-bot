/**
 * src/features/auth/context/AuthContext.tsx
 *
 * Contexto e Provider de Autenticação, Gerenciamento de Sessão JWT e Multi-Tenancy.
 */

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { getTenantId, saveTenantId, clearTenantId } from '@/utils/storage';
import { getErrorMessage } from '@/utils/errors';
import type {
  AuthenticatedUser,
  UserResponse,
  LoginCredentials,
  RegisterPayload,
  UpdateUserPayload,
  AuthStatus,
  AuthState,
  GoogleCallbackRequest,
  AuthTokenResponse,
} from '../types/auth.types';

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<UserResponse>;
  register: (payload: RegisterPayload) => Promise<UserResponse>;
  logout: () => Promise<void>;
  updateProfile: (payload: UpdateUserPayload) => Promise<void>;
  switchTenant: (tenantId: string) => void;
  checkAuth: () => Promise<void>;
  initiateGoogleLogin: (tenantName?: string) => Promise<void>;
  loginWithGoogleCallback: (payload: GoogleCallbackRequest) => Promise<AuthTokenResponse>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | UserResponse | null>(null);
  const [currentTenant, setCurrentTenant] = useState<string | null>(getTenantId() || null);
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Reseta todo o estado de autenticação em caso de expiração ou logout.
   */
  const resetAuthState = useCallback(() => {
    setUser(null);
    setCurrentTenant(null);
    setStatus('unauthenticated');
    clearTenantId();
  }, []);

  /**
   * Resolve o tenant ativo combinando as permissões do usuário.
   */
  const resolveTenant = useCallback((userTenants?: string[], requestedTenant?: string | null) => {
    if (requestedTenant && userTenants?.includes(requestedTenant)) {
      return requestedTenant;
    }
    const stored = getTenantId();
    if (stored && userTenants?.includes(stored)) {
      return stored;
    }
    if (userTenants && userTenants.length > 0) {
      return userTenants[0];
    }
    return null;
  }, []);

  /**
   * Verifica a sessão ativa do usuário junto ao endpoint GET /api/v1/auth/me.
   */
  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    setStatus('loading');
    setError(null);
    try {
      const userData = await authService.getMe();
      setUser(userData);
      setStatus('authenticated');
      const activeTenant = resolveTenant(userData.tenants);
      if (activeTenant) {
        setCurrentTenant(activeTenant);
        saveTenantId(activeTenant);
      }
    } catch {
      resetAuthState();
    } finally {
      setIsLoading(false);
    }
  }, [resolveTenant, resetAuthState]);

  // Escuta evento global de 401/403 do apiClient
  useEffect(() => {
    const handleUnauthorized = () => {
      resetAuthState();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [resetAuthState]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (credentials: LoginCredentials): Promise<UserResponse> => {
    setIsLoading(true);
    setStatus('loading');
    setError(null);
    try {
      const userResp = await authService.login(credentials);
      setUser(userResp);
      setStatus('authenticated');

      const activeTenant = resolveTenant(userResp.tenants, credentials.tenant_id);
      if (activeTenant) {
        setCurrentTenant(activeTenant);
        saveTenantId(activeTenant);
      }
      return userResp;
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao realizar login');
      setError(msg);
      setStatus('unauthenticated');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload): Promise<UserResponse> => {
    setIsLoading(true);
    setStatus('loading');
    setError(null);
    try {
      const userResp = await authService.register(payload);
      setUser(userResp);
      setStatus('authenticated');

      const activeTenant = resolveTenant(userResp.tenants);
      if (activeTenant) {
        setCurrentTenant(activeTenant);
        saveTenantId(activeTenant);
      }
      return userResp;
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao realizar cadastro');
      setError(msg);
      setStatus('unauthenticated');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } catch (err) {
      console.warn('Erro ao efetuar logout no backend:', err);
    } finally {
      resetAuthState();
      setIsLoading(false);
    }
  };

  const updateProfile = async (payload: UpdateUserPayload) => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedUser = await authService.updateMe(payload);
      setUser(updatedUser);
      if (updatedUser.tenants) {
        const activeTenant = resolveTenant(updatedUser.tenants);
        if (activeTenant) {
          setCurrentTenant(activeTenant);
          saveTenantId(activeTenant);
        }
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao atualizar perfil');
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const switchTenant = (tenantId: string) => {
    if (user?.tenants?.includes(tenantId)) {
      setCurrentTenant(tenantId);
      saveTenantId(tenantId);
    } else {
      console.warn(`Tenant "${tenantId}" não pertence aos tenants do usuário.`);
    }
  };

  const initiateGoogleLogin = async (tenantName?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      if (tenantName && tenantName.trim()) {
        sessionStorage.setItem('google_oauth_tenant_name', tenantName.trim());
      }
      const data = await authService.getGoogleLoginUrl();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao iniciar autenticação com o Google');
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogleCallback = async (payload: GoogleCallbackRequest): Promise<AuthTokenResponse> => {
    setIsLoading(true);
    setStatus('loading');
    setError(null);
    try {
      const tokenResp = await authService.googleCallback(payload);
      setUser({
        sub: tokenResp.user_id,
        user_id: tokenResp.user_id,
        email: tokenResp.email,
        name: tokenResp.name,
        tenants: tokenResp.tenants,
        plan: 'free',
      });
      setStatus('authenticated');

      const activeTenant = resolveTenant(tokenResp.tenants, tokenResp.tenant_id);
      if (activeTenant) {
        setCurrentTenant(activeTenant);
        saveTenantId(activeTenant);
      }
      return tokenResp;
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro no processamento da autenticação Google');
      setError(msg);
      setStatus('unauthenticated');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentTenant,
        status,
        isLoading,
        error,
        login,
        register,
        logout,
        updateProfile,
        switchTenant,
        checkAuth,
        initiateGoogleLogin,
        loginWithGoogleCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;