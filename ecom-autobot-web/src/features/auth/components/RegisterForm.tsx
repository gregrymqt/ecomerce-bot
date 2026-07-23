import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, Building, UserPlus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/display/Card';
import { Alert } from '@/components/ui/feedback/Alert';
import { FormField } from '@/components/ui/form/FormField';
import { cn } from '@/lib/utils';

export interface RegisterFormProps {
  /** Callback acionado após o registro efetuado com sucesso */
  onSuccess?: () => void;
  /** Callback para alternar a exibição para a tela/modo de Login */
  onSwitchToLogin?: () => void;
  /** Classes CSS adicionais para o container principal */
  className?: string;
  /** Define se o formulário deve ser encapsulado no componente Card. Padrão: true */
  showCard?: boolean;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onSwitchToLogin,
  className,
  showCard = true,
}) => {
  const { register, isLoading, error: authError } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    tenantName: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        tenants: formData.tenantName.trim() ? [formData.tenantName.trim()] : undefined,
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
          Criar Nova Conta
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          Junte-se à plataforma e automatize o gerenciamento do seu e-commerce
        </p>
      </div>

      {/* Alerta de Erro de Cadastro */}
      {authError && (
        <Alert variant="error" title="Falha ao criar conta">
          {authError}
        </Alert>
      )}

      {/* Formulário Principal */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Campo Nome Completo */}
        <FormField
          label="Nome Completo"
          name="name"
          type="text"
          required
          placeholder="ex: Maria Silva"
          value={formData.name}
          onChange={handleChange}
          error={fieldErrors.name}
          iconLeft={<User className="w-5 h-5 shrink-0" />}
          autoComplete="name"
          disabled={isLoading}
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
          helperText="Mínimo de 6 caracteres"
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
          autoComplete="new-password"
          disabled={isLoading}
        />

        {/* Campo Confirmar Senha */}
        <FormField
          label="Confirmar Senha"
          name="confirmPassword"
          type={showConfirmPassword ? 'text' : 'password'}
          required
          placeholder="••••••••"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={fieldErrors.confirmPassword}
          iconLeft={<Lock className="w-5 h-5 shrink-0" />}
          iconRight={
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="flex items-center justify-center h-11 w-11 -mr-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg cursor-pointer"
              aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Exibir confirmação de senha'}
            >
              {showConfirmPassword ? (
                <EyeOff className="w-5 h-5 shrink-0" />
              ) : (
                <Eye className="w-5 h-5 shrink-0" />
              )}
            </button>
          }
          autoComplete="new-password"
          disabled={isLoading}
        />

        {/* Campo Nome da Loja / Tenant (Opcional) */}
        <FormField
          label="Nome da Sua Loja / Tenant (Opcional)"
          name="tenantName"
          type="text"
          placeholder="ex: minha-loja-oficial"
          value={formData.tenantName}
          onChange={handleChange}
          error={fieldErrors.tenantName}
          helperText="Será criado o tenant inicial para organização do seu catálogo"
          iconLeft={<Building className="w-5 h-5 shrink-0" />}
          disabled={isLoading}
        />

        {/* Botão de Submissão com Estado de Loading */}
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isLoading}
          iconLeft={<UserPlus className="w-5 h-5 shrink-0" />}
          className="w-full h-11 text-base font-semibold mt-2"
        >
          {isLoading ? 'Criando Conta...' : 'Cadastrar'}
        </Button>
      </form>

      {/* Link de Navegação / Alternância para Login */}
      {onSwitchToLogin && (
        <div className="text-center pt-2 border-t border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Já possui uma conta?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              disabled={isLoading}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 hover:underline min-h-[44px] inline-flex items-center px-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md cursor-pointer disabled:opacity-50"
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
      <Card glass className={cn('p-6 sm:p-8 shadow-xl', className)}>
        {formContent}
      </Card>
    );
  }

  return <div className={className}>{formContent}</div>;
};
