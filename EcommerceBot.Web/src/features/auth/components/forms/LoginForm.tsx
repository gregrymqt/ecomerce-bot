/**
 * src/features/auth/components/forms/LoginForm.tsx
 *
 * Formulário acessível de Login de Usuário.
 */

import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Building, LogIn } from 'lucide-react';
import type { LoginFormData } from '../../types/auth.types';
import { useAuth } from '../../hooks/useAuth';
import { GoogleAuthButton } from '../sso/GoogleAuthButton';
import { EnterpriseSsoButton } from '../sso/EnterpriseSsoButton';
import { EnterpriseSsoModal } from '../sso/EnterpriseSsoModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/display/Card';
import { Alert } from '@/components/ui/feedback/Alert';
import { FormField } from '@/components/ui/form/FormField';
import { cn } from '@/lib/utils';

export interface LoginFormProps {
  /** Estado de carregamento simulado ou real */
  isLoading?: boolean;
  /** Visibilidade da senha (opcional se fornecido pelo hook pai) */
  showPassword?: boolean;
  /** Handler para alternar visibilidade da senha */
  onTogglePassword?: () => void;
  /** Handler de submissão do formulário enviando LoginFormData */
  onSubmit?: (data: LoginFormData) => void;
  /** Callback alternativo para submissão direta */
  onLogin?: (data: LoginFormData) => void;
  /** Callback acionado após o login efetuado com sucesso (uso legado) */
  onSuccess?: () => void;
  /** Callback para alternar para a tela/modo de Registro */
  onSwitchToRegister?: () => void;
  /** Classes CSS adicionais para o container principal */
  className?: string;
  /** Define se o formulário deve ser encapsulado no componente Card. Padrão: true */
  showCard?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  isLoading: propsIsLoading,
  showPassword: propsShowPassword,
  onTogglePassword,
  onSubmit,
  onLogin,
  onSuccess,
  onSwitchToRegister,
  className,
  showCard = true,
}) => {
  const { login, isLoading: authIsLoading, error: authError } = useAuth();

  const [formData, setFormData] = useState<LoginFormData>({
    tenant: '',
    email: '',
    password: '',
  });

  const [internalShowPassword, setInternalShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSsoModalOpen, setIsSsoModalOpen] = useState(false);

  const isLoading = propsIsLoading ?? authIsLoading;
  const isPasswordVisible = propsShowPassword ?? internalShowPassword;

  const handleTogglePassword = () => {
    if (onTogglePassword) {
      onTogglePassword();
    } else {
      setInternalShowPassword((prev) => !prev);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      errors.email = 'O e-mail é obrigatório.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Informe um endereço de e-mail válido.';
    }

    if (!formData.password) {
      errors.password = 'A senha é obrigatória.';
    } else if (formData.password.length < 6) {
      errors.password = 'A senha deve conter no mínimo 6 caracteres.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validate()) return;

    const payload: LoginFormData = {
      tenant: formData.tenant?.trim() || undefined,
      email: formData.email.trim(),
      password: formData.password,
    };

    if (onSubmit) {
      onSubmit(payload);
    } else if (onLogin) {
      onLogin(payload);
    } else {
      try {
        await login({
          email: payload.email,
          password: payload.password,
          tenant_id: payload.tenant,
        });
        onSuccess?.();
      } catch {
        // Tratado no AuthContext
      }
    }
  };

  const formContent = (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Entrar na Conta
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          Acesse o painel do E-commerce Bot para gerenciar seus produtos
        </p>
      </div>

      {/* Alerta de Erro de Autenticação */}
      {authError && (
        <Alert variant="error" title="Falha ao autenticar">
          {authError}
        </Alert>
      )}

      {/* Formulário Principal */}
      <form onSubmit={handleSubmitForm} noValidate className="space-y-4">
        {/* Campo ID da Loja / Tenant */}
        <FormField
          label="ID da Loja (Opcional)"
          name="tenant"
          type="text"
          placeholder="ex: minha-loja-01"
          value={formData.tenant || ''}
          onChange={handleChange}
          error={fieldErrors.tenant}
          helperText="Informe o ID do tenant se possuir mais de uma organização"
          iconLeft={<Building className="w-5 h-5 shrink-0" />}
          autoComplete="organization"
          disabled={isLoading}
          className="min-h-[44px] text-base bg-slate-900/50 border-slate-700/80 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />

        {/* Campo E-mail */}
        <FormField
          label="E-mail"
          name="email"
          type="email"
          required
          placeholder="seu.email@empresa.com"
          value={formData.email}
          onChange={handleChange}
          error={fieldErrors.email}
          iconLeft={<Mail className="w-5 h-5 shrink-0" />}
          autoComplete="email"
          disabled={isLoading}
          className="min-h-[44px] text-base bg-slate-900/50 border-slate-700/80 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />

        {/* Campo Senha */}
        <div className="space-y-1">
          <FormField
            label="Senha"
            name="password"
            type={isPasswordVisible ? 'text' : 'password'}
            required
            placeholder="••••••••"
            value={formData.password}
            onChange={handleChange}
            error={fieldErrors.password}
            iconLeft={<Lock className="w-5 h-5 shrink-0" />}
            iconRight={
              <button
                type="button"
                onClick={handleTogglePassword}
                className="flex items-center justify-center min-h-[44px] w-11 -mr-3 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg cursor-pointer"
                aria-label={isPasswordVisible ? 'Ocultar senha' : 'Exibir senha'}
              >
                {isPasswordVisible ? (
                  <EyeOff className="w-5 h-5 shrink-0" />
                ) : (
                  <Eye className="w-5 h-5 shrink-0" />
                )}
              </button>
            }
            autoComplete="current-password"
            disabled={isLoading}
            className="min-h-[44px] text-base bg-slate-900/50 border-slate-700/80 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />

          <div className="flex justify-end pt-1">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
              }}
              className="text-xs sm:text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:underline min-h-[44px] inline-flex items-center focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md"
            >
              Esqueceu a senha?
            </a>
          </div>
        </div>

        {/* Botão Primário "Entrar" */}
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isLoading}
          iconLeft={<LogIn className="w-5 h-5 shrink-0" />}
          className="w-full min-h-[44px] h-11 text-base font-semibold mt-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all focus:ring-2 focus:ring-indigo-500"
        >
          {isLoading ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>

      {/* Divisor "OU" */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-slate-900 px-2 text-slate-400 font-medium">Ou continue com</span>
        </div>
      </div>

      {/* Botões de Login Social e Enterprise */}
      <div className="space-y-3">
        <GoogleAuthButton
          text="Entrar com o Google"
          tenantName={formData.tenant?.trim() || undefined}
          disabled={isLoading}
        />
        <EnterpriseSsoButton
          text="SSO Enterprise (Okta / SAML)"
          onClick={() => setIsSsoModalOpen(true)}
          disabled={isLoading}
        />
      </div>

      {/* Modal SSO Enterprise */}
      <EnterpriseSsoModal
        isOpen={isSsoModalOpen}
        onClose={() => setIsSsoModalOpen(false)}
        initialEmail={formData.email}
      />

      {/* Link de Alternância para Cadastro */}
      {onSwitchToRegister && (
        <div className="text-center pt-4 border-t border-slate-800">
          <p className="text-sm text-slate-400">
            Ainda não tem uma conta?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              disabled={isLoading}
              className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline min-h-[44px] inline-flex items-center px-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md cursor-pointer disabled:opacity-50"
            >
              Criar conta agora
            </button>
          </p>
        </div>
      )}
    </div>
  );

  if (showCard) {
    return (
      <Card glass className={cn('p-6 sm:p-8 shadow-xl bg-slate-900/60 border-slate-800/80', className)}>
        {formContent}
      </Card>
    );
  }

  return <div className={className}>{formContent}</div>;
};

export default LoginForm;
