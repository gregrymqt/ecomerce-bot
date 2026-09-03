import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import type { AuthMode, LoginFormData, RegisterFormData } from '../types/auth.types';
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
 * Integra a UI local com as funções de autenticação do AuthContext.
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
        const isAdmin = userResp?.is_admin === true || userResp?.role?.toUpperCase() === 'ADMIN';
        const isPaidUser = plan === 'pro' || plan === 'enterprise';

        if (isAdmin) {
          navigate('/admin/leads');
        } else if (isPaidUser) {
          navigate('/dashboard');
        } else {
          navigate('/demo');
        }
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
        const storedUtms =
          typeof window !== 'undefined'
            ? JSON.parse(localStorage.getItem('_saas_utm_attribution') || '{}')
            : {};
        const userResp = await register({
          name: data.name,
          email: data.email,
          password: data.password,
          tenants: data.tenantName?.trim() ? [data.tenantName.trim()] : undefined,
          utm_source: storedUtms.utm_source,
          utm_medium: storedUtms.utm_medium,
          utm_campaign: storedUtms.utm_campaign,
          ad_id: storedUtms.ad_id,
        });
        const plan = userResp?.plan?.toLowerCase() || 'free';
        const isAdmin = userResp?.is_admin === true || userResp?.role?.toUpperCase() === 'ADMIN';
        const isPaidUser = plan === 'pro' || plan === 'enterprise';

        if (isAdmin) {
          navigate('/admin/leads');
        } else if (isPaidUser) {
          navigate('/dashboard');
        } else {
          navigate('/demo');
        }
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

export default useAuthForm;
