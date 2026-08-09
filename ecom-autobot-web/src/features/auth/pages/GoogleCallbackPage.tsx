import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, Loader2, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/display/Card';
import { Alert } from '@/components/ui/feedback/Alert';
import { FormField } from '@/components/ui/form/FormField';
import { getErrorMessage } from '@/utils/errors';

export const GoogleCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithGoogleCallback } = useAuth();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresTenantName, setRequiresTenantName] = useState<boolean>(false);
  const [tenantNameInput, setTenantNameInput] = useState<string>('');
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const hasProcessed = useRef<boolean>(false);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state') || undefined;

  const processCallback = async (tenantNameOverride?: string) => {
    if (!code) {
      setError('Código de autorização do Google não encontrado na URL.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setTenantError(null);

    const storedTenant = sessionStorage.getItem('google_oauth_tenant_name') || undefined;
    const finalTenantName = tenantNameOverride || storedTenant;

    try {
      await loginWithGoogleCallback({
        code,
        state,
        tenant_name: finalTenantName,
      });

      sessionStorage.removeItem('google_oauth_tenant_name');
      setIsSuccess(true);
      setIsLoading(false);

      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      navigationTimeoutRef.current = setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1200);
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = getErrorMessage(err, 'Erro ao processar login com o Google.');

      if (
        msg.toLowerCase().includes('tenant_name') ||
        msg.toLowerCase().includes('organização') ||
        msg.toLowerCase().includes('primeiro acesso')
      ) {
        setRequiresTenantName(true);
        setError(null);
      } else {
        setError(msg);
      }
    }
  };

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    processCallback();
  }, []);

  const handleTenantSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tenantNameInput.trim()) {
      setTenantError('Por favor, informe o nome da sua empresa ou organização.');
      return;
    }
    setRequiresTenantName(false);
    processCallback(tenantNameInput.trim());
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Background Decorativo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 blur-3xl rounded-full pointer-events-none" />

      <Card glass className="w-full max-w-md p-6 sm:p-8 shadow-2xl bg-slate-900/80 border-slate-800 relative z-10">
        {/* Estado 1: Sucesso */}
        {isSuccess ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle className="w-8 h-8 animate-bounce" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
              Autenticação Concluída!
            </h2>
            <p className="text-sm text-slate-400">
              Bem-vindo ao E-commerce Bot. Redirecionando para o seu painel...
            </p>
          </div>
        ) : requiresTenantName ? (
          /* Estado 2: Solicitação do Nome da Organização */
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto border border-indigo-500/20">
                <Building className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
                Primeiro Acesso com o Google
              </h2>
              <p className="text-sm text-slate-400">
                Informe o nome da sua empresa ou organização para criar o seu ambiente exclusivo.
              </p>
            </div>

            <form onSubmit={handleTenantSubmit} className="space-y-4">
              <FormField
                label="Nome da Organização / Loja"
                name="tenant_name"
                type="text"
                required
                placeholder="ex: Minha Empresa LTDA"
                value={tenantNameInput}
                onChange={(e) => setTenantNameInput(e.target.value)}
                error={tenantError || undefined}
                iconLeft={<Building className="w-5 h-5 shrink-0" />}
                className="min-h-[44px] text-sm sm:text-base bg-slate-900/50 border-slate-700/80 focus:ring-2 focus:ring-indigo-500"
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                className="w-full min-h-[44px] h-11 text-base font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all"
              >
                Concluir Cadastro
              </Button>
            </form>
          </div>
        ) : error ? (
          /* Estado 3: Erro */
          <div className="space-y-6 text-center">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
              <AlertCircle className="w-6 h-6" />
            </div>

            <Alert variant="error" title="Falha no Callback do Google">
              {error}
            </Alert>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => navigate('/auth', { replace: true })}
              iconLeft={<ArrowLeft className="w-4 h-4" />}
              className="w-full min-h-[44px] h-11 text-sm sm:text-base font-semibold bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              Voltar para o Login
            </Button>
          </div>
        ) : (
          /* Estado 4: Processando/Carregando */
          <div className="text-center space-y-6 py-6">
            <div className="flex justify-center">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-100">
                Conectando à sua conta...
              </h2>
              <p className="text-sm text-slate-400">
                Validando suas credenciais do Google OAuth 2.0. Aguarde um instante.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default GoogleCallbackPage;
