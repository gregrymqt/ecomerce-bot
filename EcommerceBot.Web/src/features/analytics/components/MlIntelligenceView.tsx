/**
 * src/features/analytics/components/MlIntelligenceView.tsx
 *
 * Visualizador Interativo de Inteligência de Clientes e Machine Learning (RFM, Churn e LTV).
 * Permite ao lojista disparar análises preditivas assíncronas com IA e visualizar ações recomendadas.
 */

import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Users,
  DollarSign,
  Loader2,
  Gift,
  Check,
  ShieldAlert,
  Award
} from 'lucide-react';
import {
  mlAnalyticsService,
  type MlInsightsResponse
} from '../services/mlAnalytics.service';
import { cn } from '@/lib/utils';

export const MlIntelligenceView: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [insights, setInsights] = useState<MlInsightsResponse | null>(null);
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await mlAnalyticsService.getLatestInsights();
      setInsights(res);
    } catch (err) {
      console.error('Erro ao buscar insights de Machine Learning:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const handleTriggerAnalysis = async () => {
    setTriggering(true);
    try {
      await mlAnalyticsService.triggerAnalysis('FULL_ANALYTICS');
      // Polling curto após 3s para buscar os resultados calculados pelo Worker
      setTimeout(async () => {
        await fetchInsights();
        setTriggering(false);
      }, 3500);
    } catch (err) {
      console.error('Erro ao disparar análise de ML:', err);
      setTriggering(false);
    }
  };

  const handleCopyCoupon = (customerId: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedActionId(customerId);
    setTimeout(() => setCopiedActionId(null), 2500);
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'MEDIUM':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'DIAMOND':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'PLATINUM':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'GOLD':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'SILVER':
        return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
      default:
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    }
  };

  return (
    <div className="space-y-8">
      {/* Banner de Ação de Disparo */}
      <div className="rounded-2xl bg-gradient-to-r from-[#15121B] to-[#1E1A29] border border-[#2D243F] p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-inner">
            <BrainCircuit className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">Motor de Machine Learning & IA Preditiva</h2>
              <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400 border border-purple-500/20">
                SCIKIT-LEARN 1.4
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Modelos supervisionados de regressão e clustering calculando segmentação RFM, probabilidade de evasão (Churn) e valor de vida útil (LTV).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTriggerAnalysis}
          disabled={triggering}
          className={cn(
            'min-h-[44px] px-5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shrink-0 transition-all cursor-pointer shadow-lg',
            triggering
              ? 'bg-purple-900/50 text-purple-300 border border-purple-500/30'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-900/30'
          )}
        >
          {triggering ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processando Modelos...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>Executar Análise de IA Agora</span>
            </>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          <span className="text-sm font-medium">Carregando insights analíticos...</span>
        </div>
      ) : (
        <>
          {/* 1. CARDS DE KPIS DE MACHINE LEARNING */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Projeção de LTV (12 Meses) */}
            <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
                <span className="font-semibold uppercase tracking-wider">LTV Projetado (12m)</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-400">
                R$ {(insights?.ltv?.summary.projected_revenue_12m || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Faturamento estimado da base nos próximos 12 meses
              </p>
            </div>

            {/* Clientes em Risco Alto de Churn */}
            <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
                <span className="font-semibold uppercase tracking-wider">Risco de Churn</span>
                <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-red-400">
                {insights?.churn?.summary.high_risk_count || 0} clientes
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Precisam de ação imediata de retenção
              </p>
            </div>

            {/* Total de Clientes Analisados */}
            <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
                <span className="font-semibold uppercase tracking-wider">Base Analisada</span>
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white">
                {insights?.rfm?.summary.total_customers || 0} clientes
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Segmentados por Recência, Frequência e Valor
              </p>
            </div>

            {/* Ticket Médio RFM */}
            <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
                <span className="font-semibold uppercase tracking-wider">LTV Médio por Cliente</span>
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-purple-400">
                R$ {(insights?.ltv?.summary.avg_projected_ltv_12m || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Valor estimado por cliente individual
              </p>
            </div>
          </div>

          {/* 2. TABELA DE PREVISÃO DE CHURN & RECOMENDAÇÃO DE AÇÕES */}
          <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-400" />
                  <h2 className="text-lg font-bold text-white">Previsão de Churn & Recomendações de Retenção</h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Probabilidade de cancelamento/abandono calculada por IA com sugestão de ação instantânea para o lojista.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#090D16] text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E293B]">
                  <tr>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Nível de Risco</th>
                    <th className="py-3 px-4 text-center">Probabilidade Churn</th>
                    <th className="py-3 px-4 text-center">Última Compra</th>
                    <th className="py-3 px-4">Ação Recomendada pela IA</th>
                    <th className="py-3 px-4 text-right">Executar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {insights?.churn?.predictions && insights.churn.predictions.length > 0 ? (
                    insights.churn.predictions.map((p, idx) => (
                      <tr key={idx} className="hover:bg-[#1E293B]/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-200">{p.customerId}</td>
                        <td className="py-3 px-4">
                          <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-bold border', getRiskBadge(p.riskLevel))}>
                            {p.riskLevel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-white">
                          {(p.churnProbability * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-center text-slate-400">
                          {p.lastOrderDaysAgo} dias atrás
                        </td>
                        <td className="py-3 px-4 text-indigo-300 font-medium">
                          {p.actionRecommendation || 'Disparar e-mail de reengajamento com frete grátis'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleCopyCoupon(p.customerId, 'VOLTA20')}
                            className="min-h-[32px] px-3 py-1 rounded-lg bg-[#1E293B] hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-700"
                          >
                            {copiedActionId === p.customerId ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Gift className="h-3.5 w-3.5 text-amber-400" />}
                            <span>{copiedActionId === p.customerId ? 'Cupom Copiado!' : 'Gerar Cupom'}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Nenhuma previsão de churn disponível. Clique em "Executar Análise de IA Agora" para processar a base.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. SEGMENTAÇÃO RFM & TIERS DE LTV */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Clusters RFM */}
            <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">Segmentação RFM da Base</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {insights?.rfm?.customers.length || 0} registros
                </span>
              </div>

              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#090D16] text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E293B] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Segmento</th>
                      <th className="py-2.5 px-3 text-center">Score RFM</th>
                      <th className="py-2.5 px-3 text-right">Total Gasto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {insights?.rfm?.customers && insights.rfm.customers.length > 0 ? (
                      insights.rfm.customers.map((c, idx) => (
                        <tr key={idx} className="hover:bg-[#1E293B]/30">
                          <td className="py-2.5 px-3 font-mono text-slate-300 truncate max-w-[150px]">{c.customerId}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 text-[10px] font-bold border border-indigo-500/20">
                              {c.segment}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-200">
                            {c.rfm_score || `${c.r_score}${c.f_score}${c.m_score}`}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-emerald-400">
                            R$ {c.monetary.toFixed(2).replace('.', ',')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-500">Sem dados de segmentação RFM.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Previsão de Tiers de LTV */}
            <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white">Previsão de Tiers & LTV (12m)</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {insights?.ltv?.forecasts.length || 0} clientes
                </span>
              </div>

              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#090D16] text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E293B] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Tier</th>
                      <th className="py-2.5 px-3 text-right">Histórico</th>
                      <th className="py-2.5 px-3 text-right">LTV Previsto (12m)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {insights?.ltv?.forecasts && insights.ltv.forecasts.length > 0 ? (
                      insights.ltv.forecasts.map((f, idx) => (
                        <tr key={idx} className="hover:bg-[#1E293B]/30">
                          <td className="py-2.5 px-3 font-mono text-slate-300 truncate max-w-[150px]">{f.customerId}</td>
                          <td className="py-2.5 px-3">
                            <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold border', getTierBadge(f.customerTier))}>
                              {f.customerTier}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300">
                            R$ {f.historicalRevenue.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-emerald-400">
                            R$ {f.predictedLtv12m.toFixed(2).replace('.', ',')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-500">Sem previsões de LTV disponíveis.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
