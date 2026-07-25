import React, { useState } from 'react';
import { useShopify } from '../hooks/useShopify';
import type { Product } from '../types/product.type';
import { cn } from '@/utils/cn';
import {
  ShoppingBag,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Loader2,
  Trash2,
  KeyRound,
  FileSpreadsheet,
} from 'lucide-react';

interface ShopifySyncPanelProps {
  localProducts?: Product[];
}

export const ShopifySyncPanel: React.FC<ShopifySyncPanelProps> = ({ localProducts = [] }) => {
  const {
    remoteProducts,
    pageInfo,
    loading,
    syncingSku,
    error,
    credentialsMissing,
    fetchRemoteProducts,
    syncProduct,
    deleteProduct,
  } = useShopify();

  const [fallbackCsvUrl, setFallbackCsvUrl] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'remote' | 'sync_local'>('sync_local');

  /**
   * Dispara a sincronização de um produto local específico para a Shopify.
   */
  const handleSyncLocalProduct = async (product: Product) => {
    setFallbackCsvUrl(null);
    setFallbackMessage(null);
    setSuccessMsg(null);

    try {
      const response = await syncProduct({
        sku: product.sku,
        title: product.title,
        description: product.description || product.copywriting || '',
        price: typeof product.price === 'number' ? product.price : parseFloat(String(product.price || 0)),
        tags: product.tags || [],
        seo_title: product.seo_title || undefined,
        seo_description: product.seo_description || undefined,
        images: product.images || [],
      });

      // Trata o caso de Fallback CSV (HTTP 202)
      if (response.status === 'fallback_csv' && response.download_url) {
        setFallbackCsvUrl(response.download_url);
        setFallbackMessage(
          response.message ||
            'Não foi possível sincronizar diretamente via API GraphQL. Geramos um arquivo CSV otimizado para importação manual no painel Shopify.'
        );
      } else {
        setSuccessMsg(
          `Produto '${product.title}' (SKU: ${product.sku}) sincronizado com sucesso na sua loja Shopify!`
        );
      }
    } catch (err: any) {
      // O erro já é tratado e populado pelo useShopify hook
    }
  };

  /**
   * Remove um produto da loja remota Shopify
   */
  const handleDeleteRemote = async (productId: string, title: string) => {
    if (window.confirm(`Tem certeza que deseja remover o produto "${title}" da sua loja Shopify?`)) {
      try {
        await deleteProduct(productId);
        setSuccessMsg(`Produto "${title}" removido da Shopify.`);
      } catch (err) {
        // Erro gerenciado pelo hook
      }
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header do Painel Shopify */}
      <div className="bg-gradient-to-r from-emerald-900/10 via-slate-900 to-slate-900 p-6 rounded-2xl border border-emerald-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500 border border-emerald-500/20">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Integração Shopify GraphQL
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                productSet v2
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sincronize produtos enriquecidos diretamente com sua loja Shopify ou baixe planilhas de importação rápida CSV.
            </p>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('sync_local')}
            className={cn(
              'min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2',
              activeTab === 'sync_local'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            Sincronizar Locais ({localProducts.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('remote');
              if (remoteProducts.length === 0) fetchRemoteProducts();
            }}
            className={cn(
              'min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2',
              activeTab === 'remote'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            Produtos na Shopify
          </button>
        </div>
      </div>

      {/* CARD DE AVISO: Credenciais Ausentes (HTTP 412) */}
      {credentialsMissing && (
        <div className="p-6 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-xl flex-shrink-0 mt-0.5 sm:mt-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
                Credenciais da Shopify Não Encontradas
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Para utilizar a sincronização automática via API GraphQL, você precisa cadastrar o token de acesso e o domínio da sua loja em <strong>Credenciais de Integrações</strong>.
              </p>
            </div>
          </div>

          <a
            href="/credentials"
            className="min-h-[44px] px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-md shadow-amber-600/20 flex items-center gap-2 whitespace-nowrap"
          >
            Cadastrar Credenciais
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* CARD DE AVISO: Fallback CSV Gerado (HTTP 202) */}
      {fallbackCsvUrl && (
        <div className="p-6 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl flex-shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-blue-900 dark:text-blue-200">
                Planilha CSV de Importação Gerada com Sucesso
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                {fallbackMessage}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <a
              href={fallbackCsvUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Baixar Arquivo CSV da Shopify
            </a>
          </div>
        </div>
      )}

      {/* Alerta de Sucesso Padrão */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Alerta de Erro */}
      {error && !credentialsMissing && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ABA 1: Sincronização de Produtos Locais para Shopify */}
      {activeTab === 'sync_local' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Produtos Locais Prontos para Envio
            </h3>
            <span className="text-xs text-slate-500">
              {localProducts.length} itens no catálogo
            </span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {localProducts.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <ShoppingBag className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  Nenhum produto local encontrado.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Execute o scraping ou cadastramento no catálogo para enviar à Shopify.
                </p>
              </div>
            ) : (
              localProducts.map((product) => {
                const isSyncing = syncingSku === product.sku;

                return (
                  <div
                    key={product.sku}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={product.images[0]}
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ShoppingBag className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                          {product.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                          <span>SKU: {product.sku}</span>
                          <span>•</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {product.price ? `R$ ${Number(product.price).toFixed(2)}` : 'R$ 0.00'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSyncLocalProduct(product)}
                      disabled={isSyncing || credentialsMissing}
                      className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Enviar para Shopify
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ABA 2: Listagem de Produtos Remotos da Shopify (GraphQL) */}
      {activeTab === 'remote' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Produtos Publicados na Sua Loja Shopify
            </h3>

            <button
              onClick={() => fetchRemoteProducts()}
              disabled={loading || credentialsMissing}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              Atualizar Lista
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">Título no Shopify</th>
                  <th className="px-6 py-4">GID (ID GraphQL)</th>
                  <th className="px-6 py-4">Vendor / Marca</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {loading && remoteProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                        <span>Carregando catálogo diretamente da Shopify...</span>
                      </div>
                    </td>
                  </tr>
                ) : remoteProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        Nenhum produto remoto encontrado na Shopify.
                      </p>
                    </td>
                  </tr>
                ) : (
                  remoteProducts.map(({ node }) => (
                    <tr
                      key={node.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                        {node.title}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {node.id}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        {node.vendor || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteRemote(node.id, node.title)}
                          disabled={loading}
                          className="min-h-[44px] px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                          title="Excluir da Shopify"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação por Cursor */}
          {pageInfo.hasNextPage && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
              <button
                onClick={() => fetchRemoteProducts(pageInfo.endCursor)}
                disabled={loading}
                className="min-h-[44px] px-5 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Carregar Mais Produtos'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
