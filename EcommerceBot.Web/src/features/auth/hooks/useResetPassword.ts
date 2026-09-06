/**
 * src/features/auth/hooks/useResetPassword.ts
 *
 * Hook para redefinição de senha com token de validação (?token=...).
 */

import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { getErrorMessage } from '@/utils/errors';

export const useResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token')?.trim() || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [resetEmail, setResetEmail] = useState<string>('');

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!newPassword) {
      errors.newPassword = 'A nova senha é obrigatória.';
    } else if (newPassword.length < 6) {
      errors.newPassword = 'A senha deve conter no mínimo 6 caracteres.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirme sua nova senha.';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'As senhas informadas não conferem.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!token) return;
    if (!validate()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.resetPassword({
        token,
        newPassword,
      });

      setIsSuccess(true);
      if (response.email) {
        setResetEmail(response.email);
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Token inválido ou expirado. Solicite uma nova recuperação.');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToLogin = () => {
    const query = resetEmail ? `?email=${encodeURIComponent(resetEmail)}&reset=success` : '?reset=success';
    navigate(`/auth${query}`);
  };

  return {
    token,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    isLoading,
    error,
    fieldErrors,
    setFieldErrors,
    isSuccess,
    resetEmail,
    handleSubmit,
    handleGoToLogin,
  };
};

export default useResetPassword;
