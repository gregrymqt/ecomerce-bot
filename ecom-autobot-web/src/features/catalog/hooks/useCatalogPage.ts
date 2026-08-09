import { useState, useMemo, useEffect } from 'react';
import type { CatalogProduct, FilterStatus, AITone, ProductStatus, EcomPlatform } from '@/features/catalog';
import type { AlertVariant } from '@/components/ui/feedback/Alert';
import { useProducts } from './useProducts';
import { productService } from '@/features/catalog';

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

  // Estado dos produtos do catálogo
  const [localCatalogProducts, setLocalCatalogProducts] = useState<CatalogProduct[]>([]);

  // Estado de Alerta Customizado para UI Feedback
  const [alertInfo, setAlertInfo] = useState<CatalogAlert | null>(null);

  const clearAlert = () => setAlertInfo(null);

  // Sincroniza produtos vindos da API FastAPI (`/api/v1/products`) quando retornados do backend
  useEffect(() => {
    if (apiProducts) {
      const mapped: CatalogProduct[] = apiProducts.map((p, idx) => {
        const rawPlatform = (p.attributes?.platform as string) || (p.sku.startsWith('NUV') ? 'Nuvemshop' : 'Shopify');
        const platform: EcomPlatform = (['Shopify', 'Nuvemshop', 'WooCommerce'].includes(rawPlatform)
          ? rawPlatform
          : 'Shopify') as EcomPlatform;

        return {
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
      });
      setLocalCatalogProducts(mapped);
    }
  }, [apiProducts]);

  // Estados Reativos dos Filtros e Seleções
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);

  // Estados de Modais & Drawers
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [isIngestionModalOpen, setIsIngestionModalOpen] = useState(false);

  // Estados de Loading por ação de linha
  const [regeneratingSku, setRegeneratingSku] = useState<string | null>(null);
  const [syncingSku, setSyncingSku] = useState<string | null>(null);
  const [deletingSku, setDeletingSku] = useState<string | null>(null);
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

      setLocalCatalogProducts((prev) =>
        prev.map((p) => {
          if (p.sku === product.sku) {
            return {
              ...p,
              titleAi: newTitleAi,
              status: 'PROCESSED',
            };
          }
          return p;
        })
      );
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

  // Sincronizar Produto Individual com Plataforma Backend (Shopify GraphQL ou Nuvemshop REST)
  const handleSyncProduct = async (product: CatalogProduct) => {
    setSyncingSku(product.sku);
    try {
      const payload = {
        sku: product.sku,
        title: product.titleAi || product.titleOriginal,
        description: product.descriptionAi,
        images: product.thumbnailUrl ? [product.thumbnailUrl] : [],
      };

      if (product.platform === 'Nuvemshop') {
        await productService.syncToNuvemshop(payload);
      } else {
        await productService.syncToShopify(payload);
      }

      setLocalCatalogProducts((prev) =>
        prev.map((p) => {
          if (p.sku === product.sku) {
            return { ...p, synced: true, status: 'PROCESSED' };
          }
          return p;
        })
      );
    } catch {
      setAlertInfo({
        variant: 'error',
        title: 'Erro de Sincronização',
        message: `Falha ao sincronizar o produto SKU ${product.sku} com a plataforma.`,
      });
    } finally {
      setSyncingSku(null);
    }
  };

  // Excluir Produto no Backend
  const handleDeleteProduct = async (sku: string) => {
    if (window.confirm(`Tem certeza que deseja remover o produto SKU ${sku}?`)) {
      setDeletingSku(sku);
      try {
        await apiDeleteProduct(sku);
        setLocalCatalogProducts((prev) => prev.filter((p) => p.sku !== sku));
        setSelectedSkus((prev) => prev.filter((item) => item !== sku));
      } catch {
        setAlertInfo({
          variant: 'error',
          title: 'Erro ao Remover',
          message: `Falha ao remover o produto SKU ${sku} no servidor.`,
        });
      } finally {
        setDeletingSku(null);
      }
    }
  };

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

      setLocalCatalogProducts((prev) =>
        prev.map((p) => {
          if (p.sku === sku) {
            return {
              ...p,
              titleAi: data.titleAi,
              descriptionAi: data.descriptionAi,
              synced: true,
              status: 'PROCESSED',
            };
          }
          return p;
        })
      );
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
    regeneratingSku,
    syncingSku,
    deletingSku,
    isSavingDrawer,
    isApiLoading,
    alertInfo,
    clearAlert,
    handleRegenerateAiTitle,
    handleSyncProduct,
    handleDeleteProduct,
    handleSaveDrawer,
    handleExportBatch,
    refetchCatalog: refetch,
  };
}
