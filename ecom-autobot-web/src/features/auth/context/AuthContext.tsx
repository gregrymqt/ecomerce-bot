import React, { createContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { getTenantId, saveTenantId, clearTenantId } from '../utils/storage';
import type {
  AuthenticatedUser,
  UserResponse,
  LoginCredentials,
  RegisterPayload,
  UpdateUserPayload,
  AuthStatus,
  AuthState,
} from '../types/auth.type';

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: UpdateUserPayload) => Promise<void>;
  switchTenant: (tenantId: string) => void;
  checkAuth: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | UserResponse | null>(null);
  const [currentTenant, setCurrentTenant] = useState<string | null>(getTenantId() || null);
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Resolve o tenant ativo combinando as permissões do usuário,
   * a solicitação atual e o tenant previamente persistido no localStorage.
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
      setUser(null);
      setStatus('unauthenticated');
      setCurrentTenant(null);
    } finally {
      setIsLoading(false);
    }
  }, [resolveTenant]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  /**
   * Realiza login e armazena tenant ativo.
   */
  const login = async (credentials: LoginCredentials) => {
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
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = apiError.response?.data?.detail || apiError.message || 'Erro ao realizar login';
      setError(msg);
      setStatus('unauthenticated');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Registra um novo usuário.
   */
  const register = async (payload: RegisterPayload) => {
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
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = apiError.response?.data?.detail || apiError.message || 'Erro ao realizar cadastro';
      setError(msg);
      setStatus('unauthenticated');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Realiza logout do usuário e limpa as credenciais locais.
   */
  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } catch (err) {
      console.warn('Erro ao efetuar logout no backend:', err);
    } finally {
      setUser(null);
      setCurrentTenant(null);
      setStatus('unauthenticated');
      clearTenantId();
      setIsLoading(false);
    }
  };

  /**
   * Atualiza as informações do perfil do usuário.
   */
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
      const apiError = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = apiError.response?.data?.detail || apiError.message || 'Erro ao atualizar perfil';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Altera o tenant ativo para o envio no cabeçalho X-Tenant-ID.
   */
  const switchTenant = (tenantId: string) => {
    if (user?.tenants?.includes(tenantId)) {
      setCurrentTenant(tenantId);
      saveTenantId(tenantId);
    } else {
      console.warn(`Tenant "${tenantId}" não pertence aos tenants do usuário.`);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
