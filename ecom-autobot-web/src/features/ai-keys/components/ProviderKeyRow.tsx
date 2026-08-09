import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, HelpCircle, Trash2, Zap, Layers, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { AiProviderMeta, UserAiKey } from '@/features/ai-keys';

const AVAILABLE_OPENROUTER_MODELS = [
  { id: 'groq/llama-3.3-70b', name: 'Groq Llama 3.3 70B' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat (V3)' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
];

export interface ProviderKeyRowProps {
  meta: AiProviderMeta;
  userKey: UserAiKey;
  isVisible: boolean;
  isTesting: boolean;
  isActive: boolean;
  onSave: (providerId: AiProviderMeta['id'], key: string, preferredModels?: string[]) => Promise<void>;
  onRemove: (providerId: AiProviderMeta['id']) => void;
  onToggleVisibility: (providerId: AiProviderMeta['id']) => void;
  onTestKey?: (providerId: AiProviderMeta['id']) => Promise<void>;
  onUpdatePreferredModels?: (providerId: AiProviderMeta['id'], models: string[]) => void;
  className?: string;
}

export const ProviderKeyRow: React.FC<ProviderKeyRowProps> = ({
  meta,
  userKey,
  isVisible,
  isTesting,
  isActive,
  onSave,
  onRemove,
  onToggleVisibility,
  onTestKey,
  onUpdatePreferredModels,
  className,
}) => {
  const [inputKey, setInputKey] = useState<string>(userKey.apiKey);
  const [selectedModels, setSelectedModels] = useState<string[]>(
    userKey.preferred_models || meta.defaultModels || ['groq/llama-3.3-70b', 'deepseek/deepseek-chat']
  );

  useEffect(() => {
    setInputKey(userKey.apiKey);
  }, [userKey.apiKey]);

  useEffect(() => {
    if (userKey.preferred_models && userKey.preferred_models.length > 0) {
      setSelectedModels(userKey.preferred_models);
    }
  }, [userKey.preferred_models]);

  const hasKey = Boolean(userKey.apiKey.trim());
  const isKeyModified = inputKey.trim() !== userKey.apiKey;

  const toggleModelSelection = (modelId: string) => {
    let updated: string[];
    if (selectedModels.includes(modelId)) {
      if (selectedModels.length === 1) return; // Mantém pelo menos um modelo selecionado
      updated = selectedModels.filter((m) => m !== modelId);
    } else {
      updated = [...selectedModels, modelId];
    }
    setSelectedModels(updated);
    if (onUpdatePreferredModels) {
      onUpdatePreferredModels(meta.id, updated);
    }
  };

  const handleSaveOrTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;

    if (isKeyModified || !userKey.isValidated) {
      await onSave(meta.id, inputKey.trim(), meta.id === 'openrouter' ? selectedModels : undefined);
    } else if (onTestKey) {
      await onTestKey(meta.id);
    }
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-4 rounded-xl border p-4 sm:p-5 transition-all duration-200',
        isActive
          ? 'border-purple-500/60 bg-purple-950/20 shadow-[0_0_20px_rgba(139,92,246,0.15)] dark:border-purple-500/50 dark:bg-purple-950/30'
          : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 dark:bg-slate-900/60',
        className
      )}
    >
      {/* Provider Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 font-bold text-slate-200 border border-slate-700/50">
            {meta.id === 'deepseek' && <span className="text-blue-400">DS</span>}
            {meta.id === 'groq' && <span className="text-orange-400">GQ</span>}
            {meta.id === 'openai' && <span className="text-emerald-400">OA</span>}
            {meta.id === 'gemini' && <span className="text-purple-400">GG</span>}
            {meta.id === 'openrouter' && <span className="text-purple-400 font-extrabold text-xs">OR</span>}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-base">{meta.name}</h3>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-purple-400 border border-purple-500/20">
                {meta.badgeText}
              </span>
              {isActive && (
                <span className="flex items-center gap-1 rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-semibold text-purple-300 border border-purple-500/30">
                  <Zap className="h-3 w-3 text-purple-400" />
                  Ativo Principal
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              Documentação oficial da API
              <a
                href={meta.docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-purple-400 hover:text-purple-300 underline underline-offset-2 ml-1"
                aria-label={`Documentação de ${meta.name}`}
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </a>
            </span>
          </div>
        </div>

        {/* Validation Status Indicator */}
        <div className="flex items-center gap-2">
          {userKey.isValidated && hasKey ? (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 text-xs font-medium text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              <span>Validada</span>
              {userKey.pingTime && (
                <span className="ml-1 text-emerald-300/80 font-mono">({userKey.pingTime})</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-full bg-slate-800/80 border border-slate-700 px-3 py-1 text-xs font-medium text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              <span>Não configurada</span>
            </div>
          )}
        </div>
      </div>

      {/* Input Row Form */}
      <form onSubmit={handleSaveOrTest} className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type={isVisible ? 'text' : 'password'}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder={meta.placeholder}
              autoComplete="off"
              spellCheck={false}
              className={cn(
                'w-full rounded-xl border bg-slate-950/80 px-4 py-3 pr-12 text-base text-white placeholder:text-slate-500',
                'border-slate-800 transition-colors duration-200',
                'focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20',
                'h-12 min-h-[44px]'
              )}
            />

            <button
              type="button"
              onClick={() => onToggleVisibility(meta.id)}
              aria-label={isVisible ? 'Ocultar chave' : 'Mostrar chave'}
              className={cn(
                'absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center',
                'h-11 w-11 min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-white',
                'hover:bg-slate-800/80 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500'
              )}
            >
              {isVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              variant={isActive ? 'primary' : 'secondary'}
              isLoading={isTesting}
              disabled={!inputKey.trim()}
              iconLeft={isTesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : undefined}
              className={cn(
                'h-12 min-h-[44px] px-5 text-sm font-semibold shrink-0',
                isActive
                  ? 'bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/30 shadow-[0_0_15px_rgba(139,92,246,0.25)]'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              )}
            >
              {isTesting ? (
                'Testando Conexão...'
              ) : isKeyModified || !userKey.isValidated ? (
                'Salvar Chave'
              ) : (
                'Testar Conexão'
              )}
            </Button>

            {hasKey && (
              <button
                type="button"
                onClick={() => {
                  setInputKey('');
                  onRemove(meta.id);
                }}
                title="Remover chave"
                aria-label={`Remover chave de ${meta.name}`}
                className={cn(
                  'flex items-center justify-center h-12 w-12 min-h-[44px] min-w-[44px] rounded-xl',
                  'border border-slate-800 bg-slate-900 text-slate-400 hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-400',
                  'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500'
                )}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Seletor de Modelos Preferidos do OpenRouter */}
        {meta.id === 'openrouter' && (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-purple-500/20 bg-purple-950/10 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 font-mono">
                <Layers className="h-3.5 w-3.5 text-purple-400" />
                Modelos Preferidos do Gateway (Ordem de Fallback)
              </span>
              <span className="text-[11px] text-slate-400">
                {selectedModels.length} selecionados
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_OPENROUTER_MODELS.map((model) => {
                const isSelected = selectedModels.includes(model.id);
                const order = selectedModels.indexOf(model.id) + 1;

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => toggleModelSelection(model.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150',
                      'min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
                      isSelected
                        ? 'border border-purple-500/50 bg-purple-600/30 text-purple-200 shadow-sm'
                        : 'border border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    )}
                  >
                    {isSelected && (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white">
                        {order}
                      </span>
                    )}
                    <span>{model.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
