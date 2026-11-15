/**
 * src/features/analytics/pages/TrafficAnalyticsPage.tsx
 *
 * Hub de Atribuição de Tráfego Pago & Performance de Criativos (tracker.js / UTMs)
 */

import React from 'react';
import { Skeleton } from '@/components/ui/feedback/Skeleton';
import { useTrafficAnalytics } from '../hooks/useTrafficAnalytics';
import {
  TrafficMetricsCards,
  TrackerInstallationCard,
  CreativePerformanceTable,
} from '../components';
import { Alert } from '@/components/ui/feedback/Alert';
import { SEO } from '@/components/common/SEO';
import { cn } from '@/lib/utils';

export const TrafficAnalyticsPage: React.FC = () => {
  const {
    days,
    setDays,
    loadingTraffic,
    overview,
    error,
    trackerSnippet,
    isCopied,
    storeUrlInput,
    setStoreUrlInput,
    verifyingTag,
    tagStatus,
    tagError,
    handleCopySnippet,
    handleVerifyTag,
  } = useTrafficAnalytics();

  return (
    <div className="min-h-screen bg-[#090D16] text-white p-4 sm:p-8 space-y-8 selection:bg-purple-500 selection:text-white">
      <SEO
        title="Atribuição de Tráfego & Performance de Ads"
        description="Atribuição de tráfego pago e rastreamento de conversões de anúncios da sua loja virtual."
      />

      {/* Cabeçalho Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Analytics Hub
            </span>
            <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400 border border-purple-500/20">
              ATRIBUIÇÃO & TRÁFEGO
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Atribuição de Tráfego & Ads
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Rastreamento de conversões, campanhas e desempenho de criativos da sua loja virtual.
          </p>
        </div>

        {/* Seletor de Período de Tráfego com Touch Targets >= 44px */}
        <div className="flex items-center bg-[#15121B] border border-[#1E293B] rounded-xl p-1 text-xs">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={cn(
                'px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer min-h-[44px]',
                days === d
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {/* 1. Card de Onboarding & Instalação do tracker.js */}
        <TrackerInstallationCard
          trackerSnippet={trackerSnippet}
          isCopied={isCopied}
          onCopySnippet={handleCopySnippet}
          storeUrlInput={storeUrlInput}
          setStoreUrlInput={setStoreUrlInput}
          onVerifyTag={handleVerifyTag}
          verifyingTag={verifyingTag}
          tagStatus={tagStatus}
          tagError={tagError}
        />

        {error && (
          <Alert variant="error" title="Erro ao carregar dados">
            {error}
          </Alert>
        )}

        {loadingTraffic ? (
          <div className="space-y-6 animate-pulse" role="region" aria-label="Carregando métricas de tráfego">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`kpi-skel-${i}`} className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-8 w-32 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              ))}
            </div>
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
              <Skeleton className="h-6 w-48 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
          </div>
        ) : (
          <>
            {/* 2. Cards de KPIs de Tráfego */}
            <TrafficMetricsCards overview={overview} />

            {/* 3. Tabela de Faturamento por Criativo */}
            <CreativePerformanceTable creatives={overview?.creatives} />
          </>
        )}
      </div>
    </div>
  );
};

export default TrafficAnalyticsPage;
