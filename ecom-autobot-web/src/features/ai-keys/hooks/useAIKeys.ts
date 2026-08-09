import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { keysService } from '@/features/ai-keys';
import { getErrorMessage } from '@/utils/errors';
import { getLocalStorage, setLocalStorage } from '@/utils/storage';
import type { AIProvider, UseAIKeysReturn as LegacyUseAIKeysReturn } from '@/features/ai-keys';
import type { AiProviderId, UserAiKey } from '@/features/ai-keys';

// ==========================================
// 1. Hook Legado: useAIKeys (AIKeysForm.tsx)
// ==========================================
export const useAIKeys = (): LegacyUseAIKeysReturn => {
  const [provider, setProvider] = useState<AIProvider | null>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const toggleShowToken = useCallback(() => {
    setShowToken((prev) => !prev);
  }, []);

  const maskedToken = useMemo(() => {
    if (!accessToken) return '';
    if (showToken) return accessToken;
    if (accessToken.length <= 8) return '•'.repeat(accessToken.length);
    return accessToken.slice(0, 4) + '•'.repeat(accessToken.length - 8) + accessToken.slice(-4);
  }, [accessToken, showToken]);

  const saveCredentials = useCallback(async () => {
    if (!provider) {
      setError('Selecione um provedor de IA.');
      return;
    }

    const trimmed = accessToken.trim();

    if (!trimmed) {
      setError('Insira a chave de acesso (API Key).');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await keysService.saveCredentials({
        provider,
        access_token: trimmed,
      });
      setSuccessMessage(response.message || 'Chave salva com sucesso!');
      setAccessToken('');
      setShowToken(false);
    } catch (err: unknown) {
      const detail = getErrorMessage(err, 'Falha ao salvar a chave de API.');
      setError(detail);
    } finally {
      setIsLoading(false);
    }
  }, [provider, accessToken]);

  const reset = useCallback(() => {
    setProvider(null);
    setAccessToken('');
    setShowToken(false);
    setIsLoading(false);
    setError(null);
    setSuccessMessage(null);
  }, []);

  return {
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
    reset,
  };
};

// ==========================================
// 2. Novo Hook Modal BYOK: useAiKeys
// ==========================================
const STORAGE_KEY = 'ecom_autobot_ai_keys';

const DEFAULT_KEYS: Record<AiProviderId, UserAiKey> = {
  deepseek: { providerId: 'deepseek', apiKey: '', isValidated: false, isCustomActive: true },
  groq: { providerId: 'groq', apiKey: '', isValidated: false, isCustomActive: false },
  openai: { providerId: 'openai', apiKey: '', isValidated: false, isCustomActive: false },
  gemini: { providerId: 'gemini', apiKey: '', isValidated: false, isCustomActive: false },
  openrouter: {
    providerId: 'openrouter',
    apiKey: '',
    isValidated: false,
    isCustomActive: false,
    preferred_models: ['groq/llama-3.3-70b', 'deepseek/deepseek-chat', 'anthropic/claude-3.5-sonnet'],
  },
};

interface StoredAiKeysState {
  keys: Record<AiProviderId, UserAiKey>;
  activeProvider: AiProviderId;
}

export interface UseAiKeysReturn {
  keys: Record<AiProviderId, UserAiKey>;
  activeProvider: AiProviderId;
  testingProvider: AiProviderId | null;
  visibleKeys: Record<AiProviderId, boolean>;
  saveKey: (providerId: AiProviderId, key: string, preferredModels?: string[]) => Promise<void>;
  removeKey: (providerId: AiProviderId) => void;
  setActiveProvider: (providerId: AiProviderId) => void;
  toggleKeyVisibility: (providerId: AiProviderId) => void;
  testKey: (providerId: AiProviderId) => Promise<void>;
  updatePreferredModels: (providerId: AiProviderId, models: string[]) => void;
  getMaskedKey: (apiKey: string) => string;
}

export const getMaskedKey = (key: string): string => {
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}${'•'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`;
};

export const useAiKeys = (): UseAiKeysReturn => {
  const [keys, setKeys] = useState<Record<AiProviderId, UserAiKey>>(DEFAULT_KEYS);
  const [activeProvider, setActiveProviderState] = useState<AiProviderId>('deepseek');
  const [testingProvider, setTestingProvider] = useState<AiProviderId | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Record<AiProviderId, boolean>>({
    deepseek: false,
    groq: false,
    openai: false,
    gemini: false,
    openrouter: false,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = getLocalStorage<StoredAiKeysState>(STORAGE_KEY);
    if (stored) {
      if (stored.activeProvider) {
        setActiveProviderState(stored.activeProvider);
      }
      if (stored.keys) {
        setKeys((prev) => ({
          ...prev,
          ...stored.keys,
        }));
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const persistState = useCallback(
    (newKeys: Record<AiProviderId, UserAiKey>, newActive: AiProviderId) => {
      setLocalStorage<StoredAiKeysState>(STORAGE_KEY, {
        keys: newKeys,
        activeProvider: newActive,
      });
    },
    []
  );

  const setActiveProvider = useCallback(
    (providerId: AiProviderId) => {
      setActiveProviderState(providerId);
      setKeys((prev) => {
        const updated: Record<AiProviderId, UserAiKey> = { ...prev };
        (Object.keys(updated) as AiProviderId[]).forEach((id) => {
          updated[id] = {
            ...updated[id],
            isCustomActive: id === providerId,
          };
        });
        persistState(updated, providerId);
        return updated;
      });
    },
    [persistState]
  );

  const toggleKeyVisibility = useCallback((providerId: AiProviderId) => {
    setVisibleKeys((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  }, []);

  const testKey = useCallback(
    async (providerId: AiProviderId) => {
      const currentKey = keys[providerId]?.apiKey;
      if (!currentKey || !currentKey.trim()) return;

      setTestingProvider(providerId);
      const startTime = performance.now();

      try {
        await keysService.testAIKey({
          provider: providerId as AIProvider,
          api_key: currentKey.trim(),
          preferred_models: keys[providerId]?.preferred_models,
        });
        const pingTimeMs = `${Math.round(performance.now() - startTime)}ms`;

        setKeys((prev) => {
          const updated = {
            ...prev,
            [providerId]: {
              ...prev[providerId],
              isValidated: true,
              pingTime: pingTimeMs,
            },
          };
          persistState(updated, activeProvider);
          return updated;
        });
      } catch {
        setKeys((prev) => {
          const updated = {
            ...prev,
            [providerId]: {
              ...prev[providerId],
              isValidated: false,
              pingTime: undefined,
            },
          };
          persistState(updated, activeProvider);
          return updated;
        });
      } finally {
        setTestingProvider(null);
      }
    },
    [keys, activeProvider, persistState]
  );

  const saveKey = useCallback(
    async (providerId: AiProviderId, key: string, preferredModels?: string[]) => {
      const trimmedKey = key.trim();
      if (!trimmedKey) return;

      setTestingProvider(providerId);
      const startTime = performance.now();
      const modelsToSave = preferredModels || keys[providerId]?.preferred_models;

      try {
        await keysService.saveCredentials({
          provider: providerId as AIProvider,
          access_token: trimmedKey,
          preferred_models: modelsToSave,
        });
        const pingTimeMs = `${Math.round(performance.now() - startTime)}ms`;

        setKeys((prev) => {
          const updated: Record<AiProviderId, UserAiKey> = {
            ...prev,
            [providerId]: {
              providerId,
              apiKey: trimmedKey,
              isValidated: true,
              pingTime: pingTimeMs,
              isCustomActive: providerId === activeProvider,
              preferred_models: modelsToSave,
            },
          };
          persistState(updated, activeProvider);
          return updated;
        });
      } catch {
        setKeys((prev) => {
          const updated: Record<AiProviderId, UserAiKey> = {
            ...prev,
            [providerId]: {
              providerId,
              apiKey: trimmedKey,
              isValidated: false,
              pingTime: undefined,
              isCustomActive: providerId === activeProvider,
              preferred_models: modelsToSave,
            },
          };
          persistState(updated, activeProvider);
          return updated;
        });
      } finally {
        setTestingProvider(null);
      }
    },
    [keys, activeProvider, persistState]
  );

  const updatePreferredModels = useCallback(
    (providerId: AiProviderId, models: string[]) => {
      setKeys((prev) => {
        const updated = {
          ...prev,
          [providerId]: {
            ...prev[providerId],
            preferred_models: models,
          },
        };
        persistState(updated, activeProvider);
        return updated;
      });
    },
    [activeProvider, persistState]
  );

  const removeKey = useCallback(
    (providerId: AiProviderId) => {
      setKeys((prev) => {
        const updated: Record<AiProviderId, UserAiKey> = {
          ...prev,
          [providerId]: {
            providerId,
            apiKey: '',
            isValidated: false,
            pingTime: undefined,
            isCustomActive: false,
            preferred_models: undefined,
          },
        };
        persistState(updated, activeProvider);
        return updated;
      });
      setVisibleKeys((prev) => ({
        ...prev,
        [providerId]: false,
      }));
    },
    [activeProvider, persistState]
  );

  return {
    keys,
    activeProvider,
    testingProvider,
    visibleKeys,
    saveKey,
    removeKey,
    setActiveProvider,
    toggleKeyVisibility,
    testKey,
    updatePreferredModels,
    getMaskedKey,
  };
};
