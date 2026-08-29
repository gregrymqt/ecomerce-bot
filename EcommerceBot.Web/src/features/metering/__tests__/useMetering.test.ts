/**
 * src/features/metering/__tests__/useMetering.test.ts
 *
 * Testes unitários para o hook useMetering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMetering } from '../hooks/useMetering';
import { meteringService } from '../services/metering.service';
import type {
  TenantCreditBalanceResponse,
  PaginatedLLMUsageResponse,
} from '../types';

vi.mock('../services/metering.service', () => ({
  meteringService: {
    getCreditBalance: vi.fn(),
    getUsageLogs: vi.fn(),
  },
}));

describe('useMetering hook', () => {
  const mockBalanceResponse: TenantCreditBalanceResponse = {
    tenant_id: 'tenant-123',
    managed_credit_balance: 45.5,
    is_byok_active: false,
    total_tokens_used_30d: 150000,
    estimated_cost_usd_30d: 2.75,
  };

  const mockUsageResponse: PaginatedLLMUsageResponse = {
    items: [
      {
        id: 'log-1',
        tenant_id: 'tenant-123',
        provider: 'openrouter',
        model_used: 'deepseek/deepseek-chat',
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
        estimated_cost_usd: 0.003,
        is_byok: false,
        execution_time_ms: 450,
        created_at: '2026-08-08T18:00:00Z',
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve buscar e atualizar o saldo e os logs de consumo na inicialização', async () => {
    vi.mocked(meteringService.getCreditBalance).mockResolvedValue(mockBalanceResponse);
    vi.mocked(meteringService.getUsageLogs).mockResolvedValue(mockUsageResponse);

    const { result } = renderHook(() => useMetering());

    await act(async () => {
      await Promise.resolve();
    });

    expect(meteringService.getCreditBalance).toHaveBeenCalledTimes(1);
    expect(meteringService.getUsageLogs).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });

    expect(result.current.balance).toEqual(mockBalanceResponse);
    expect(result.current.usageLogs).toEqual(mockUsageResponse);
    expect(result.current.isLoadingBalance).toBe(false);
    expect(result.current.isLoadingUsage).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('deve tratar erros de API ao buscar saldo e logs', async () => {
    vi.mocked(meteringService.getCreditBalance).mockRejectedValue(
      new Error('Erro de conexão ao buscar saldo.')
    );
    vi.mocked(meteringService.getUsageLogs).mockRejectedValue(
      new Error('Falha no extrato.')
    );

    const { result } = renderHook(() => useMetering());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoadingBalance).toBe(false);
    expect(result.current.isLoadingUsage).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('deve disparar nova busca de logs ao alterar a página com changePage', async () => {
    vi.mocked(meteringService.getCreditBalance).mockResolvedValue(mockBalanceResponse);
    vi.mocked(meteringService.getUsageLogs).mockResolvedValue(mockUsageResponse);

    const { result } = renderHook(() => useMetering());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.changePage(2);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.page).toBe(2);
    expect(meteringService.getUsageLogs).toHaveBeenLastCalledWith({
      page: 2,
      limit: 20,
    });
  });
});
