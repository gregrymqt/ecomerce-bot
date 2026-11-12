import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginForm } from '../components/forms/LoginForm';
import { RegisterForm } from '../components/forms/RegisterForm';
import { useAuthForm } from '../hooks/useAuthForm';
import { useAuthSession } from '../hooks/useAuthSession';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';
import * as storage from '@/utils/storage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/authService', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getMe: vi.fn(),
    refreshToken: vi.fn(),
    updateMe: vi.fn(),
    getGoogleLoginUrl: vi.fn(),
    googleCallback: vi.fn(),
  },
}));

describe('Auth Forms, Redirects and Initial Session (UX-02 & UX-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('LoginForm não deve exibir campo "ID da Loja (Opcional)"', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    expect(screen.queryByLabelText(/ID da Loja/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Senha/i, { selector: 'input' })).toBeInTheDocument();
  });

  it('RegisterForm deve enviar tenantName alinhado ao DTO CreateUserRequest da Core API', async () => {
    const registerMock = vi.fn().mockResolvedValue({});
    vi.mocked(useAuth).mockReturnValue({
      register: registerMock,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: 'Ana Lojista' },
    });
    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: 'ana@loja.com' },
    });
    fireEvent.change(screen.getByLabelText(/Nome da Sua Loja/i), {
      target: { value: 'Loja da Ana' },
    });
    fireEvent.change(screen.getByLabelText(/^Senha/i, { selector: 'input' }), {
      target: { value: 'SenhaForte!123' },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar Senha/i, { selector: 'input' }), {
      target: { value: 'SenhaForte!123' },
    });

    fireEvent.submit(screen.getByRole('button', { name: /^Cadastrar$/i }).closest('form')!);

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        name: 'Ana Lojista',
        email: 'ana@loja.com',
        password: 'SenhaForte!123',
        tenantName: 'Loja da Ana',
      });
    });
  });

  it('useAuthForm deve enviar tenantName e redirecionar usuários autenticados para /dashboard (não /demo)', async () => {
    const loginMock = vi.fn().mockResolvedValue({
      user_id: 'u-1',
      email: 'member@loja.com',
      role: 'MEMBER',
      plan: 'free',
    });
    const registerMock = vi.fn().mockResolvedValue({
      user_id: 'u-2',
      email: 'admin@saas.com',
      role: 'ADMIN',
      is_admin: true,
      plan: 'enterprise',
    });

    vi.mocked(useAuth).mockReturnValue({
      login: loginMock,
      register: registerMock,
      logout: vi.fn(),
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useAuthForm());

    await act(async () => {
      await result.current.handleLogin({ email: 'member@loja.com', password: 'Password123!' });
    });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');

    await act(async () => {
      await result.current.handleRegister({
        name: 'Admin SaaS',
        email: 'admin@saas.com',
        tenantName: 'Plataforma HQ',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
    });
    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantName: 'Plataforma HQ' })
    );
    expect(mockNavigate).toHaveBeenCalledWith('/admin/leads');
  });

  it('useAuthSession não deve chamar /api/v1/auth/me na montagem quando não há token salvo', async () => {
    vi.spyOn(storage, 'getAuthToken').mockReturnValue(null);

    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toBe('unauthenticated');
    expect(authService.getMe).not.toHaveBeenCalled();
  });
});
