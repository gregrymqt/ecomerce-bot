import React, { useState } from 'react';
import {
  Package,
  Globe,
  ShoppingBag,
  Store,
  KeyRound,
  Sparkles,
  Layers,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useProducts } from '../hooks/useProducts';
import { ProductTable } from '../components/ProductTable';
import { ShopifySyncPanel } from '../components/ShopifySyncPanel';
import { NuvemshopSyncPanel } from '../components/NuvemshopSyncPanel';
import { ScraperForm } from '@/features/scraper';
import { AIKeysForm } from '@/features/ai-keys';

export type CatalogTabType = 'products' | 'scraper' | 'shopify' | 'nuvemshop' | 'ai-keys';

interface TabNavItem {
  id: CatalogTabType;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

export const CatalogHubPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CatalogTabType>('products');
  const { products } = useProducts(50);

  const tabs: TabNavItem[] = [
    {
      id: 'products',
      label: 'Catálogo de Produtos',
      subtitle: 'Gerenciar itens extraídos e enriquecidos',
      icon: <Package className="w-5 h-5 flex-shrink-0" />,
      badge: `${products.length}`,
      badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    },
    {
      id: 'scraper',
      label: 'Scraping & Extração',
      subtitle: 'Extrair produtos via URL com IA',
      icon: <Globe className="w-5 h-5 flex-shrink-0" />,
    },
    {
      id: 'shopify',
      label: 'Shopify Sync',
      subtitle: 'Sincronizar via GraphQL ou CSV',
      icon: <ShoppingBag className="w-5 h-5 flex-shrink-0" />,
      badge: 'GraphQL',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      id: 'nuvemshop',
      label: 'Nuvemshop Sync',
      subtitle: 'Sincronizar via API REST ou lote',
      icon: <Store className="w-5 h-5 flex-shrink-0" />,
      badge: 'REST',
      badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
    },
    {
      id: 'ai-keys',
      label: 'Credenciais de IA (BYOK)',
      subtitle: 'Configurar chaves cifradas em AES-256',
      icon: <KeyRound className="w-5 h-5 flex-shrink-0" />,
      badge: 'Segurança',
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header do Hub */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Central do Catálogo E-commerce
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hub unificado para extração via IA, gestão de produtos local e sincronização multi-plataforma.
            </p>
          </div>
        </div>
      </div>

      {/* Grid Principal: Sub-Sidebar Lateral (Desktop) + Conteúdo Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SUB-SIDEBAR NAVEGAÇÃO INTERNA (Mobile Scroll Horizontal + Desktop Vertical Sticky) */}
        <div className="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-20 z-20">
          <nav
            aria-label="Sub-navegação da Central do Catálogo"
            className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none touch-pan-x bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-shrink-0 lg:w-full min-h-[52px] p-3.5 rounded-xl transition-all flex items-center gap-3 text-left group border',
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                      : 'bg-transparent text-slate-700 dark:text-slate-300 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700'
                  )}
                >
                  <div
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-indigo-500'
                    )}
                  >
                    {tab.icon}
                  </div>

                  <div className="flex-1 min-w-[160px] lg:min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-bold truncate">{tab.label}</span>
                      {tab.badge && (
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                            isActive
                              ? 'bg-white/20 text-white'
                              : tab.badgeColor || 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          )}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        'text-[11px] truncate mt-0.5 hidden sm:block',
                        isActive ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'
                      )}
                    >
                      {tab.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* ÁREA DE CONTEÚDO DA ABA ATIVA */}
        <div className="lg:col-span-8 xl:col-span-9 min-w-0">
          {activeTab === 'products' && (
            <div className="animate-in fade-in duration-200">
              <ProductTable />
            </div>
          )}

          {activeTab === 'scraper' && (
            <div className="animate-in fade-in duration-200">
              <ScraperForm />
            </div>
          )}

          {activeTab === 'shopify' && (
            <div className="animate-in fade-in duration-200">
              <ShopifySyncPanel localProducts={products} />
            </div>
          )}

          {activeTab === 'nuvemshop' && (
            <div className="animate-in fade-in duration-200">
              <NuvemshopSyncPanel localProducts={products} />
            </div>
          )}

          {activeTab === 'ai-keys' && (
            <div className="animate-in fade-in duration-200">
              <AIKeysForm />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
