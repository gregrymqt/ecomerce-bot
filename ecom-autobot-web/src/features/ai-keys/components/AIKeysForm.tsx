import React from 'react';
import { KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/display/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback/Alert';
import { cn } from '@/lib/utils';
import {
  AIProviderEnum,
  AI_PROVIDER_LABELS,
  type AIProvider,
} from '../types/keys.type';
import { useAIKeys } from '../hooks/useAIKeys';
import type { AIKeysFormProps } from '../types/keys.type';

const PROVIDER_OPTIONS: { value: AIProvider; label: string }[] = [
  { value: AIProviderEnum.DEEPSEEK, label: AI_PROVIDER_LABELS.deepseek },
  { value: AIProviderEnum.GROQ, label: AI_PROVIDER_LABELS.groq },
  { value: AIProviderEnum.OPENAI, label: AI_PROVIDER_LABELS.openai },
  { value: AIProviderEnum.GEMINI, label: AI_PROVIDER_LABELS.gemini },
  { value: AIProviderEnum.OPENROUTER, label: AI_PROVIDER_LABELS.openrouter },
];

export const AIKeysForm: React.FC<AIKeysFormProps> = ({ className }) => {
  const {
    provider,
    setProvider,
    accessToken,
    setAccessToken,
    showToken,
    toggleShowToken,
    maskedToken,
    isLoading,
    error,
    successMessage,
    saveCredentials,
  } = useAIKeys();

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccessToken(e.target.value);
  };

  return (
    <Card className={className}>
      <form
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          saveCredentials();
        }}
        className="flex flex-col gap-5"
        noValidate
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            Chaves de API (BYOK)
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Cadastre sua chave de acesso para o provedor de IA de sua preferência. A chave será criptografada (AES-256 GCM) antes de ser salva.
          </p>
        </div>

        {/* Provider Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Provedor de IA
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setProvider(opt.value)}
                disabled={isLoading}
                className={cn(
                  'flex items-center justify-center h-11 min-h-[44px] rounded-lg border text-sm font-medium transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
                  'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
                  provider === opt.value
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Token Input */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="ai-access-token"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Chave de Acesso (API Key)
          </label>
          <div className="relative">
            <input
              id="ai-access-token"
              type={showToken ? 'text' : 'password'}
              value={showToken ? accessToken : maskedToken}
              onChange={showToken ? handleTokenChange : undefined}
              readOnly={!showToken}
              placeholder={showToken ? 'sk-xxxxxxxxxxxxxxxxxxxx' : '••••••••••••••••'}
              autoComplete="off"
              spellCheck={false}
              disabled={isLoading}
              className={cn(
                'flex w-full rounded-lg border bg-white px-3 py-2.5 pr-11 text-base sm:text-sm',
                'text-slate-900 placeholder:text-slate-400',
                'dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
                'border-slate-300 dark:border-slate-700',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
                'disabled:cursor-not-allowed disabled:opacity-60',
                'transition-colors duration-200',
                'min-h-[44px]'
              )}
            />
            <button
              type="button"
              onClick={toggleShowToken}
              disabled={isLoading}
              aria-label={showToken ? 'Ocultar chave' : 'Mostrar chave'}
              className={cn(
                'absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center',
                'h-9 w-9 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
                'hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
              )}
            >
              {showToken ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {showToken && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sua chave será criptografada com AES-256 GCM no servidor.
            </p>
          )}
        </div>

        {/* Feedback */}
        {error && (
          <Alert variant="error" title="Erro ao salvar">
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert variant="success" title="Sucesso">
            {successMessage}
          </Alert>
        )}

        {/* Submit */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            disabled={!provider}
            iconLeft={<ShieldCheck className="w-4 h-4" />}
            className="w-full sm:w-auto h-11 min-h-[44px]"
          >
            {isLoading ? 'Salvando...' : 'Salvar Chave'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
