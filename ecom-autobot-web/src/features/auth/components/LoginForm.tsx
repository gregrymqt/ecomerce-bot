import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Building, LogIn } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/display/Card';
import { Alert } from '@/components/ui/feedback/Alert';
import { FormField } from '@/components/ui/form/FormField';
import { cn } from '@/lib/utils';

export interface LoginFormProps {
  /** Callback acionado após o login efetuado com sucesso */
  onSuccess?: () => void;
  /** Callback para alternar a exibição para a tela/modo de Registro */
  onSwitchToRegister?: () => void;
  /** Classes CSS adicionais para o container principal */
  className?: string;
  /** Define se o formulário deve ser encapsulado no componente Card. Padrão: true */
  showCard?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onSwitchToRegister,
  className,
  showCard = true,
}) => {
  const { login, isLoading, error: authError } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    tenantId: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Limpa erro do campo alterado
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

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      await login({
        email: formData.email.trim(),
        password: formData.password,
        tenant_id: formData.tenantId.trim() || undefined,
      });
      onSuccess?.();
    } catch {
      // O erro é tratado e exposto pelo AuthContext no hook useAuth()
    }
  };

  const formContent = (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Header com Tipografia Moderna e Acessível */}
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
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
        />

        {/* Campo Senha */}
        <FormField
          label="Senha"
          name="password"
          type={showPassword ? 'text' : 'password'}
          required
          placeholder="••••••••"
          value={formData.password}
          onChange={handleChange}
          error={fieldErrors.password}
          iconLeft={<Lock className="w-5 h-5 shrink-0" />}
          iconRight={
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="flex items-center justify-center h-11 w-11 -mr-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg cursor-pointer"
              aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5 shrink-0" />
              ) : (
                <Eye className="w-5 h-5 shrink-0" />
              )}
            </button>
          }
          autoComplete="current-password"
          disabled={isLoading}
        />

        {/* Campo Tenant ID (Opcional) */}
        <FormField
          label="Identificador do Tenant (Opcional)"
          name="tenantId"
          type="text"
          placeholder="ex: minha-loja-01"
          value={formData.tenantId}
          onChange={handleChange}
          error={fieldErrors.tenantId}
          helperText="Informe o ID do tenant se possuir mais de uma organização"
          iconLeft={<Building className="w-5 h-5 shrink-0" />}
          autoComplete="organization"
          disabled={isLoading}
        />

        {/* Botão de Submissão com Estado de Loading */}
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isLoading}
          iconLeft={<LogIn className="w-5 h-5 shrink-0" />}
          className="w-full h-11 text-base font-semibold mt-2"
        >
          {isLoading ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>

      {/* Link de Navegação / Alternância para Registro */}
      {onSwitchToRegister && (
        <div className="text-center pt-2 border-t border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Ainda não tem uma conta?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              disabled={isLoading}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 hover:underline min-h-[44px] inline-flex items-center px-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md cursor-pointer disabled:opacity-50"
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
      <Card glass className={cn('p-6 sm:p-8 shadow-xl', className)}>
        {formContent}
      </Card>
    );
  }

  return <div className={className}>{formContent}</div>;
};
