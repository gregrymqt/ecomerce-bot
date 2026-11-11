import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, waitFor, act, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { liveDemoService } from '../services/liveDemoService';
import { useLiveDemoSSE } from '../hooks/useLiveDemoSSE';
import { useCatalogPage } from '@/features/catalog/hooks/useCatalogPage';
import { productService } from '@/features/catalog/services/product.service';
import { useUnifiedPayment } from '@/features/wallet/hooks/useUnifiedPayment';
import { walletService } from '@/features/wallet/services/wallet.service';
import { mercadoPagoService } from '@/features/wallet/services/mercadoPago.service';
import { IntegrationsPage } from '@/features/integrations/pages/IntegrationsPage';
import { MerchantLayout } from '@/layouts/MerchantLayout';
import { useAuth } from '@/features/auth';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/features/auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/features/catalog/hooks/useProducts', () => ({
  useProducts: vi.fn(() => ({
    products: [
      {
        tenant_id: 't-1',
        sku: 'SKU-10',
        title: 'Tênis Runner',
        description: 'Desc original',
        status: 'RAW',
      },
    ],
    isLoading: false,
    refetch: vi.fn().mockResolvedValue(undefined),
    deleteProduct: vi.fn(),
    updateProduct: vi.fn(),
  })),
}));

vi.mock('@/features/wallet/services/wallet.service', () => ({
  walletService: {
    createRecharge: vi.fn(),
    processCreditCardRecharge: vi.fn(),
    getRechargeOrderStatus: vi.fn(),
  },
}));

vi.mock('@/features/wallet/hooks/useBillingProfile', () => ({
  useBillingProfile: vi.fn(() => ({
    profile: null,
    hasProfile: false,
    loading: false,
    saving: false,
    cepLoading: false,
    saveProfile: vi.fn(),
    lookupCep: vi.fn(),
  })),
}));

vi.mock('@/features/wallet/services/mercadoPago.service', () => ({
  mercadoPagoService: { tokenizeCard: vi.fn() },
  detectPaymentMethodId: vi.fn(() => 'visa'),
}));

vi.mock('@/features/integrations/hooks', () => ({
  useIntegrations: vi.fn(() => ({
    summary: { total: 0, connected: 0, sync_errors: 0 },
    integrations: [],
    loading: false,
    actionLoading: {},
    isShopifyModalOpen: false,
    setIsShopifyModalOpen: vi.fn(),
    isNuvemshopModalOpen: vi.fn(),
    setIsNuvemshopModalOpen: vi.fn(),
    error: null,
    setError: vi.fn(),
    successMessage: null,
    setSuccessMessage: vi.fn(),
    handleSaveShopify: vi.fn(),
    handleSaveNuvemshop: vi.fn(),
    handleTestConnection: vi.fn(),
    handleDisconnect: vi.fn(),
    handleConnectNuvemshop: vi.fn(),
  })),
}));

vi.mock('@/features/wallet/components/badges', () => ({
  GlobalCreditBalanceBadge: () => <div data-testid="wallet-badge" />,
}));

describe('Block 3 Integration Flows: Live Demo, Catalog AI, Checkout, Integrations & Tenant Name (UX-03 & UX-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { sub: 'u-1', email: 'lojista@teste.com', name: 'Lojista', role: 'TENANT_ADMIN' },
      currentTenant: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('liveDemoService usa /api/v1/system/demo e /api/v1/system/demo/stream', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { status: 'enviado_para_fila' } });

    await liveDemoService.requestDemoIngestion(['https://loja.com/produto']);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/system/demo', {
      urls: ['https://loja.com/produto'],
    });
  });

  it('useLiveDemoSSE ignora handshake "connected" no timeout de 15s e não injeta mock automaticamente', async () => {
    vi.useFakeTimers();

    vi.spyOn(liveDemoService, 'requestDemoIngestion').mockResolvedValue({ status: 'enviado_para_fila' });
    const connectSpy = vi.spyOn(liveDemoService, 'connectStream').mockImplementation((_url, callbacks) => {
      callbacks.onOpen?.();
      callbacks.onPayload?.({ type: 'connected' });
    });
    vi.spyOn(liveDemoService, 'disconnectStream').mockImplementation(() => {});

    const { result } = renderHook(() => useLiveDemoSSE());

    act(() => {
      result.current.startExtraction('https://loja.com/produto');
    });

    expect(connectSpy).toHaveBeenCalledWith('https://loja.com/produto', expect.any(Object));

    await act(async () => {
      vi.advanceTimersByTime(15050);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.result).toBeNull();
    expect(result.current.errorMessage).toContain('15s');

    act(() => {
      result.current.loadOfflinePreviewSample();
    });
    expect(result.current.status).toBe('fallback');
    expect(result.current.result?.isFallback).toBe(true);
  });

  it('handleRegenerateAiTitle aciona POST /api/v1/products/{sku}/regenerate real', async () => {
    const spy = vi.spyOn(productService, 'regenerateProductCopy').mockResolvedValue({
      tenant_id: 't-1',
      sku: 'SKU-10',
      title: 'Título Otimizado Pela IA',
      description: 'Nova descrição persuasiva',
      status: 'PROCESSED',
    });

    const { result } = renderHook(() => useCatalogPage());

    await act(async () => {
      await result.current.handleRegenerateAiTitle({
        id: '1',
        sku: 'SKU-10',
        titleOriginal: 'Tênis Runner',
        titleAi: 'Tênis Runner',
        descriptionAi: '',
        thumbnailUrl: '',
        platform: 'Shopify',
        status: 'RAW',
        synced: false,
        createdAt: new Date().toISOString(),
      });
    });

    expect(spy).toHaveBeenCalledWith('SKU-10');
    expect(result.current.filteredProducts[0].titleAi).toBe('Título Otimizado Pela IA');
    expect(result.current.filteredProducts[0].status).toBe('PROCESSED');
  });

  it('Checkout bloqueia PIX e Cartão sem CPF/CNPJ válido e abre edição fiscal', async () => {
    const onClose = vi.fn();
    const target = {
      id: 'pkg-1',
      name: 'Pacote Starter',
      amountBrl: 49,
      credits: 100,
      description: '100 créditos',
    };

    const { result } = renderHook(() =>
      useUnifiedPayment({
        isOpen: true,
        target,
        onClose,
      })
    );

    await act(async () => {
      await result.current.handleGeneratePix();
    });

    expect(walletService.createRecharge).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/CPF ou CNPJ válido/i);
    expect(result.current.isEditingBilling).toBe(true);

    await act(async () => {
      await result.current.handleProcessCreditCard({
        cardNumber: '4111222233334444',
        cardholderName: 'JOAO TESTE',
        expirationMonth: '12',
        expirationYear: '2029',
        securityCode: '123',
        installments: 1,
        docNumber: '',
      });
    });

    expect(mercadoPagoService.tokenizeCard).not.toHaveBeenCalled();
    expect(walletService.processCreditCardRecharge).not.toHaveBeenCalled();
  });

  it('IntegrationsPage abre seletor de plataforma Shopify vs Nuvemshop ao clicar em Adicionar Nova Loja', () => {
    render(
      <HelmetProvider>
        <IntegrationsPage />
      </HelmetProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Adicionar Nova Loja/i }));

    const dialog = screen.getByRole('dialog', { name: /Escolher Plataforma de E-commerce/i });
    expect(within(dialog).getByRole('button', { name: /Shopify/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Nuvemshop/i })).toBeInTheDocument();
  });

  it('MerchantLayout exibe nome comercial da loja em vez de UUID bruto do tenant', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { name: 'Boutique Paulista' },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <MerchantLayout />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Boutique Paulista')).toBeInTheDocument();
    });

    expect(screen.queryByText(/d290f1ee-6c54-4b01-90e6-d701748f0851/)).not.toBeInTheDocument();
  });
});
