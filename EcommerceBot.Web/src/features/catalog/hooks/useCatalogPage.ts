/**
 * src/features/catalog/hooks/useCatalogPage.ts
 *
 * Hook orquestrador do ciclo de vida, filtros, seleções e ações da página de Catálogo.
 */

import { useState, useMemo, useCallback } from 'react';
import type { CatalogProduct, FilterStatus, AITone, ProductStatus, EcomPlatform } from '../types';
import type { AlertVariant } from '@/components/ui/feedback/Alert';
import { useProducts } from './useProducts';
import { useProductSync } from './useProductSync';

export interface CatalogAlert {
  variant: AlertVariant;
  title?: string;
  message: string;
}

/**
 * Normaliza a string de status vinda do backend para o union type ProductStatus da UI.
 */
function normalizeBackendStatus(statusStr?: string): ProductStatus {
  if (!statusStr) return 'RAW';
  const upper = statusStr.toUpperCase();
  if (upper === 'PROCESSED' || upper === 'EXPORTED') return 'PROCESSED';
  if (upper === 'PROCESSING') return 'PROCESSING';
  if (upper === 'FAILED') return 'FAILED';
  return 'RAW';
}

export function useCatalogPage() {
  const {
    products: apiProducts,
    isLoading: isApiLoading,
    refetch,
    deleteProduct: apiDeleteProduct,
    updateProduct: apiUpdateProduct,
  } = useProducts(50);

  // Overrides locais para atualizações otimistas e SKUs deletados
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<CatalogProduct>>>({});
  const [deletedSkus, setDeletedSkus] = useState<string[]>([]);
  const [alertInfo, setAlertInfo] = useState<CatalogAlert | null>(null);
  const clearAlert = useCallback(() => setAlertInfo(null), []);

  // Transforma produtos da Core API durante a renderização (zero cascading render)
  const localCatalogProducts = useMemo<CatalogProduct[]>(() => {
    if (!apiProducts) return [];
    return apiProducts
      .filter((p) => !deletedSkus.includes(p.sku))
      .map((p, idx) => {
        const rawPlatform = (p.attributes?.platform as string) || (p.sku.startsWith('NUV') ? 'Nuvemshop' : 'Shopify');
        const platform: EcomPlatform = (['Shopify', 'Nuvemshop', 'WooCommerce'].includes(rawPlatform)
          ? rawPlatform
          : 'Shopify') as EcomPlatform;

        const base: CatalogProduct = {
          id: `api-${p.sku}-${idx}`,
          sku: p.sku,
          titleOriginal: p.title || p.sku,
          titleAi: (p.attributes?.title_ai as string) || p.seo_title || p.title || '',
          descriptionAi: p.description || (p.attributes?.description_ai as string) || '',
          thumbnailUrl: (p.images && p.images[0]) || '',
          platform,
          status: normalizeBackendStatus(String(p.status)),
          synced: String(p.status).toUpperCase() === 'EXPORTED',
          createdAt: p.created_at || new Date().toISOString(),
        };

        const override = localOverrides[p.sku];
        return override ? { ...base, ...override } : base;
      });
  }, [apiProducts, deletedSkus, localOverrides]);

  // Estados Reativos dos Filtros e Seleções
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);

  // Estados de Modais & Drawers
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [isIngestionModalOpen, setIsIngestionModalOpen] = useState(false);
  const [isBulkSyncModalOpen, setIsBulkSyncModalOpen] = useState(false);
  const [deletingProductSku, setDeletingProductSku] = useState<string | null>(null);

  // Estados de Loading por ação de linha
  const [regeneratingSku, setRegeneratingSku] = useState<string | null>(null);
  const [isSavingDrawer, setIsSavingDrawer] = useState(false);

  // Filtragem Reativa de Produtos
  const filteredProducts = useMemo(() => {
    return localCatalogProducts.filter((product) => {
      // 1. Filtro por Status
      if (statusFilter !== 'ALL' && product.status !== statusFilter) {
        return false;
      }
      // 2. Filtro por Busca (Título Original, Título IA, SKU, Plataforma)
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchesTitle = product.titleOriginal.toLowerCase().includes(query);
        const matchesTitleAi = product.titleAi.toLowerCase().includes(query);
        const matchesSku = product.sku.toLowerCase().includes(query);
        const matchesPlatform = product.platform.toLowerCase().includes(query);
        return matchesTitle || matchesTitleAi || matchesSku || matchesPlatform;
      }
      return true;
    });
  }, [localCatalogProducts, statusFilter, searchTerm]);

  // Handler de Seleção Individual de Checkbox
  const handleSelectSku = (sku: string, checked: boolean) => {
    if (checked) {
      setSelectedSkus((prev) => [...prev, sku]);
    } else {
      setSelectedSkus((prev) => prev.filter((item) => item !== sku));
    }
  };

  // Handler de Seleção Global (Select All)
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSkus(filteredProducts.map((p) => p.sku));
    } else {
      setSelectedSkus([]);
    }
  };

  // Re-gerar Título por IA
  const handleRegenerateAiTitle = async (product: CatalogProduct) => {
    setRegeneratingSku(product.sku);
    try {
      const newTitleAi = `${product.titleOriginal} — Otimizado IA (${new Date().toLocaleTimeString('pt-BR', { minute: '2-digit', second: '2-digit' })})`;

      // Persiste no backend via PATCH /api/v1/products/{sku}
      await apiUpdateProduct(product.sku, {
        title: product.titleOriginal,
        description: product.descriptionAi,
        status: 'Processed',
        attributes: { title_ai: newTitleAi },
      });

      setLocalOverrides((prev) => ({
        ...prev,
        [product.sku]: { ...prev[product.sku], titleAi: newTitleAi, status: 'PROCESSED' },
      }));
    } catch {
      setAlertInfo({
        variant: 'error',
        title: 'Erro na IA',
        message: `Falha ao re-gerar título por IA para o produto SKU ${product.sku}.`,
      });
    } finally {
      setRegeneratingSku(null);
    }
  };

  // Hook especializado de sincronização individual de produtos
  const { syncingSku, syncProduct } = useProductSync({
    onSyncSuccess: (product, isFallback, message) => {
      setAlertInfo({
        variant: isFallback ? 'warning' : 'success',
        title: isFallback ? 'Fallback para CSV Acionado' : 'Sincronizado!',
        message,
      });
      setLocalOverrides((prev) => ({
        ...prev,
        [product.sku]: { ...prev[product.sku], synced: true, status: 'PROCESSED' },
      }));
    },
    onSyncError: (product, errorDetail) => {
      setAlertInfo({
        variant: 'error',
        title: 'Erro de Sincronização',
        message: `Falha ao sincronizar o produto SKU ${product.sku}: ${errorDetail}`,
      });
    },
  });

  // Sincronizar Produto Individual com Plataforma Backend
  const handleSyncProduct = useCallback(
    async (product: CatalogProduct) => {
      await syncProduct(product);
    },
    [syncProduct]
  );

  // Solicitar Exclusão de Produto (abre modal acessível)
  const promptDeleteProduct = (sku: string) => {
    setDeletingProductSku(sku);
  };

  // Confirmar Exclusão de Produto no Backend
  const confirmDeleteProduct = useCallback(async (sku: string) => {
    try {
      await apiDeleteProduct(sku);
      setDeletedSkus((prev) => [...prev, sku]);
      setSelectedSkus((prev) => prev.filter((item) => item !== sku));
      setDeletingProductSku(null);
      setAlertInfo({
        variant: 'success',
        title: 'Produto Removido',
        message: `O produto SKU ${sku} foi excluído com sucesso do catálogo.`,
      });
    } catch {
      setAlertInfo({
        variant: 'error',
        title: 'Erro ao Remover',
        message: `Falha ao remover o produto SKU ${sku} no servidor.`,
      });
    }
  }, [apiDeleteProduct]);

  // Salvar alterações vindas do Drawer no Backend via PATCH
  const handleSaveDrawer = async (
    sku: string,
    data: { titleAi: string; descriptionAi: string; tone: AITone }
  ) => {
    setIsSavingDrawer(true);
    try {
      await apiUpdateProduct(sku, {
        title: data.titleAi,
        description: data.descriptionAi,
        status: 'Processed',
        attributes: {
          title_ai: data.titleAi,
          description_ai: data.descriptionAi,
          tone: data.tone,
        },
      });

      setLocalOverrides((prev) => ({
        ...prev,
        [sku]: {
          ...prev[sku],
          titleAi: data.titleAi,
          descriptionAi: data.descriptionAi,
          synced: true,
          status: 'PROCESSED',
        },
      }));
    } catch {
      setAlertInfo({
        variant: 'error',
        title: 'Erro ao Salvar',
        message: `Falha ao salvar as alterações do produto SKU ${sku}.`,
      });
    } finally {
      setIsSavingDrawer(false);
      setEditingProduct(null);
    }
  };

  // Exportação em Lote dos Selecionados ou Filtrados
  const handleExportBatch = () => {
    const itemsToExport = selectedSkus.length > 0
      ? localCatalogProducts.filter((p) => selectedSkus.includes(p.sku))
      : filteredProducts;

    if (itemsToExport.length === 0) {
      setAlertInfo({
        variant: 'warning',
        title: 'Exportação Indisponível',
        message: 'Nenhum produto selecionado ou disponível para exportação.',
      });
      return;
    }

    const jsonBlob = new Blob([JSON.stringify(itemsToExport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalogo-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    filteredProducts,
    totalCount: filteredProducts.length,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    selectedSkus,
    handleSelectSku,
    handleSelectAll,
    editingProduct,
    setEditingProduct,
    isIngestionModalOpen,
    openIngestionModal: () => setIsIngestionModalOpen(true),
    closeIngestionModal: () => setIsIngestionModalOpen(false),
    isBulkSyncModalOpen,
    openBulkSyncModal: () => setIsBulkSyncModalOpen(true),
    closeBulkSyncModal: () => setIsBulkSyncModalOpen(false),
    deletingProductSku,
    promptDeleteProduct,
    confirmDeleteProduct,
    cancelDeleteProduct: () => setDeletingProductSku(null),
    regeneratingSku,
    syncingSku,
    isSavingDrawer,
    isApiLoading,
    alertInfo,
    clearAlert,
    handleRegenerateAiTitle,
    handleSyncProduct,
    handleSaveDrawer,
    handleExportBatch,
    refetchCatalog: refetch,
  };
}

export default useCatalogPage;
