import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { keysService } from '../services/keys.service';
import { getErrorMessage } from '@/utils/errors';
import { getLocalStorage, setLocalStorage } from '@/utils/storage';
import type { AIProvider, UseAIKeysReturn as LegacyUseAIKeysReturn } from '../types/keys.type';
import type { AiProviderId, UserAiKey } from '../types/ai-keys.types';

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
  saveKey: (providerId: AiProviderId, key: string) => Promise<void>;
  removeKey: (providerId: AiProviderId) => void;
  setActiveProvider: (providerId: AiProviderId) => void;
  toggleKeyVisibility: (providerId: AiProviderId) => void;
  testKey: (providerId: AiProviderId) => Promise<void>;
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
      setTestingProvider(providerId);
      const startTime = performance.now();

      try {
        const currentKey = keys[providerId]?.apiKey;
        if (currentKey) {
          await keysService.saveCredentials({
            provider: providerId,
            access_token: currentKey,
          });
        }
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
    async (providerId: AiProviderId, key: string) => {
      const trimmedKey = key.trim();
      if (!trimmedKey) return;

      setTestingProvider(providerId);
      const startTime = performance.now();

      try {
        await keysService.saveCredentials({
          provider: providerId,
          access_token: trimmedKey,
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
            },
          };
          persistState(updated, activeProvider);
          return updated;
        });
      } finally {
        setTestingProvider(null);
      }
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
    getMaskedKey,
  };
};
