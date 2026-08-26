import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import type { AuthMode, LoginFormData, RegisterFormData } from '@/features/auth';
import { getErrorMessage } from '@/utils/errors';

export interface UseAuthFormReturn {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  showPassword: boolean;
  togglePasswordVisibility: () => void;
  isLoading: boolean;
  error: string | null;
  handleLogin: (data: LoginFormData) => Promise<void>;
  handleRegister: (data: RegisterFormData) => Promise<void>;
  logout: () => Promise<void>;
  user: ReturnType<typeof useAuth>['user'];
  isAuthenticated: boolean;
}

/**
 * Custom hook para gerenciamento dos formulários de login e cadastro.
 * Integra a UI local (alternância de abas e visibilidade de senha) com as funções
 * reais de autenticação do AuthContext (login, registro e redirecionamento).
 */
export function useAuthForm(initialMode: AuthMode = 'login'): UseAuthFormReturn {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [localLoading, setLocalLoading] = useState<boolean>(false);

  const navigate = useNavigate();
  const { login, register, logout, user, isAuthenticated, isLoading: authLoading, error } = useAuth();

  const isLoading = localLoading || authLoading;

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleLogin = useCallback(
    async (data: LoginFormData): Promise<void> => {
      setLocalLoading(true);
      try {
        const userResp = await login({
          email: data.email,
          password: data.password,
          tenant_id: data.tenant?.trim() || undefined,
        });
        const plan = userResp?.plan?.toLowerCase() || 'free';
        const isAdmin = userResp?.is_admin === true || userResp?.role === 'admin';
        const isPaidUser = isAdmin || plan === 'pro' || plan === 'enterprise';
        navigate(isPaidUser ? '/catalog' : '/demo');
      } catch (err) {
        getErrorMessage(err);
      } finally {
        setLocalLoading(false);
      }
    },
    [login, navigate]
  );

  const handleRegister = useCallback(
    async (data: RegisterFormData): Promise<void> => {
      setLocalLoading(true);
      try {
        const userResp = await register({
          name: data.name,
          email: data.email,
          password: data.password,
          tenants: data.tenantName?.trim() ? [data.tenantName.trim()] : undefined,
        });
        const plan = userResp?.plan?.toLowerCase() || 'free';
        const isAdmin = userResp?.is_admin === true || userResp?.role === 'admin';
        const isPaidUser = isAdmin || plan === 'pro' || plan === 'enterprise';
        navigate(isPaidUser ? '/catalog' : '/demo');
      } catch (err) {
        getErrorMessage(err);
      } finally {
        setLocalLoading(false);
      }
    },
    [register, navigate]
  );

  return {
    mode,
    setMode,
    showPassword,
    togglePasswordVisibility,
    isLoading,
    error,
    handleLogin,
    handleRegister,
    logout,
    user,
    isAuthenticated,
  };
}
