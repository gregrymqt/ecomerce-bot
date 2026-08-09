/**
 * src/features/dashboard/pages/DashboardPage.tsx
 *
 * Página Principal do Dashboard & Telemetria.
 * Layout Synthetica Dark (#090D16) responsivo com KPIs, gráfico de volume, atividades dos robôs, telemetria de tokens e saúde.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Zap,
  Download,
  Key,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useDashboard } from '@/features/dashboard';
import { DashboardKpiGrid } from '@/features/dashboard';
import { VolumePerformanceChart } from '@/features/dashboard';
import { RecentActivityTable } from '@/features/dashboard';
import { TokenTelemetryCard } from '@/features/dashboard';
import { SystemHealthWidget } from '@/features/dashboard';
import { AiKeysModal } from '@/features/ai-keys';
import { SEO } from '@/components/common/SEO';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    data,
    period,
    loading,
    refreshing,
    error,
    setError,
    handlePeriodChange,
    refreshActivities,
    formatLastUpdated,
  } = useDashboard('WEEK');

  const [isAiKeysOpen, setIsAiKeysOpen] = useState(false);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 px-4 sm:px-6 text-slate-100 animate-in fade-in duration-300">
      <SEO
        title="Dashboard & Telemetria"
        description="Painel de controle do E-Commerce AutoBot. Acompanhe métricas de ingestão, uso de tokens de IA e saúde do sistema."
      />
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-400 mb-1">
            <LayoutDashboard className="h-4 w-4" />
            <span>Painel Principal & Telemetria IA</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Dashboard & Telemetria
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Acompanhe a performance de ingestão, modelo de IA ativado e economia do tenant.
          </p>
        </div>

        {/* Ações Rápidas no Header (min-h-[44px]) */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/demo')}
            className="min-h-[44px] h-11 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-violet-600/20 flex items-center gap-2 cursor-pointer"
          >
            <Zap className="h-4 w-4" />
            <span>Novo Scraping</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/catalog')}
            className="min-h-[44px] h-11 px-4 rounded-xl bg-[#15121B] hover:bg-[#1E293B] border border-[#1E293B] text-slate-200 text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="h-4 w-4 text-emerald-400" />
            <span>Exportar Catálogo</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAiKeysOpen(true)}
            className="min-h-[44px] h-11 px-4 rounded-xl bg-[#15121B] hover:bg-[#1E293B] border border-[#1E293B] text-slate-200 text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer"
          >
            <Key className="h-4 w-4 text-purple-400" />
            <span>AI Keys (BYOK)</span>
          </button>
        </div>
      </div>

      {/* Alerta de Erro */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-bold underline hover:text-white cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Status da Engine & Atualização */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 font-bold text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
            AI Engine Active (DeepSeek + Groq)
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span>Última atualização: {formatLastUpdated()}</span>
          {refreshing && <RefreshCw className="h-3.5 w-3.5 text-violet-400 animate-spin" />}
        </div>
      </div>

      {/* 1. Grid de 4 KPIs Superiores */}
      <section>
        <DashboardKpiGrid metrics={data?.kpis} loading={loading} />
      </section>

      {/* 2. Grid de 2 Colunas no Desktop (lg:grid-cols-12) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Coluna Principal Esquerda (7 cols) */}
        <div className="lg:col-span-7 space-y-8">
          {/* Gráfico de Ingestão e Processamento */}
          <VolumePerformanceChart
            items={data?.chart_data}
            period={period}
            onPeriodChange={handlePeriodChange}
            loading={loading}
          />

          {/* Tabela de Atividades Recentes dos Robôs */}
          <RecentActivityTable
            activities={data?.recent_activities}
            loading={loading}
            onRefresh={refreshActivities}
          />
        </div>

        {/* Coluna Direita (5 cols) */}
        <div className="lg:col-span-5 space-y-8">
          {/* Widget de Telemetria de Tokens BYOK */}
          <TokenTelemetryCard
            providers={data?.token_telemetry}
            averageLatencyMs={data?.average_latency_ms}
          />

          {/* Widget de Saúde dos Microsserviços */}
          <SystemHealthWidget healthItems={data?.system_health} />
        </div>
      </section>

      {/* Modal de Gestão de Chaves de IA (BYOK) */}
      <AiKeysModal isOpen={isAiKeysOpen} onClose={() => setIsAiKeysOpen(false)} />
    </div>
  );
};

export default DashboardPage;
