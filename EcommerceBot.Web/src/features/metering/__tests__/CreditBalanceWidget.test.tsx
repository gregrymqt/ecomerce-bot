/**
 * src/features/metering/__tests__/CreditBalanceWidget.test.tsx
 *
 * Testes unitários para o componente CreditBalanceWidget.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreditBalanceWidget } from '../components/CreditBalanceWidget';
import type { TenantCreditBalanceResponse } from '../types';

describe('CreditBalanceWidget component', () => {
  const mockBalance: TenantCreditBalanceResponse = {
    tenant_id: 'tenant-abc',
    managed_credit_balance: 50.0,
    is_byok_active: false,
    total_tokens_used_30d: 85000,
    estimated_cost_usd_30d: 1.25,
  };

  it('deve exibir o saldo formatado em USD corretamente', () => {
    render(
      <CreditBalanceWidget
        balance={mockBalance}
        isLoading={false}
        onTopUp={vi.fn()}
      />
    );

    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('85.000')).toBeInTheDocument();
    expect(screen.getByText('$1.2500')).toBeInTheDocument();
  });

  it('deve disparar a callback onTopUp ao clicar em "Recarregar Créditos"', () => {
    const handleTopUp = vi.fn();

    render(
      <CreditBalanceWidget
        balance={mockBalance}
        isLoading={false}
        onTopUp={handleTopUp}
      />
    );

    const button = screen.getByRole('button', { name: /Recarregar Créditos/i });
    fireEvent.click(button);

    expect(handleTopUp).toHaveBeenCalledTimes(1);
  });

  it('deve exibir alerta de saldo baixo quando o valor for menor que $5.00 e BYOK estiver inativo', () => {
    const lowBalance: TenantCreditBalanceResponse = {
      ...mockBalance,
      managed_credit_balance: 2.5,
      is_byok_active: false,
    };

    render(
      <CreditBalanceWidget
        balance={lowBalance}
        isLoading={false}
        onTopUp={vi.fn()}
      />
    );

    expect(screen.getByText(/Saldo Baixo:/i)).toBeInTheDocument();
  });

  it('não deve exibir alerta de saldo baixo quando BYOK estiver ativo', () => {
    const lowBalanceByok: TenantCreditBalanceResponse = {
      ...mockBalance,
      managed_credit_balance: 2.5,
      is_byok_active: true,
    };

    render(
      <CreditBalanceWidget
        balance={lowBalanceByok}
        isLoading={false}
        onTopUp={vi.fn()}
      />
    );

    expect(screen.queryByText(/Saldo Baixo:/i)).not.toBeInTheDocument();
  });
});
