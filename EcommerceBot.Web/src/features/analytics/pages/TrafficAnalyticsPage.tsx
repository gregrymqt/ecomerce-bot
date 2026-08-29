/**
 * src/features/analytics/pages/TrafficAnalyticsPage.tsx
 *
 * Hub Unificado de Analytics & Inteligência de Dados do E-commerce Bot:
 * Aba 1: 🧠 Inteligência de Clientes & Machine Learning (RFM, Churn e LTV com Scikit-Learn)
 * Aba 2: 🎯 Atribuição de Tráfego Pago & Performance de Criativos (tracker.js / UTMs)
 */

import React, { useState } from 'react';
import { BrainCircuit, BarChart3, Loader2 } from 'lucide-react';
import { useTrafficAnalytics } from '../hooks/useTrafficAnalytics';
import {
  MlIntelligenceView,
  TrafficMetricsCards,
  TrackerInstallationCard,
  CreativePerformanceTable,
} from '../components';
import { Alert } from '@/components/ui/feedback/Alert';
import { SEO } from '@/components/common/SEO';
import { cn } from '@/lib/utils';

type ActiveTab = 'ml_intelligence' | 'traffic_attribution';

export const TrafficAnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('ml_intelligence');

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
  } = useTrafficAnalytics(activeTab === 'traffic_attribution');

  return (
    <div className="min-h-screen bg-[#090D16] text-white p-4 sm:p-8 space-y-8 selection:bg-purple-500 selection:text-white">
      <SEO
        title="Hub de Analytics & Inteligência de Clientes"
        description="Machine Learning preditivo (RFM, Churn, LTV) e atribuição de tráfego pago da sua loja virtual."
      />

      {/* Cabeçalho Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Analytics Hub
            </span>
            <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400 border border-purple-500/20">
              INTELIGÊNCIA & DADOS
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Central de Inteligência de Negócio
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Modelos de IA preditiva para retenção de clientes e rastreamento de conversões de anúncios.
          </p>
        </div>

        {/* Abas de Navegação Superiores com Touch Targets >= 44px */}
        <div className="flex items-center bg-[#15121B] border border-[#1E293B] rounded-2xl p-1.5 text-xs shadow-xl">
          <button
            type="button"
            onClick={() => setActiveTab('ml_intelligence')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer min-h-[44px]',
              activeTab === 'ml_intelligence'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <BrainCircuit className="h-4 w-4" />
            <span>Inteligência ML (RFM / Churn / LTV)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('traffic_attribution')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer min-h-[44px]',
              activeTab === 'traffic_attribution'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Atribuição de Tráfego & Ads</span>
          </button>
        </div>
      </div>

      {/* Renderização Condicional por Aba */}
      {activeTab === 'ml_intelligence' ? (
        <MlIntelligenceView />
      ) : (
        <div className="space-y-8">
          {/* Seletor de Período de Tráfego com Touch Targets >= 44px */}
          <div className="flex justify-end">
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
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <span className="text-sm font-medium">Carregando métricas de tráfego...</span>
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
      )}
    </div>
  );
};

export default TrafficAnalyticsPage;
