/**
 * src/features/auth/components/forms/RegisterForm.tsx
 *
 * Formulário acessível de Cadastro de Usuário e Criação de Loja/Tenant.
 */

import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, Building, UserPlus } from 'lucide-react';
import type { RegisterFormData } from '../../types/auth.types';
import { useAuth } from '../../hooks/useAuth';
import { GoogleAuthButton } from '../sso/GoogleAuthButton';
import { EnterpriseSsoButton } from '../sso/EnterpriseSsoButton';
import { EnterpriseSsoModal } from '../sso/EnterpriseSsoModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/display/Card';
import { Alert } from '@/components/ui/feedback/Alert';
import { FormField } from '@/components/ui/form/FormField';
import { cn } from '@/lib/utils';

export interface RegisterFormProps {
  /** Estado de carregamento simulado ou real */
  isLoading?: boolean;
  /** Visibilidade da senha */
  showPassword?: boolean;
  /** Handler para alternar visibilidade da senha */
  onTogglePassword?: () => void;
  /** Handler de submissão do formulário enviando RegisterFormData */
  onSubmit?: (data: RegisterFormData) => void;
  /** Callback alternativo para submissão direta */
  onRegister?: (data: RegisterFormData) => void;
  /** Callback acionado após o registro efetuado com sucesso (uso legado) */
  onSuccess?: () => void;
  /** Callback para alternar para a tela/modo de Login */
  onSwitchToLogin?: () => void;
  /** Classes CSS adicionais para o container principal */
  className?: string;
  /** Define se o formulário deve ser encapsulado no componente Card. Padrão: true */
  showCard?: boolean;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  isLoading: propsIsLoading,
  showPassword: propsShowPassword,
  onTogglePassword,
  onSubmit,
  onRegister,
  onSuccess,
  onSwitchToLogin,
  className,
  showCard = true,
}) => {
  const { register, isLoading: authIsLoading, error: authError } = useAuth();

  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    tenantName: '',
    password: '',
    confirmPassword: '',
  });

  const [internalShowPassword, setInternalShowPassword] = useState(false);
  const [internalShowConfirmPassword, setInternalShowConfirmPassword] = useState(false);
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

    if (!formData.name.trim()) {
      errors.name = 'O nome completo é obrigatório.';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'O nome deve possuir pelo menos 2 caracteres.';
    }

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

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'A confirmação de senha é obrigatória.';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'As senhas informadas não coincidem.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validate()) return;

    const payload: RegisterFormData = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      tenantName: formData.tenantName.trim(),
      password: formData.password,
      confirmPassword: formData.confirmPassword,
    };

    if (onSubmit) {
      onSubmit(payload);
    } else if (onRegister) {
      onRegister(payload);
    } else {
      try {
        await register({
          name: payload.name,
          email: payload.email,
          password: payload.password,
          tenants: payload.tenantName ? [payload.tenantName] : undefined,
        });
        onSuccess?.();
      } catch {
        // Tratado no AuthContext
      }
    }
  };

  const formContent = (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Criar Nova Conta
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          Junte-se à plataforma e automatize a gestão da sua loja online
        </p>
      </div>

      {/* Alerta de Erro de Cadastro */}
      {authError && (
        <Alert variant="error" title="Falha ao criar conta">
          {authError}
        </Alert>
      )}

      {/* Formulário Principal em Grid */}
      <form onSubmit={handleSubmitForm} noValidate className="space-y-4">
        {/* Linha 1: Nome e E-mail */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Nome Completo"
            name="name"
            type="text"
            required
            placeholder="Maria Silva"
            value={formData.name}
            onChange={handleChange}
            error={fieldErrors.name}
            iconLeft={<User className="w-5 h-5 shrink-0" />}
            autoComplete="name"
            disabled={isLoading}
            className="min-h-[44px] text-base bg-slate-900/50 border-slate-700/80 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />

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
        </div>

        {/* Linha 2: Nome da Loja */}
        <div className="w-full">
          <FormField
            label="Nome da Sua Loja"
            name="tenantName"
            type="text"
            placeholder="ex: Minha Loja Oficial"
            value={formData.tenantName}
            onChange={handleChange}
            error={fieldErrors.tenantName}
            helperText="Defina o nome da sua organização/tenant inicial"
            iconLeft={<Building className="w-5 h-5 shrink-0" />}
            disabled={isLoading}
            className="min-h-[44px] text-base bg-slate-900/50 border-slate-700/80 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* Linha 3: Senha e Confirmar Senha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            autoComplete="new-password"
            disabled={isLoading}
            className="min-h-[44px] text-base bg-slate-900/50 border-slate-700/80 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />

          <FormField
            label="Confirmar Senha"
            name="confirmPassword"
            type={internalShowConfirmPassword ? 'text' : 'password'}
            required
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChange={handleChange}
            error={fieldErrors.confirmPassword}
            iconLeft={<Lock className="w-5 h-5 shrink-0" />}
            iconRight={
              <button
                type="button"
                onClick={() => setInternalShowConfirmPassword((prev) => !prev)}
                className="flex items-center justify-center min-h-[44px] w-11 -mr-3 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg cursor-pointer"
                aria-label={internalShowConfirmPassword ? 'Ocultar confirmação' : 'Exibir confirmação'}
              >
                {internalShowConfirmPassword ? (
                  <EyeOff className="w-5 h-5 shrink-0" />
                ) : (
                  <Eye className="w-5 h-5 shrink-0" />
                )}
              </button>
            }
            autoComplete="new-password"
            disabled={isLoading}
            className="min-h-[44px] text-base bg-slate-900/50 border-slate-700/80 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* Botão Primário "Cadastrar" */}
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isLoading}
          iconLeft={<UserPlus className="w-5 h-5 shrink-0" />}
          className="w-full min-h-[44px] h-11 text-base font-semibold mt-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all focus:ring-2 focus:ring-indigo-500"
        >
          {isLoading ? 'Criando Conta...' : 'Cadastrar'}
        </Button>
      </form>

      {/* Divisor "OU" */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-slate-900 px-2 text-slate-400 font-medium">Ou cadastre-se com</span>
        </div>
      </div>

      {/* Botões de Cadastro Social e Enterprise */}
      <div className="space-y-3">
        <GoogleAuthButton
          text="Cadastrar com o Google"
          tenantName={formData.tenantName?.trim() || undefined}
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

      {/* Link de Alternância para Login */}
      {onSwitchToLogin && (
        <div className="text-center pt-4 border-t border-slate-800">
          <p className="text-sm text-slate-400">
            Já possui uma conta?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              disabled={isLoading}
              className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline min-h-[44px] inline-flex items-center px-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md cursor-pointer disabled:opacity-50"
            >
              Fazer Login
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

export default RegisterForm;
