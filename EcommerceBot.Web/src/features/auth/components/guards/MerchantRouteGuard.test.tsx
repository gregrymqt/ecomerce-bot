/**
 * src/features/auth/components/guards/MerchantRouteGuard.test.tsx
 *
 * Testes unitários para o MerchantRouteGuard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MerchantRouteGuard } from './MerchantRouteGuard';
import { useAuth } from '../../hooks/useAuth';
import { useFeatureGate } from '../../hooks/useFeatureGate';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../hooks/useFeatureGate', () => ({
  useFeatureGate: vi.fn(),
}));

type AuthHookReturn = ReturnType<typeof useAuth>;
type FeatureGateHookReturn = ReturnType<typeof useFeatureGate>;

describe('MerchantRouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve exibir spinner de carregamento quando a sessão está carregando', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      status: 'loading',
      isLoading: true,
    } as unknown as AuthHookReturn);

    vi.mocked(useFeatureGate).mockReturnValue({
      isAdmin: false,
      hasActiveCredits: false,
      canAccess: vi.fn().mockReturnValue(false),
    } as unknown as FeatureGateHookReturn);

    render(
      <MemoryRouter>
        <MerchantRouteGuard>
          <div>Conteúdo Protegido</div>
        </MerchantRouteGuard>
      </MemoryRouter>
    );

    expect(screen.getByText('Verificando permissões de lojista...')).toBeInTheDocument();
  });

  it('deve redirecionar usuário não autenticado para /auth', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      status: 'unauthenticated',
      isLoading: false,
    } as unknown as AuthHookReturn);

    vi.mocked(useFeatureGate).mockReturnValue({
      isAdmin: false,
      hasActiveCredits: false,
      canAccess: vi.fn().mockReturnValue(false),
    } as unknown as FeatureGateHookReturn);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <MerchantRouteGuard>
                <div>Painel Lojista</div>
              </MerchantRouteGuard>
            }
          />
          <Route path="/auth" element={<div>Tela de Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Tela de Login')).toBeInTheDocument();
  });

  it('deve permitir acesso irrestrito para Super Admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { email: 'admin@ecommercebot.com', role: 'ADMIN', is_admin: true },
      status: 'authenticated',
      isLoading: false,
    } as unknown as AuthHookReturn);

    vi.mocked(useFeatureGate).mockReturnValue({
      isAdmin: true,
      hasActiveCredits: true,
      canAccess: vi.fn().mockReturnValue(true),
    } as unknown as FeatureGateHookReturn);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <MerchantRouteGuard>
          <div>Painel Lojista Admin</div>
        </MerchantRouteGuard>
      </MemoryRouter>
    );

    expect(screen.getByText('Painel Lojista Admin')).toBeInTheDocument();
  });

  it('deve bloquear usuário MEMBER comum e redirecionar para /wallet?reason=upgrade_required', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { email: 'member@test.com', role: 'MEMBER', plan: 'free' },
      status: 'authenticated',
      isLoading: false,
    } as unknown as AuthHookReturn);

    vi.mocked(useFeatureGate).mockReturnValue({
      isAdmin: false,
      hasActiveCredits: false,
      canAccess: vi.fn().mockReturnValue(false),
    } as unknown as FeatureGateHookReturn);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <MerchantRouteGuard>
                <div>Painel Lojista</div>
              </MerchantRouteGuard>
            }
          />
          <Route path="/wallet" element={<div>Página da Carteira / Upgrade</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Painel Lojista')).not.toBeInTheDocument();
    expect(screen.getByText('Página da Carteira / Upgrade')).toBeInTheDocument();
  });

  it('deve permitir acesso para lojista com plano Pro e saldo ativo', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { email: 'merchant@test.com', role: 'MEMBER', plan: 'pro' },
      status: 'authenticated',
      isLoading: false,
    } as unknown as AuthHookReturn);

    vi.mocked(useFeatureGate).mockReturnValue({
      isAdmin: false,
      hasActiveCredits: true,
      canAccess: vi.fn().mockReturnValue(true),
    } as unknown as FeatureGateHookReturn);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <MerchantRouteGuard featureKey="dashboard">
          <div>Painel Lojista Autorizado</div>
        </MerchantRouteGuard>
      </MemoryRouter>
    );

    expect(screen.getByText('Painel Lojista Autorizado')).toBeInTheDocument();
  });
});
