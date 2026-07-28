import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Edit3,
  Trash2,
  Package,
  Loader2,
  Zap,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { CatalogProduct, ProductStatus } from '../types/catalog.types';

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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Enriquecido
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Processando
          </span>
        );
      case 'RAW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            RAW (Bruto)
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-300 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Falhou
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400">
            {status}
          </span>
        );
    }
  };

  /**
   * Badge da Plataforma (Shopify / Nuvemshop / WooCommerce)
   */
  const renderPlatformBadge = (platform: CatalogProduct['platform']) => {
    const badgeColors: Record<string, string> = {
      Shopify: 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40',
      Nuvemshop: 'bg-blue-950/50 text-blue-400 border-blue-800/40',
      WooCommerce: 'bg-purple-950/50 text-purple-400 border-purple-800/40',
    };

    return (
      <span
        className={cn(
          'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border',
          badgeColors[platform] || 'bg-slate-800 text-slate-300 border-slate-700'
        )}
      >
        {platform}
      </span>
    );
  };

  return (
    <div className="w-full bg-[#15121B] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-[#090D16]/80 text-slate-400 text-xs font-semibold uppercase tracking-wider">
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
              <th className="px-5 py-4">Produto</th>
              <th className="px-5 py-4">Título Magnético (IA)</th>
              <th className="px-5 py-4">Status IA</th>
              <th className="px-5 py-4">Plataforma / Sync</th>
              <th className="px-5 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {isLoading && products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                    <span className="text-sm font-medium">Carregando catálogo de produtos...</span>
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
                          {product.thumbnailUrl ? (
                            <img
                              src={product.thumbnailUrl}
                              alt={product.titleOriginal}
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
                          <button
                            onClick={() => onRegenerateAiTitle(product)}
                            disabled={isRegenerating}
                            title="Re-gerar Título com IA"
                            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-violet-400 hover:text-violet-300 hover:bg-violet-950/50 border border-transparent hover:border-violet-800/40 transition-all flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                          >
                            {isRegenerating ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Coluna 3: Status IA */}
                    <td className="px-5 py-4">{renderStatusBadge(product.status)}</td>

                    {/* Coluna 4: Plataforma / Sync */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {product.synced ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 className="w-4 h-4" />
                            Sincronizado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                            <Clock className="w-4 h-4" />
                            Pendente Sync
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Coluna 5: Ações Rápida (Editar, Sincronizar, Excluir) */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onEditProduct && (
                          <button
                            onClick={() => onEditProduct(product)}
                            title="Editar Copy / Produto"
                            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-slate-300 hover:text-violet-300 hover:bg-violet-950/40 border border-transparent hover:border-violet-800/30 transition-colors flex items-center justify-center"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {onSyncProduct && (
                          <button
                            onClick={() => onSyncProduct(product)}
                            disabled={isSyncing}
                            title="Sincronizar com Plataforma"
                            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-slate-300 hover:text-emerald-300 hover:bg-emerald-950/40 border border-transparent hover:border-emerald-800/30 transition-colors flex items-center justify-center disabled:opacity-50"
                          >
                            {isSyncing ? (
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                            ) : (
                              <Zap className="w-4 h-4 text-emerald-400" />
                            )}
                          </button>
                        )}

                        {onDeleteProduct && (
                          <button
                            onClick={() => onDeleteProduct(product.sku)}
                            disabled={isDeleting}
                            title="Excluir Produto"
                            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-800/30 transition-colors flex items-center justify-center disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
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
