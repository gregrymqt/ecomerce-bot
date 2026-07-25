import { useState, useCallback, useMemo } from 'react';
import { keysService } from '../services/keys.service';
import { getErrorMessage } from '@/utils/errors';
import type { AIProvider, UseAIKeysReturn } from '../types/keys.type';

export const useAIKeys = (): UseAIKeysReturn => {
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
