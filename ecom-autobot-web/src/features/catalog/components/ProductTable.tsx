import React, { useState } from 'react';
import { useProducts } from '../hooks/useProducts';
import type { Product } from '../types/product.type';
import { ProductEditModal } from './ProductEditModal';
import { cn } from '@/utils/cn';
import {
  Search,
  Filter,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

export const ProductTable: React.FC = () => {
  const {
    products,
    total,
    page,
    pages,
    statusFilter,
    searchTerm,
    isLoading,
    isUpdating,
    isDeleting,
    error,
    successMessage,
    setPage,
    setSearchTerm,
    setStatusFilter,
    refetch,
    updateProduct,
    deleteProduct,
    clearMessages,
  } = useProducts(10);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingSku, setDeletingSku] = useState<string | null>(null);

  /**
   * Retorna a badge estilizada para cada status do produto.
   */
  const renderStatusBadge = (status: string) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'RAW':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Raw (Bruto)
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            Processando
          </span>
        );
      case 'PROCESSED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
            Enriquecido
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900">
            Falhou
          </span>
        );
      case 'EXPORTED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
            Exportado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  const handleDeleteConfirm = async (sku: string) => {
    if (window.confirm(`Tem certeza que deseja remover o produto com SKU '${sku}'?`)) {
      setDeletingSku(sku);
      await deleteProduct(sku);
      setDeletingSku(null);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Catálogo de Produtos
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {total} {total === 1 ? 'produto encontrado' : 'produtos encontrados'}
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="md:hidden p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Atualizar Tabela"
          >
            <RefreshCw className={cn('w-5 h-5', isLoading && 'animate-spin')} />
          </button>
        </div>

        {/* Inputs de Filtro e Busca */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Busca Textual */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por SKU ou título..."
              className={cn(
                'w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all',
                'text-base sm:text-sm' // PREVINE AUTO-ZOOM NO SAFARI IOS (font-size >= 16px)
              )}
            />
          </div>

          {/* Filtro por Status */}
          <div className="relative sm:w-48">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cn(
                'w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer',
                'text-base sm:text-sm'
              )}
            >
              <option value="">Todos os Status</option>
              <option value="RAW">RAW (Bruto)</option>
              <option value="PROCESSING">PROCESSING (Processando)</option>
              <option value="PROCESSED">PROCESSED (Enriquecido)</option>
              <option value="FAILED">FAILED (Falhou)</option>
              <option value="EXPORTED">EXPORTED (Exportado)</option>
            </select>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="hidden md:flex min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors items-center gap-2 font-medium"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Alertas de Notificação */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={clearMessages} className="text-xs font-semibold underline">
            Fechar
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={clearMessages} className="text-xs font-semibold underline">
            Fechar
          </button>
        </div>
      )}

      {/* Tabela de Produtos */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">Produto</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">Preço</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {isLoading && products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      <span>Carregando produtos do catálogo...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        Nenhum produto encontrado.
                      </p>
                      <p className="text-xs text-slate-400">
                        Tente ajustar os filtros de busca ou execute um scraping.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const firstImage = product.images && product.images.length > 0 ? product.images[0] : null;
                  const priceFormatted =
                    product.price !== undefined && product.price !== null
                      ? `R$ ${Number(product.price).toFixed(2)}`
                      : 'N/A';

                  return (
                    <tr
                      key={product.sku}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Coluna Produto (Imagem + Título) */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {firstImage ? (
                              <img
                                src={firstImage}
                                alt={product.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="max-w-xs sm:max-w-md">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                              {product.title}
                            </span>
                            {product.seo_title && (
                              <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                SEO: {product.seo_title}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Coluna SKU */}
                      <td className="px-6 py-4 font-mono text-xs font-medium text-slate-600 dark:text-slate-400">
                        {product.sku}
                      </td>

                      {/* Coluna Preço */}
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                        {priceFormatted}
                      </td>

                      {/* Coluna Status */}
                      <td className="px-6 py-4">{renderStatusBadge(String(product.status))}</td>

                      {/* Coluna Ações */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingProduct(product)}
                            className="min-h-[44px] px-3 py-2 rounded-xl text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                            title="Editar Produto"
                          >
                            <Edit2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Editar</span>
                          </button>

                          <button
                            onClick={() => handleDeleteConfirm(product.sku)}
                            disabled={isDeleting && deletingSku === product.sku}
                            className="min-h-[44px] px-3 py-2 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50"
                            title="Excluir Produto"
                          >
                            {isDeleting && deletingSku === product.sku ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline">Excluir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé e Paginação */}
        {pages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Página <span className="font-semibold text-slate-700 dark:text-slate-200">{page}</span> de{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">{pages}</span> (Total:{' '}
              {total})
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || isLoading}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>

              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= pages || isLoading}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edição de Produto */}
      <ProductEditModal
        isOpen={!!editingProduct}
        product={editingProduct}
        isLoading={isUpdating}
        onClose={() => setEditingProduct(null)}
        onSave={updateProduct}
      />
    </div>
  );
};
