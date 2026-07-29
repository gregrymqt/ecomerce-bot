import React, { useEffect } from 'react';
import { Key, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useAiKeys } from '../hooks/useAIKeys';
import { AI_PROVIDERS_META } from '../constants/ai-providers';
import { ProviderKeyRow } from './ProviderKeyRow';
import { ActiveProviderSelector } from './ActiveProviderSelector';

export interface AiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const AiKeysModal: React.FC<AiKeysModalProps> = ({ isOpen, onClose, className }) => {
  const {
    keys,
    activeProvider,
    testingProvider,
    visibleKeys,
    saveKey,
    removeKey,
    setActiveProvider,
    toggleKeyVisibility,
    testKey,
  } = useAiKeys();

  // Fecha o modal ao pressionar ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const configuredCount = Object.values(keys).filter((k) => Boolean(k.apiKey.trim())).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-keys-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={cn(
          'relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-xl',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(139,92,246,0.3)]">
              <Key className="h-6 w-6" />
            </div>
            <div>
              <h2 id="ai-keys-modal-title" className="text-xl font-bold text-white">
                Gerenciar Chaves de IA (BYOK)
              </h2>
              <p className="text-xs text-slate-400">
                Cadastre suas credenciais para usar modelos próprios de alta velocidade.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className={cn(
              'flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400',
              'hover:bg-slate-800 hover:text-white transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500'
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Security Banner: Zero Logs no Servidor */}
        <div className="mx-6 mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-emerald-300">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-sm text-emerald-300">
              Segurança BYOK — Zero Logs no Servidor
            </span>
            <p className="text-xs text-emerald-400/80">
              Suas chaves são salvas criptografadas (AES-256 GCM) e processadas com isolamento por Tenant. Nenhuma API key é registrada em arquivos de log.
            </p>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Active Provider Selector */}
          <ActiveProviderSelector
            providers={AI_PROVIDERS_META}
            activeProvider={activeProvider}
            keys={keys}
            onSelectActiveProvider={setActiveProvider}
          />

          {/* Provider List Rows */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-sm text-slate-300">
              Credenciais dos Provedores ({configuredCount}/4 configurados)
            </h3>
            {AI_PROVIDERS_META.map((meta) => (
              <ProviderKeyRow
                key={meta.id}
                meta={meta}
                userKey={keys[meta.id]}
                isVisible={Boolean(visibleKeys[meta.id])}
                isTesting={testingProvider === meta.id}
                isActive={activeProvider === meta.id}
                onSave={saveKey}
                onRemove={removeKey}
                onToggleVisibility={toggleKeyVisibility}
                onTestKey={testKey}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-950/60 px-6 py-4">
          <div className="text-xs text-slate-400">
            <span className="font-medium text-slate-300">{configuredCount} de 4</span> chaves personalizadas ativas.
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={onClose}
            className="h-12 min-h-[44px] px-6 text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/30 shadow-[0_0_15px_rgba(139,92,246,0.25)]"
          >
            Concluído
          </Button>
        </div>
      </div>
    </div>
  );
};
