/**
 * src/features/settings/__tests__/SettingsPage.test.tsx
 *
 * Testes unitários para a página de configurações e controle de exibição de abas por role.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsPage } from '../pages/SettingsPage';
import { useAuth } from '@/features/auth';
import { settingsService } from '../services/settings.service';

vi.mock('@/features/auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/settings.service', () => ({
  settingsService: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  },
}));

type AuthHookReturn = ReturnType<typeof useAuth>;

describe('SettingsPage Tab Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      ai: {
        default_language: 'PT_BR',
        seo_tags: [],
        tone_of_voice: 'PERSUASIVE',
        price_markup_percentage: 15,
        rounding_rule: 'ENDING_99',
      },
      profile: {
        store_name: 'Loja Teste',
        tenant_id: 't-123',
        admin_email: 'admin@teste.com',
        timezone: 'America/Sao_Paulo',
        base_currency: 'BRL',
      },
      billing: {
        company_name: 'Empresa Teste',
        tax_id: '00.000.000/0001-00',
        billing_email: 'financeiro@teste.com',
        commercial_address: 'Av Paulista',
      },
    });
  });

  it('não deve exibir a aba SSO para usuário com role MEMBER', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { email: 'member@test.com', role: 'MEMBER' },
      status: 'authenticated',
      isLoading: false,
    } as unknown as AuthHookReturn);

    render(<SettingsPage />);

    expect(screen.getByText('Regras da IA & Copywriting')).toBeInTheDocument();
    expect(screen.getByText('Perfil da Loja & Tenant')).toBeInTheDocument();
    expect(screen.getByText('Dados Fiscais & Cobrança')).toBeInTheDocument();
    expect(screen.queryByText('SSO & Grupos IdP')).not.toBeInTheDocument();
  });

  it('deve exibir a aba SSO para usuário com role TENANT_ADMIN ou ADMIN', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { email: 'admin@empresa.com', role: 'TENANT_ADMIN' },
      status: 'authenticated',
      isLoading: false,
    } as unknown as AuthHookReturn);

    render(<SettingsPage />);

    expect(screen.getByText('Regras da IA & Copywriting')).toBeInTheDocument();
    expect(screen.getByText('Perfil da Loja & Tenant')).toBeInTheDocument();
    expect(screen.getByText('Dados Fiscais & Cobrança')).toBeInTheDocument();
    expect(screen.getByText('SSO & Grupos IdP')).toBeInTheDocument();
  });
});
