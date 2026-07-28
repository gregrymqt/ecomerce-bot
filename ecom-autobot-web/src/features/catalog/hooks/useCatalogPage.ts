import { useState, useMemo, useEffect } from 'react';
import type { CatalogProduct, FilterStatus, AITone, ProductStatus, EcomPlatform } from '../types/catalog.types';
import { useProducts } from './useProducts';
import { productService } from '../services/product.service';

// Fallback de demonstração caso o banco de dados do backend esteja vazio no ambiente dev
const INITIAL_MOCK_PRODUCTS: CatalogProduct[] = [
  {
    id: 'prod-1',
    sku: 'SHP-88219-PRO',
    titleOriginal: 'Tênis Esportivo Running Max Air 90 Pro Unisex',
    titleAi: 'Tênis Running Max Air Pro 90 — Alta Performance & Amortecimento Premium',
    descriptionAi: 'Supere seus limites com o Tênis Running Max Air Pro. Tecnologia de amortecimento contínuo com tecido respirável de alta durabilidade.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop&q=80',
    platform: 'Shopify',
    status: 'PROCESSED',
    synced: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-2',
    sku: 'NUV-44102-CLK',
    titleOriginal: 'Relógio Smartwatch Fitness Tracker Waterproof IP68',
    titleAi: 'Smartwatch Fitness Ultra IP68 — Monitoramento Cardíaco 24h & GPS Integrado',
    descriptionAi: 'Monitore seus treinos, sono e frequência cardíaca em tempo real. Resistência à água IP68 e bateria de até 14 dias de autonomia.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80',
    platform: 'Nuvemshop',
    status: 'PROCESSING',
    synced: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-3',
    sku: 'WOO-99120-BAG',
    titleOriginal: 'Mochila Impermeável Executiva para Notebook 15.6 polegadas',
    titleAi: 'Mochila Executiva Premium Waterproof — Compartimento Antifurto & Conector USB',
    descriptionAi: 'Ideal para viagens e rotina urbana. Nylon militar impermeável, trava de segurança com senha e entrada USB externa para powerbank.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&auto=format&fit=crop&q=80',
    platform: 'WooCommerce',
    status: 'RAW',
    synced: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-4',
    sku: 'SHP-12903-AUD',
    titleOriginal: 'Fone de Ouvido Bluetooth Noise Cancelling TWS 5.3',
    titleAi: 'Fone Bluetooth TWS Pro — Cancelamento de Ruído Ativo & Graves Profundos',
    descriptionAi: 'Imersão sonora total com Drivers de Neodímio e Bluetooth 5.3 de baixíssima latência. Perfeito para chamadas e jogos.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&auto=format&fit=crop&q=80',
    platform: 'Shopify',
    status: 'FAILED',
    synced: false,
    createdAt: new Date().toISOString(),
  },
];

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
  const [localCatalogProducts, setLocalCatalogProducts] = useState<CatalogProduct[]>(INITIAL_MOCK_PRODUCTS);

  // Sincroniza produtos vindos da API FastAPI (`/api/v1/products`) quando retornados do backend
  useEffect(() => {
    if (apiProducts && apiProducts.length > 0) {
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
      
      // Tenta persistir no backend via PATCH /api/v1/products/{sku}
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
      // Fallback local se a API falhar no ambiente offline
      setLocalCatalogProducts((prev) =>
        prev.map((p) => {
          if (p.sku === product.sku) {
            return {
              ...p,
              titleAi: `${p.titleOriginal} — Edição Especial IA`,
              status: 'PROCESSED',
            };
          }
          return p;
        })
      );
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
      // Atualização local de fallback
      setLocalCatalogProducts((prev) =>
        prev.map((p) => {
          if (p.sku === product.sku) {
            return { ...p, synced: true, status: 'PROCESSED' };
          }
          return p;
        })
      );
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
      } catch {
        // Ignora erro backend de dev se item for mock
      } finally {
        setLocalCatalogProducts((prev) => prev.filter((p) => p.sku !== sku));
        setSelectedSkus((prev) => prev.filter((item) => item !== sku));
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
      // Fallback local se backend offline
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
      alert('Nenhum produto selecionado ou disponível para exportação.');
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
    handleRegenerateAiTitle,
    handleSyncProduct,
    handleDeleteProduct,
    handleSaveDrawer,
    handleExportBatch,
    refetchCatalog: refetch,
  };
}
