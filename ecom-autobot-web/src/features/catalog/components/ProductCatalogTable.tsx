import React from 'react';
import {
  Sparkles,
  Edit3,
  Trash2,
  Package,
  Loader2,
  Zap,
} from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { cn } from '@/utils/cn';
import type { CatalogProduct, ProductStatus } from '../types/catalog.types';
import { sanitizeImageUrl } from '@/utils/security';

export interface ProductCatalogTableProps {
  products: CatalogProduct[];
  selectedSkus: string[];
  onSelectSku: (sku: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onEditProduct?: (product: CatalogProduct) => void;
  onRegenerateAiTitle?: (product: CatalogProduct) => void;
  onSyncProduct?: (product: CatalogProduct) => void;
  onDeleteProduct?: (sku: string) => void;
  isLoading?: boolean;
  regeneratingSku?: string | null;
  syncingSku?: string | null;
  deletingSku?: string | null;
}

export const ProductCatalogTable: React.FC<ProductCatalogTableProps> = ({
  products,
  selectedSkus,
  onSelectSku,
  onSelectAll,
  onEditProduct,
  onRegenerateAiTitle,
  onSyncProduct,
  onDeleteProduct,
  isLoading = false,
  regeneratingSku = null,
  syncingSku = null,
  deletingSku = null,
}) => {
  const isAllSelected =
    products.length > 0 && products.every((p) => selectedSkus.includes(p.sku));
  const isSomeSelected =
    products.some((p) => selectedSkus.includes(p.sku)) && !isAllSelected;

  /**
   * Badge de Status com pulso animado em processamento
   */
  const renderStatusBadge = (status: ProductStatus) => {
    switch (status) {
      case 'PROCESSED':
        return (
          <Badge variant="success" dot>
            Enriquecido
          </Badge>
        );
      case 'PROCESSING':
        return (
          <Badge variant="warning" dot>
            Processando
          </Badge>
        );
      case 'RAW':
        return (
          <Badge variant="default" dot>
            RAW (Bruto)
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="error" dot>
            Falhou
          </Badge>
        );
      default:
        return (
          <Badge variant="default">
            {status}
          </Badge>
        );
    }
  };

  /**
   * Badge da Plataforma (Shopify / Nuvemshop / WooCommerce)
   */
  const renderPlatformBadge = (platform: CatalogProduct['platform']) => {
    const variantMap: Record<string, 'success' | 'info' | 'purple'> = {
      Shopify: 'success',
      Nuvemshop: 'info',
      WooCommerce: 'purple',
    };

    return (
      <Badge variant={variantMap[platform] || 'default'}>
        {platform}
      </Badge>
    );
  };

  return (
    <div className="w-full bg-[#15121B] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-[#090D16]/80 text-slate-400 text-xs font-semibold uppercase tracking-wider font-mono">
              {/* Checkbox de Seleção Global */}
              <th className="px-4 py-4 w-12 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isSomeSelected;
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-900 cursor-pointer"
                  title="Selecionar Todos"
                />
              </th>
              <th className="px-5 py-4 font-mono uppercase">Produto</th>
              <th className="px-5 py-4 font-mono uppercase">Título Magnético (IA)</th>
              <th className="px-5 py-4 font-mono uppercase">Status IA</th>
              <th className="px-5 py-4 font-mono uppercase">Plataforma / Sync</th>
              <th className="px-5 py-4 text-right font-mono uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {isLoading && products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                    <span className="text-sm font-medium font-mono">Carregando catálogo de produtos...</span>
                  </div>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-slate-500">
                      <Package className="w-10 h-10" />
                    </div>
                    <p className="font-semibold text-slate-200 text-base">
                      Nenhum produto encontrado
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Não encontramos produtos para o filtro selecionado. Tente alterar a busca ou importar novas URLs.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const isSelected = selectedSkus.includes(product.sku);
                const isRegenerating = regeneratingSku === product.sku;
                const isSyncing = syncingSku === product.sku;
                const isDeleting = deletingSku === product.sku;

                return (
                  <tr
                    key={product.sku}
                    className={cn(
                      'hover:bg-slate-900/40 transition-colors',
                      isSelected && 'bg-violet-950/20'
                    )}
                  >
                    {/* Checkbox Individual */}
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelectSku(product.sku, e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-900 cursor-pointer"
                      />
                    </td>

                    {/* Coluna 1: Produto (Thumb, Nome Original, SKU, Badge Plataforma) */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {sanitizeImageUrl(product.thumbnailUrl) ? (
                            <img
                              src={sanitizeImageUrl(product.thumbnailUrl)!}
                              alt={product.titleOriginal}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-slate-600" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 max-w-xs sm:max-w-sm">
                          <span className="font-semibold text-slate-100 line-clamp-1 text-sm">
                            {product.titleOriginal || 'Sem Título Original'}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-xs text-slate-400">
                              SKU: {product.sku}
                            </span>
                            {renderPlatformBadge(product.platform)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Coluna 2: Título Magnético (IA) + Botão Sparkles Re-gerar */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 max-w-sm">
                        <span className="text-slate-200 font-medium line-clamp-2 text-sm leading-snug">
                          {product.titleAi || (
                            <span className="text-slate-500 italic">Pendente de enriquecimento</span>
                          )}
                        </span>
                        {onRegenerateAiTitle && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRegenerateAiTitle(product)}
                            disabled={isRegenerating}
                            title="Re-gerar Título com IA"
                            className="text-violet-400 hover:text-violet-300 hover:bg-violet-950/50 p-2"
                          >
                            {isRegenerating ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>

                    {/* Coluna 3: Status IA */}
                    <td className="px-5 py-4">{renderStatusBadge(product.status)}</td>

                    {/* Coluna 4: Plataforma / Sync */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {product.synced ? (
                          <Badge variant="success" dot>
                            Sincronizado
                          </Badge>
                        ) : (
                          <Badge variant="warning" dot>
                            Pendente Sync
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Coluna 5: Ações Rápida (Editar, Sincronizar, Excluir) */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onEditProduct && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditProduct(product)}
                            title="Editar Copy / Produto"
                            className="text-slate-300 hover:text-violet-300 hover:bg-violet-950/40 p-2"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                        )}

                        {onSyncProduct && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSyncProduct(product)}
                            disabled={isSyncing}
                            title="Sincronizar com Plataforma"
                            className="text-slate-300 hover:text-emerald-300 hover:bg-emerald-950/40 p-2"
                          >
                            {isSyncing ? (
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                            ) : (
                              <Zap className="w-4 h-4 text-emerald-400" />
                            )}
                          </Button>
                        )}

                        {onDeleteProduct && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteProduct(product.sku)}
                            disabled={isDeleting}
                            title="Excluir Produto"
                            className="text-slate-400 hover:text-red-400 hover:bg-red-950/40 p-2"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

