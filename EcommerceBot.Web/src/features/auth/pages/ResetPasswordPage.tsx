/**
 * src/features/auth/pages/ResetPasswordPage.tsx
 *
 * Página de Redefinição de Senha para usuários vindos do link de e-mail (?token=...).
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react';
import { AuthLeftPanel } from '../components/layout/AuthLeftPanel';
import { useResetPassword } from '../hooks/useResetPassword';
import { SEO } from '@/components/common/SEO';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback/Alert';
import { FormField } from '@/components/ui/form/FormField';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const {
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
    handleSubmit,
    handleGoToLogin,
  } = useResetPassword();

  return (
    <main className="flex min-h-screen w-full relative overflow-hidden bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      <SEO
        title="Redefinir Senha — E-commerce Bot"
        description="Escolha uma nova senha segura para restaurar seu acesso ao E-commerce Bot."
      />

      {/* 1. Painel Esquerdo de Branding */}
      <AuthLeftPanel />

      {/* 2. Container Direito de Formulário */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 overflow-y-auto relative z-10">
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            background: 'radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.2) 0%, transparent 50%)',
          }}
        />

        <div className="w-full max-w-lg bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-20 space-y-6">
          {/* Caso 1: Token Ausente na URL */}
          {!token ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-8 h-8 shrink-0" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
                  Link Inválido ou Incompleto
                </h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  O link de recuperação acessado não possui o código de segurança obrigatório. Verifique se o link copiado do e-mail está completo.
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => navigate('/auth')}
                iconLeft={<ArrowLeft className="w-4 h-4 shrink-0" />}
                className="w-full min-h-[44px] text-base font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg mt-2"
              >
                Voltar para o Login
              </Button>
            </div>
          ) : isSuccess ? (
            /* Caso 2: Senha Redefinida com Sucesso */
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle className="w-8 h-8 shrink-0" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
                  Senha Atualizada com Sucesso!
                </h2>
                <p className="text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Sua nova senha foi salva. Agora você já pode entrar na sua conta com as novas credenciais.
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleGoToLogin}
                iconRight={<ArrowRight className="w-4 h-4 shrink-0" />}
                className="w-full min-h-[44px] text-base font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg mt-2"
              >
                Acessar Minha Conta
              </Button>
            </div>
          ) : (
            /* Caso 3: Formulário de Nova Senha */
            <>
              <div className="text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
                  Criar Nova Senha
                </h2>
                <p className="text-sm sm:text-base text-slate-400">
                  Defina uma senha forte de no mínimo 6 caracteres para proteger sua conta.
                </p>
              </div>

              {error && (
                <Alert variant="error" title="Falha ao redefinir">
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Campo Nova Senha */}
                <FormField
                  label="Nova Senha"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Mínimo de 6 caracteres"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (fieldErrors.newPassword) {
                      setFieldErrors((prev) => ({ ...prev, newPassword: '' }));
                    }
                  }}
                  error={fieldErrors.newPassword}
                  iconLeft={<Lock className="w-5 h-5 shrink-0" />}
                  iconRight={
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="flex items-center justify-center min-h-[44px] w-11 -mr-3 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg cursor-pointer"
                      aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5 shrink-0" /> : <Eye className="w-5 h-5 shrink-0" />}
                    </button>
                  }
                  autoComplete="new-password"
                  disabled={isLoading}
                  className="min-h-[44px] text-base bg-slate-900/50 border-slate-700/80 focus:ring-2 focus:ring-indigo-500"
                />

                {/* Campo Confirmar Nova Senha */}
                <FormField
                  label="Confirmar Nova Senha"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                    }
                  }}
                  error={fieldErrors.confirmPassword}
                  iconLeft={<Lock className="w-5 h-5 shrink-0" />}
                  iconRight={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      className="flex items-center justify-center min-h-[44px] w-11 -mr-3 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg cursor-pointer"
                      aria-label={showConfirmPassword ? 'Ocultar confirmação' : 'Exibir confirmação'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5 shrink-0" /> : <Eye className="w-5 h-5 shrink-0" />}
                    </button>
                  }
                  autoComplete="new-password"
                  disabled={isLoading}
                  className="min-h-[44px] text-base bg-slate-900/50 border-slate-700/80 focus:ring-2 focus:ring-indigo-500"
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isLoading}
                  className="w-full min-h-[44px] h-11 text-base font-semibold mt-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all focus:ring-2 focus:ring-indigo-500"
                >
                  {isLoading ? 'Atualizando Senha...' : 'Salvar Nova Senha'}
                </Button>
              </form>

              <div className="text-center pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="text-sm font-medium text-slate-400 hover:text-slate-200 hover:underline min-h-[44px] inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  Voltar para o Login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default ResetPasswordPage;
