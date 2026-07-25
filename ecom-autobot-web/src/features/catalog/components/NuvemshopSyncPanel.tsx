import React, { useState } from 'react';
import { useNuvemshop } from '../hooks/useNuvemshop';
import type { Product } from '../types/product.type';
import {
  Store,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  KeyRound,
  ShieldAlert,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';

interface NuvemshopSyncPanelProps {
  localProducts?: Product[];
}

export const NuvemshopSyncPanel: React.FC<NuvemshopSyncPanelProps> = ({ localProducts = [] }) => {
  const {
    loading,
    syncingSku,
    error,
    credentialsMissing,
    forbiddenScope,
    syncProduct,
    updateStockPriceBatch,
  } = useNuvemshop();

  const [fallbackCsvUrl, setFallbackCsvUrl] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  /**
   * Sincroniza um produto individual do catálogo local para a Nuvemshop.
   */
  const handleSyncProduct = async (product: Product) => {
    setFallbackCsvUrl(null);
    setFallbackMessage(null);
    setSuccessMsg(null);

    const priceNum =
      typeof product.price === 'number'
        ? product.price
        : parseFloat(String(product.price || 0));

    // Monta o payload de acordo com o esquema da Nuvemshop (localized strings { pt: "..." })
    const payload = {
      tenant_id: product.tenant_id || 'default_tenant',
      name: { pt: product.title },
      description: { pt: product.description || product.copywriting || '' },
      handle: { pt: product.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
      seo_title: product.seo_title ? { pt: product.seo_title } : undefined,
      seo_description: product.seo_description ? { pt: product.seo_description } : undefined,
      published: true,
      requires_shipping: true,
      variants: [
        {
          sku: product.sku,
          price: isNaN(priceNum) ? 0 : priceNum,
          stock: 100, // valor padrão configurável
        },
      ],
      images:
        product.images && product.images.length > 0
          ? product.images.map((imgUrl) => ({ src: imgUrl }))
          : undefined,
    };

    try {
      const response = await syncProduct(payload);

      // Trata a resposta de Fallback CSV (HTTP 202)
      if (response.status === 'fallback_csv' && response.download_url) {
        setFallbackCsvUrl(response.download_url);
        setFallbackMessage(
          response.message ||
            'A API da Nuvemshop apresentou instabilidade temporária. Geramos uma planilha CSV otimizada para você importar manualmente.'
        );
      } else {
        setSuccessMsg(
          `Produto '${product.title}' (SKU: ${product.sku}) criado/atualizado com sucesso na sua loja Nuvemshop!`
        );
      }
    } catch (err) {
      // Erro gerenciado pelo hook
    }
  };

  /**
   * Exemplo de disparo de ajuste de estoque/preço em lote para variantes ativas.
   */
  const handleBatchSync = async () => {
    if (localProducts.length === 0) return;
    setIsBatchProcessing(true);
    setSuccessMsg(null);

    try {
      const batchItems = localProducts.slice(0, 50).map((p, idx) => ({
        variant_id: idx + 1001, // IDs mockados/mapeados de variantes Nuvemshop
        price: typeof p.price === 'number' ? p.price : parseFloat(String(p.price || 0)),
        stock: 50,
      }));

      await updateStockPriceBatch(batchItems);
      setSuccessMsg(`Ajuste de estoque/preço em lote concluído para ${batchItems.length} itens!`);
    } catch (err) {
      // Erro tratado no hook
    } finally {
      setIsBatchProcessing(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header da Integração Nuvemshop */}
      <div className="bg-gradient-to-r from-blue-900/10 via-slate-900 to-slate-900 p-6 rounded-2xl border border-blue-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 border border-blue-500/20">
            <Store className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Integração Nuvemshop API
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                REST v1
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sincronize seus produtos enriquecidos via IA diretamente com sua loja virtual Nuvemshop ou efetue atualizações de preço e estoque em lote.
            </p>
          </div>
        </div>

        <button
          onClick={handleBatchSync}
          disabled={loading || isBatchProcessing || localProducts.length === 0}
          className="min-h-[44px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isBatchProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processando Lote...
            </>
          ) : (
            <>
              <Layers className="w-4 h-4" />
              Sincronizar Estoque/Preço em Lote
            </>
          )}
        </button>
      </div>

      {/* ALERTA HTTP 412: Credenciais Ausentes */}
      {credentialsMissing && (
        <div className="p-6 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-xl flex-shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
                Credenciais Nuvemshop Não Encontradas (HTTP 412)
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Para autenticar e enviar produtos para a Nuvemshop, cadastre o App ID, User ID e Access Token em <strong>Credenciais de Integrações</strong>.
              </p>
            </div>
          </div>

          <a
            href="/credentials"
            className="min-h-[44px] px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-md shadow-amber-600/20 flex items-center gap-2 whitespace-nowrap"
          >
            Configurar Credenciais
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* ALERTA HTTP 403: Escopo de Permissão Insuficiente (write_products) */}
      {forbiddenScope && (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl flex-shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
                Permissão Negada na Nuvemshop (HTTP 403)
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">
                O token de acesso configurado não possui permissões de escrita (<code>write_products</code>). Por favor, reautorize o app no painel da Nuvemshop.
              </p>
            </div>
          </div>

          <a
            href="/credentials"
            className="min-h-[44px] px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-md shadow-rose-600/20 flex items-center gap-2 whitespace-nowrap"
          >
            Reautorizar App
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* CARD DE FALLBACK CSV (HTTP 202) */}
      {fallbackCsvUrl && (
        <div className="p-6 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl flex-shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-blue-900 dark:text-blue-200">
                Planilha CSV Nuvemshop Gerada para Download (HTTP 202)
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
              Baixar CSV para Importação Nuvemshop
            </a>
          </div>
        </div>
      )}

      {/* Notificação de Sucesso */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Notificação de Erro Padrão */}
      {error && !credentialsMissing && !forbiddenScope && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista de Produtos Locais para Envio à Nuvemshop */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Produtos do Catálogo Prontos para Nuvemshop
          </h3>
          <span className="text-xs text-slate-500">
            {localProducts.length} itens disponíveis
          </span>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {localProducts.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Store className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Nenhum produto cadastrado no catálogo.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Realize a extração ou cadastre produtos para enviar para a Nuvemshop.
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
                        <Store className="w-5 h-5 text-slate-400" />
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                        {product.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                        <span>SKU: {product.sku}</span>
                        <span>•</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {product.price ? `R$ ${Number(product.price).toFixed(2)}` : 'R$ 0.00'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSyncProduct(product)}
                    disabled={isSyncing || credentialsMissing || forbiddenScope}
                    className="min-h-[44px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sincronizando Nuvemshop...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Criar na Nuvemshop
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
