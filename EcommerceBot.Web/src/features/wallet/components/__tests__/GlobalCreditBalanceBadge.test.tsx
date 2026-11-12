import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlobalCreditBalanceBadge } from '../badges/GlobalCreditBalanceBadge';
import { useRealtimeWalletBalance } from '@/features/wallet/hooks/useRealtimeWalletBalance';

vi.mock('@/features/wallet/hooks/useRealtimeWalletBalance', () => ({
  useRealtimeWalletBalance: vi.fn(),
}));

vi.mock('../modals/UnifiedPaymentModal', () => ({
  UnifiedPaymentModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="payment-modal-open">Modal Aberto</div> : null,
}));

describe('GlobalCreditBalanceBadge (UX-01 & UX-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não deve lançar erro quando balance for undefined ou não numérico', () => {
    vi.mocked(useRealtimeWalletBalance).mockReturnValue({
      balance: undefined as unknown as number | null,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<GlobalCreditBalanceBadge />);

    expect(screen.getByText('... créditos')).toBeInTheDocument();
  });

  it('deve formatar saldo numérico válido e manter touch target acessível no botão +', () => {
    vi.mocked(useRealtimeWalletBalance).mockReturnValue({
      balance: 1500,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<GlobalCreditBalanceBadge />);

    expect(screen.getByText('1.500 créditos')).toBeInTheDocument();
    const rechargeBtn = screen.getByRole('button', { name: /Recarregar créditos de IA/i });
    expect(rechargeBtn.className).toContain('min-w-[44px]');
    expect(rechargeBtn.className).toContain('min-h-[44px]');

    fireEvent.click(rechargeBtn);
    expect(screen.getByTestId('payment-modal-open')).toBeInTheDocument();
  });
});
