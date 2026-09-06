/**
 * src/features/auth/hooks/useEnterpriseLead.ts
 *
 * Hook para submissão de solicitação de SSO Enterprise e gestão de leads corporativos.
 */

import { useState } from 'react';
import { authService } from '../services/authService';
import type { EnterpriseLeadPayload } from '../types/auth.types';
import { getErrorMessage } from '@/utils/errors';

export interface UseEnterpriseLeadOptions {
  initialEmail?: string;
  onClose?: () => void;
}

export const useEnterpriseLead = (options: UseEnterpriseLeadOptions = {}) => {
  const [formData, setFormData] = useState<EnterpriseLeadPayload>({
    email: options.initialEmail || '',
    company_name: '',
    team_size: '11-50 colaboradores',
    phone: '',
    notes: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = 'O e-mail corporativo é obrigatório.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Informe um e-mail válido.';
    }

    if (!formData.company_name.trim()) {
      errors.company_name = 'O nome da empresa é obrigatório.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setError(null);

    try {
      await authService.submitEnterpriseLead({
        email: formData.email.trim(),
        company_name: formData.company_name.trim(),
        team_size: formData.team_size?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
      });

      setIsSuccess(true);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao enviar solicitação corporativa.');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setError(null);
    setFieldErrors({});
    setFormData({
      email: options.initialEmail || '',
      company_name: '',
      team_size: '11-50 colaboradores',
      phone: '',
      notes: '',
    });
    options.onClose?.();
  };

  return {
    formData,
    isLoading,
    error,
    isSuccess,
    fieldErrors,
    handleChange,
    handleSubmit,
    handleClose,
  };
};

export default useEnterpriseLead;
