/**
 * src/layouts/hooks/useRoleLayout.test.ts
 *
 * Testes unitários para validação da segregação estrita de layouts e roles.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoleLayout } from './useRoleLayout';
import { useAuth } from '@/features/auth';

vi.mock('@/features/auth', () => ({
  useAuth: vi.fn(),
}));

describe('useRoleLayout hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('deve resolver MemberLayout para usuário comum (role MEMBER, plano free)', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        email: 'member@test.com',
        name: 'Member User',
        role: 'MEMBER',
        plan: 'free',
        tenants: ['tenant-1'],
      },
      status: 'authenticated',
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useRoleLayout());

    expect(result.current.resolvedLayout).toBe('member');
    expect(result.current.isMember).toBe(true);
    expect(result.current.isMerchant).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });

  it('deve resolver MerchantLayout para usuário Lojista com plano Pro', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        email: 'merchant@test.com',
        name: 'Merchant User',
        role: 'MEMBER',
        plan: 'pro',
        tenants: ['tenant-1'],
      },
      status: 'authenticated',
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useRoleLayout());

    expect(result.current.resolvedLayout).toBe('merchant');
    expect(result.current.isMerchant).toBe(true);
    expect(result.current.isMember).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });

  it('deve resolver MerchantLayout para usuário com role TENANT_ADMIN', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        email: 'tenantadmin@test.com',
        name: 'Tenant Admin',
        role: 'TENANT_ADMIN',
        plan: 'free',
        tenants: ['tenant-1'],
      },
      status: 'authenticated',
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useRoleLayout());

    expect(result.current.resolvedLayout).toBe('merchant');
    expect(result.current.isMerchant).toBe(true);
    expect(result.current.isMember).toBe(false);
  });

  it('deve resolver AdminLayout por padrão para Super Admin e permitir alternância para visão loja', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        email: 'admin@ecommercebot.com',
        name: 'Super Admin',
        role: 'ADMIN',
        is_admin: true,
        plan: 'admin',
        tenants: ['tenant-1'],
      },
      status: 'authenticated',
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useRoleLayout());

    // 1. Padrão deve ser AdminLayout no modo CRM
    expect(result.current.resolvedLayout).toBe('admin');
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.adminViewMode).toBe('crm');

    // 2. Alternar para visão Loja
    act(() => {
      result.current.setAdminViewMode('store');
    });

    expect(result.current.adminViewMode).toBe('store');
    expect(result.current.resolvedLayout).toBe('merchant');
    expect(sessionStorage.getItem('ecommercebot_admin_portal_view')).toBe('store');

    // 3. Retornar ao modo CRM
    act(() => {
      result.current.setAdminViewMode('crm');
    });

    expect(result.current.adminViewMode).toBe('crm');
    expect(result.current.resolvedLayout).toBe('admin');
    expect(sessionStorage.getItem('ecommercebot_admin_portal_view')).toBe('crm');
  });
});
