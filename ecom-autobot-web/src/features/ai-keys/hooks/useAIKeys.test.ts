import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIKeys, useAiKeys } from './useAIKeys';
import { keysService } from '@/features/ai-keys';
import type { AICredentialsResponse, TestAIKeyResponse } from '@/features/ai-keys';

vi.mock('../services/keys.service', () => ({
  keysService: {
    saveCredentials: vi.fn(),
    testAIKey: vi.fn(),
  },
}));

describe('useAIKeys hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize with default empty/null state', () => {
    const { result } = renderHook(() => useAIKeys());

    expect(result.current.provider).toBeNull();
    expect(result.current.accessToken).toBe('');
    expect(result.current.showToken).toBe(false);
    expect(result.current.maskedToken).toBe('');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.successMessage).toBeNull();
  });

  it('should toggle token visibility and compute masked token', () => {
    const { result } = renderHook(() => useAIKeys());

    act(() => {
      result.current.setAccessToken('sk-or-v1-1234567890abcdef');
    });

    expect(result.current.maskedToken).toBe('sk-o•••••••••••••••••cdef');

    act(() => {
      result.current.toggleShowToken();
    });

    expect(result.current.showToken).toBe(true);
    expect(result.current.maskedToken).toBe('sk-or-v1-1234567890abcdef');
  });

  it('should validate missing provider or missing token before calling API', async () => {
    const { result } = renderHook(() => useAIKeys());

    // Tentativa de salvar sem selecionar provedor
    await act(async () => {
      await result.current.saveCredentials();
    });

    expect(result.current.error).toBe('Selecione um provedor de IA.');
    expect(keysService.saveCredentials).not.toHaveBeenCalled();

    // Selecionar provedor sem chave
    act(() => {
      result.current.setProvider('deepseek');
      result.current.setAccessToken('   ');
    });

    await act(async () => {
      await result.current.saveCredentials();
    });

    expect(result.current.error).toBe('Insira a chave de acesso (API Key).');
    expect(keysService.saveCredentials).not.toHaveBeenCalled();
  });

  it('should handle successful API credentials save', async () => {
    const mockSuccessResponse: AICredentialsResponse = {
      status: 'success',
      message: 'Chave do DeepSeek salva com sucesso!',
    };

    const mockSave = vi.mocked(keysService.saveCredentials).mockResolvedValue(mockSuccessResponse);

    const { result } = renderHook(() => useAIKeys());

    act(() => {
      result.current.setProvider('deepseek');
      result.current.setAccessToken('sk-or-v1-testkey12345');
    });

    await act(async () => {
      await result.current.saveCredentials();
    });

    expect(mockSave).toHaveBeenCalledWith({
      provider: 'deepseek',
      access_token: 'sk-or-v1-testkey12345',
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.successMessage).toBe('Chave do DeepSeek salva com sucesso!');
    expect(result.current.accessToken).toBe('');
  });

  it('should handle API errors gracefully during saveCredentials', async () => {
    vi.mocked(keysService.saveCredentials).mockRejectedValue(
      new Error('Chave de API do DeepSeek inválida.')
    );

    const { result } = renderHook(() => useAIKeys());

    act(() => {
      result.current.setProvider('deepseek');
      result.current.setAccessToken('invalid-token');
    });

    await act(async () => {
      await result.current.saveCredentials();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.successMessage).toBeNull();
    expect(result.current.error).toBe('Chave de API do DeepSeek inválida.');
  });

  it('should set error state when API returns HTTP 500 server error', async () => {
    vi.mocked(keysService.saveCredentials).mockRejectedValue(
      new Error('Erro interno no servidor (500). Tente novamente mais tarde.')
    );

    const { result } = renderHook(() => useAIKeys());

    act(() => {
      result.current.setProvider('openrouter');
      result.current.setAccessToken('sk-or-v1-testkey123');
    });

    await act(async () => {
      await result.current.saveCredentials();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Erro interno no servidor (500). Tente novamente mais tarde.');
    expect(result.current.successMessage).toBeNull();
  });

  it('should reset all states when reset() is called', () => {
    const { result } = renderHook(() => useAIKeys());

    act(() => {
      result.current.setProvider('groq');
      result.current.setAccessToken('sk-groq-123456');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.provider).toBeNull();
    expect(result.current.accessToken).toBe('');
    expect(result.current.showToken).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.successMessage).toBeNull();
  });
});

describe('useAiKeys modal BYOK hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize with default keys and activeProvider', () => {
    const { result } = renderHook(() => useAiKeys());

    expect(result.current.activeProvider).toBe('deepseek');
    expect(result.current.keys.deepseek.providerId).toBe('deepseek');
    expect(result.current.keys.groq.providerId).toBe('groq');
    expect(result.current.testingProvider).toBeNull();
  });

  it('should save and test key successfully', async () => {
    const mockSaveResponse: AICredentialsResponse = {
      status: 'success',
      message: 'Salvo com sucesso',
    };
    const mockTestResponse: TestAIKeyResponse = {
      status: 'success',
      message: 'Chave autêntica',
    };

    vi.mocked(keysService.saveCredentials).mockResolvedValue(mockSaveResponse);
    vi.mocked(keysService.testAIKey).mockResolvedValue(mockTestResponse);

    const { result } = renderHook(() => useAiKeys());

    await act(async () => {
      await result.current.saveKey('openai', 'sk-proj-testkey123456');
    });

    expect(result.current.keys.openai.apiKey).toBe('sk-proj-testkey123456');
    expect(result.current.keys.openai.isValidated).toBe(true);

    await act(async () => {
      await result.current.testKey('openai');
    });

    expect(result.current.keys.openai.isValidated).toBe(true);
  });
});
