/**
 * src/features/auth/hooks/useForgotPassword.ts
 *
 * Hook para solicitação e envio de link de recuperação de senha por e-mail.
 */

import { useState } from 'react';
import { authService } from '../services/authService';
import { getErrorMessage } from '@/utils/errors';

export interface UseForgotPasswordOptions {
  initialEmail?: string;
  onSuccess?: () => void;
}

export const useForgotPassword = (options: UseForgotPasswordOptions = {}) => {
  const [email, setEmail] = useState(options.initialEmail || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const resetState = () => {
    setIsSuccess(false);
    setError(null);
    setFieldError(null);
  };

  const validate = (): boolean => {
    if (!email.trim()) {
      setFieldError('Informe seu endereço de e-mail.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError('Informe um formato de e-mail válido.');
      return false;
    }
    setFieldError(null);
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setError(null);

    try {
      await authService.forgotPassword({ email: email.trim() });
      setIsSuccess(true);
      options.onSuccess?.();
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Falha ao solicitar recuperação de senha. Tente novamente mais tarde.');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email,
    setEmail,
    isLoading,
    error,
    isSuccess,
    fieldError,
    setFieldError,
    resetState,
    handleSubmit,
  };
};

export default useForgotPassword;
