/**
 * src/features/analytics/pages/TrafficAnalyticsPage.tsx
 *
 * Hub Unificado de Analytics & Inteligência de Dados do E-commerce Bot:
 * Aba 1: 🧠 Inteligência de Clientes & Machine Learning (RFM, Churn e LTV com Scikit-Learn)
 * Aba 2: 🎯 Atribuição de Tráfego Pago & Performance de Criativos (tracker.js / UTMs)
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Copy,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Target,
  Sparkles,
  Code2,
  Check,
  BrainCircuit,
  BarChart3
} from 'lucide-react';
import { trafficAnalyticsService, type TenantTrafficOverview, type VerifyTagResponse } from '../services/trafficAnalytics.service';
import { MlIntelligenceView } from '../components/MlIntelligenceView';
import { cn } from '@/lib/utils';
import { SEO } from '@/components/common/SEO';
import { useAuth } from '@/features/auth';

type ActiveTab = 'ml_intelligence' | 'traffic_attribution';

export const TrafficAnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenants?.[0] || 'meu-tenant-id';

  const [activeTab, setActiveTab] = useState<ActiveTab>('ml_intelligence');
  const [days, setDays] = useState<number>(30);
  const [loadingTraffic, setLoadingTraffic] = useState<boolean>(true);
  const [overview, setOverview] = useState<TenantTrafficOverview | null>(null);

  // Estado de Cópia e Verificação de Tag
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [storeUrlInput, setStoreUrlInput] = useState<string>('');
  const [verifyingTag, setVerifyingTag] = useState<boolean>(false);
  const [tagStatus, setTagStatus] = useState<VerifyTagResponse | null>(null);

  const trackerSnippet = `<script async src="https://api.ecomautobot.com/tracker.js" data-tenant-id="${tenantId}"></script>`;

  const fetchTrafficData = async () => {
    setLoadingTraffic(true);
    try {
      const res = await trafficAnalyticsService.getTrafficOverview(days);
      setOverview(res);
    } catch (err) {
      console.error('Erro ao buscar métricas de tráfego do lojista:', err);
    } finally {
      setLoadingTraffic(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'traffic_attribution') {
      fetchTrafficData();
    }
  }, [days, activeTab]);

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(trackerSnippet);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch (err) {
      console.error('Erro ao copiar snippet:', err);
    }
  };

  const handleVerifyTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeUrlInput.trim()) return;

    setVerifyingTag(true);
    try {
      const res = await trafficAnalyticsService.verifyStoreTag(storeUrlInput.trim());
      setTagStatus(res);
    } catch (err) {
      console.error('Erro ao verificar tag da loja:', err);
    } finally {
      setVerifyingTag(false);
    }
  };

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

        {/* Abas de Navegação Superiores */}
        <div className="flex items-center bg-[#15121B] border border-[#1E293B] rounded-2xl p-1.5 text-xs shadow-xl">
          <button
            type="button"
            onClick={() => setActiveTab('ml_intelligence')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer min-h-[40px]',
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
              'flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all cursor-pointer min-h-[40px]',
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

      {/* RENDERIZAÇÃO CONDICIONAL POR ABA */}
      {activeTab === 'ml_intelligence' ? (
        <MlIntelligenceView />
      ) : (
        <div className="space-y-8">
          {/* Seletor de Período de Tráfego */}
          <div className="flex justify-end">
            <div className="flex items-center bg-[#15121B] border border-[#1E293B] rounded-xl p-1 text-xs">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer min-h-[36px]',
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

          {/* 1. CARD DE ONBOARDING & INSTALAÇÃO DO TRACKER.JS */}
          <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Code2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Instalar Tag de Rastreamento (tracker.js)</h2>
                  <p className="text-xs text-slate-400">
                    Cole este código no cabeçalho (&lt;head&gt;) da sua loja Shopify ou Nuvemshop para ativar a atribuição.
                  </p>
                </div>
              </div>

              {tagStatus && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border',
                    tagStatus.is_installed
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  )}
                >
                  {tagStatus.is_installed ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                  {tagStatus.is_installed ? 'Tag Ativa' : 'Pendente de Instalação'}
                </span>
              )}
            </div>

            {/* Snippet com Botão de Cópia */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                readOnly
                value={trackerSnippet}
                className="w-full h-11 px-3 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-300 font-mono text-xs truncate focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopySnippet}
                className={cn(
                  'min-h-[44px] h-11 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shrink-0 transition-all cursor-pointer border',
                  isCopied
                    ? 'bg-emerald-500 text-black border-emerald-400'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500'
                )}
              >
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{isCopied ? 'Copiado!' : 'Copiar Tag'}</span>
              </button>
            </div>

            {/* Verificador de Tag */}
            <form onSubmit={handleVerifyTag} className="pt-2 border-t border-[#1E293B] flex flex-col sm:flex-row items-center gap-2">
              <input
                type="url"
                placeholder="https://minhaloja.com.br"
                value={storeUrlInput}
                onChange={(e) => setStoreUrlInput(e.target.value)}
                className="w-full sm:w-80 h-10 px-3 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={verifyingTag || !storeUrlInput.trim()}
                className="w-full sm:w-auto min-h-[40px] h-10 px-4 rounded-xl bg-[#1E293B] hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {verifyingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span>Verificar Instalação</span>
              </button>

              {tagStatus && (
                <span className="text-xs text-slate-400 ml-2">
                  {tagStatus.message}
                </span>
              )}
            </form>
          </div>

          {loadingTraffic ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <span className="text-sm font-medium">Carregando métricas de tráfego...</span>
            </div>
          ) : (
            <>
              {/* 2. CARDS DE KPIS DE TRÁFEGO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
                    <span className="font-semibold uppercase tracking-wider">Vendas com Ads</span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-emerald-400">
                    R$ {(overview?.total_attributed_revenue_brl || 0).toFixed(2).replace('.', ',')}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Receita diretamente atribuída a campanhas
                  </p>
                </div>

                <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
                    <span className="font-semibold uppercase tracking-wider">Pedidos com UTMs</span>
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-white">
                    {overview?.total_tracked_orders || 0}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Conversões registradas via Shopify/Nuvemshop
                  </p>
                </div>

                <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
                    <span className="font-semibold uppercase tracking-wider">Ticket Médio Ads</span>
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Target className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-white">
                    R$ {(overview?.average_ticket_brl || 0).toFixed(2).replace('.', ',')}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Valor médio por compra vinda de anúncios
                  </p>
                </div>

                <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
                    <span className="font-semibold uppercase tracking-wider">Top Canal</span>
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-white truncate">
                    {overview?.top_source || 'Direto / Orgânico'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Origem com maior volume de faturamento
                  </p>
                </div>
              </div>

              {/* 3. TABELA DE FATURAMENTO POR CRIATIVO */}
              <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Faturamento por Criativo de Anúncio</h2>
                  <p className="text-xs text-slate-400">
                    Descubra exatamente quais criativos (ad_id) e vídeos do Meta Ads / Google Ads geraram vendas na sua loja.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#090D16] text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E293B]">
                      <tr>
                        <th className="py-3 px-4">Criativo (ad_id)</th>
                        <th className="py-3 px-4">Campanha</th>
                        <th className="py-3 px-4">Canal</th>
                        <th className="py-3 px-4 text-center">Pedidos</th>
                        <th className="py-3 px-4 text-right">Faturamento Total</th>
                        <th className="py-3 px-4 text-right">Ticket Médio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E293B]">
                      {overview?.creatives && overview.creatives.length > 0 ? (
                        overview.creatives.map((c, idx) => (
                          <tr key={idx} className="hover:bg-[#1E293B]/40 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-indigo-400">{c.ad_id}</td>
                            <td className="py-3 px-4 text-slate-200">{c.campaign}</td>
                            <td className="py-3 px-4 text-slate-400">{c.source}</td>
                            <td className="py-3 px-4 text-center font-semibold text-white">{c.orders_count}</td>
                            <td className="py-3 px-4 text-right font-black text-emerald-400">
                              R$ {c.total_revenue_brl.toFixed(2).replace('.', ',')}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-white">
                              R$ {c.average_ticket_brl.toFixed(2).replace('.', ',')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            Nenhum pedido atribuído a criativo específico ainda. Instale o tracker.js na sua loja para começar a rastrear.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TrafficAnalyticsPage;
