import React from 'react';
import { Key, ShieldCheck } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { useAiKeys } from '../hooks/useAIKeys';
import { AI_PROVIDERS_META } from '../constants/ai-providers';
import { ProviderKeyRow } from './ProviderKeyRow';
import { ActiveProviderSelector } from './ActiveProviderSelector';

export interface AiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const AiKeysModal: React.FC<AiKeysModalProps> = ({ isOpen, onClose }) => {
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

  if (!isOpen) return null;

  const configuredCount = Object.values(keys).filter((k) => Boolean(k.apiKey.trim())).length;

  const footer = (
    <div className="flex items-center justify-between w-full">
      <div className="text-xs text-slate-400 font-mono">
        <span className="font-medium text-slate-300">{configuredCount} de 4</span> chaves personalizadas ativas.
      </div>

      <Button
        type="button"
        variant="primary"
        onClick={onClose}
      >
        Concluído
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      footer={footer}
    >
      <div className="space-y-6">
        {/* Header Title & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(139,92,246,0.3)]">
            <Key className="h-6 w-6" />
          </div>
          <div>
            <h2 id="ai-keys-modal-title" className="text-xl font-bold text-white">
              Gerenciar Chaves de IA (BYOK)
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Cadastre suas credenciais para usar modelos próprios de alta velocidade.
            </p>
          </div>
        </div>

        {/* Security Banner: Zero Logs no Servidor */}
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-emerald-300 font-mono">
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

        {/* Content Body */}
        <div className="space-y-6">
          {/* Active Provider Selector */}
          <ActiveProviderSelector
            providers={AI_PROVIDERS_META}
            activeProvider={activeProvider}
            keys={keys}
            onSelectActiveProvider={setActiveProvider}
          />

          {/* Provider List Rows */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-sm text-slate-300 font-mono">
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
      </div>
    </Modal>
  );
};

