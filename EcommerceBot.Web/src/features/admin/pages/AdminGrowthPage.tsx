/**
 * src/features/admin/pages/AdminGrowthPage.tsx
 *
 * Painel Administrativo de Growth & Atribuição de Tráfego Pago do SaaS (Card 78).
 * Apresenta Funil de Aquisição, Unit Economics (Receita Mercado Pago vs Custo de IA),
 * CAC, LTV, ROAS e Margem Real por Campanha.
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Plus,
  Loader2,
  Cpu,
  BarChart3,
} from 'lucide-react';
import { adminGrowthService, type AcquisitionFunnelData, type UnitEconomicsData, type CreateAdSpendPayload } from '../services/adminGrowth.service';
import { cn } from '@/lib/utils';
import { SEO } from '@/components/common/SEO';

export const AdminGrowthPage: React.FC = () => {
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(true);
  const [funnel, setFunnel] = useState<AcquisitionFunnelData | null>(null);
  const [unitEconomics, setUnitEconomics] = useState<UnitEconomicsData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submittingSpend, setSubmittingSpend] = useState<boolean>(false);

  // Form State para Inserção de Gasto em Ads
  const [formData, setFormData] = useState<CreateAdSpendPayload>({
    campaign_name: '',
    utm_source: 'meta_ads',
    ad_id: '',
    amount_spent_brl: 0,
    period_start: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    period_end: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [funnelRes, economicsRes] = await Promise.all([
        adminGrowthService.getAcquisitionFunnel(days),
        adminGrowthService.getUnitEconomics(days),
      ]);
      setFunnel(funnelRes);
      setUnitEconomics(economicsRes);
    } catch (err) {
      console.error('Erro ao carregar métricas de growth:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  const handleCreateAdSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSpend(true);
    try {
      await adminGrowthService.createAdSpend(formData);
      setIsModalOpen(false);
      setFormData({
        campaign_name: '',
        utm_source: 'meta_ads',
        ad_id: '',
        amount_spent_brl: 0,
        period_start: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        period_end: new Date().toISOString().split('T')[0],
        notes: '',
      });
      await fetchData();
    } catch (err) {
      console.error('Erro ao salvar gasto em ads:', err);
    } finally {
      setSubmittingSpend(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-white p-4 sm:p-8 space-y-8 selection:bg-emerald-500 selection:text-black">
      <SEO
        title="Admin Growth & Unit Economics"
        description="Painel de aquisição, funil de conversão e unit economics do SaaS."
      />

      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Admin & Growth
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
              UNIT ECONOMICS
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Performance de Aquisição do SaaS
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Métricas consolidadas de tráfego, receita Mercado Pago e margem real descontando custo de IA.
          </p>
        </div>

        {/* Filtros e Ação */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Período */}
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

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="min-h-[44px] h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Lançar Gasto em Ads</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <span className="text-sm font-medium">Calculando Unit Economics...</span>
        </div>
      ) : (
        <>
          {/* 1. CARDS DE KPIS PRINCIPAIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CAC Médio */}
            <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
                <span className="font-semibold uppercase tracking-wider">CAC Médio</span>
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white">
                R$ {(unitEconomics?.average_cac_brl || 0).toFixed(2).replace('.', ',')}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Custo de mídia por assinante pagante adquirido
              </p>
            </div>

            {/* Receita Bruta MP */}
            <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
                <span className="font-semibold uppercase tracking-wider">Faturamento MP</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-400">
                R$ {(unitEconomics?.total_gross_revenue_brl || 0).toFixed(2).replace('.', ',')}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Total transacionado via Mercado Pago no período
              </p>
            </div>

            {/* Custo de IA (OpenRouter/LLM) */}
            <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
                <span className="font-semibold uppercase tracking-wider">Custo de Tokens IA</span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Cpu className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-400">
                R$ {(unitEconomics?.total_llm_cost_brl || 0).toFixed(2).replace('.', ',')}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Consumo real de scraping e inferência LLM
              </p>
            </div>

            {/* Margem Líquida Real */}
            <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-5 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-3">
                <span className="font-semibold uppercase tracking-wider">Margem Líquida Real</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <BarChart3 className="h-4 w-4" />
                </div>
              </div>
              <div className={cn('text-2xl font-black', (unitEconomics?.net_profit_brl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                R$ {(unitEconomics?.net_profit_brl || 0).toFixed(2).replace('.', ',')}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Receita - (Gasto em Ads + Custo de IA)
              </p>
            </div>
          </div>

          {/* 2. FUNIL DE CONVERSÃO VISUAL */}
          {funnel && (
            <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Funil de Conversão do SaaS</h2>
                  <p className="text-xs text-slate-400">
                    Jornada completa do visitante da Landing Page até a primeira fatura paga.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  Conversão Global: {funnel.overall_conversion_rate}%
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
                {/* Etapa 1: Visitantes na LP */}
                <div className="rounded-xl bg-[#090D16] border border-[#1E293B] p-5 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      1. Visitantes Únicos (LP)
                    </span>
                    <span className="text-3xl font-black text-white">{funnel.total_visitors}</span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#1E293B] text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Taxa para Cadastro:</span>
                    <span className="font-bold text-indigo-400">{funnel.visitor_to_signup_rate}%</span>
                  </div>
                </div>

                {/* Etapa 2: Cadastros Realizados */}
                <div className="rounded-xl bg-[#090D16] border border-[#1E293B] p-5 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      2. Contas Criadas (Tenants)
                    </span>
                    <span className="text-3xl font-black text-indigo-400">{funnel.total_signups}</span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#1E293B] text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Taxa para Pagante:</span>
                    <span className="font-bold text-emerald-400">{funnel.signup_to_paid_rate}%</span>
                  </div>
                </div>

                {/* Etapa 3: Assinantes Pagantes */}
                <div className="rounded-xl bg-[#090D16] border border-emerald-500/30 p-5 flex flex-col justify-between bg-gradient-to-b from-[#090D16] to-emerald-950/20">
                  <div>
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
                      3. Clientes Pagantes
                    </span>
                    <span className="text-3xl font-black text-emerald-400">{funnel.total_paying_customers}</span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-500/20 text-[11px] text-slate-300 flex items-center justify-between">
                    <span>LTV / CAC Ratio:</span>
                    <span className="font-bold text-white">{unitEconomics?.ltv_cac_ratio || 0}x</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. TABELA ANALÍTICA DE CAMPANHAS & UNIT ECONOMICS */}
          <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Desempenho por Origem & Campanha</h2>
                <p className="text-xs text-slate-400">
                  Cruzamento de cadastros, faturamento, consumo de IA e margem real por canal.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#090D16] text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E293B]">
                  <tr>
                    <th className="py-3 px-4">Canal / Origem</th>
                    <th className="py-3 px-4">Campanha</th>
                    <th className="py-3 px-4">Criativo (ad_id)</th>
                    <th className="py-3 px-4 text-center">Cadastros</th>
                    <th className="py-3 px-4 text-center">Pagantes</th>
                    <th className="py-3 px-4 text-right">Faturamento MP</th>
                    <th className="py-3 px-4 text-right">Custo IA</th>
                    <th className="py-3 px-4 text-right">Gasto Ads</th>
                    <th className="py-3 px-4 text-right">Margem Real</th>
                    <th className="py-3 px-4 text-center">ROAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {unitEconomics?.campaigns && unitEconomics.campaigns.length > 0 ? (
                    unitEconomics.campaigns.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#1E293B]/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">{row.utm_source}</td>
                        <td className="py-3 px-4 text-slate-300">{row.utm_campaign}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{row.ad_id || '-'}</td>
                        <td className="py-3 px-4 text-center">{row.signups_count}</td>
                        <td className="py-3 px-4 text-center font-semibold text-emerald-400">
                          {row.paying_customers_count}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-white">
                          R$ {row.gross_revenue_brl.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-3 px-4 text-right text-amber-400">
                          R$ {row.llm_cost_brl.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-3 px-4 text-right text-indigo-400">
                          R$ {row.ad_spend_brl.toFixed(2).replace('.', ',')}
                        </td>
                        <td className={cn('py-3 px-4 text-right font-black', row.net_margin_brl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          R$ {row.net_margin_brl.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-white">
                          {row.roas > 0 ? `${row.roas}x` : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        Nenhuma campanha de tráfego registrada no período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MODAL PARA LANÇAMENTO DE GASTO EM ADS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#15121B] border border-[#1E293B] rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Lançar Investimento em Anúncios</h3>
            <p className="text-xs text-slate-400">
              Cadastre o valor gasto em campanhas (Meta Ads, Google Ads) para cálculo de CAC e ROAS.
            </p>

            <form onSubmit={handleCreateAdSpend} className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome da Campanha</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: BlackFriday_Lancamento_Pro"
                  value={formData.campaign_name}
                  onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Canal (UTM Source)</label>
                  <select
                    value={formData.utm_source}
                    onChange={(e) => setFormData({ ...formData, utm_source: e.target.value })}
                    className="w-full h-10 px-2 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="meta_ads">Meta Ads (FB/IG)</option>
                    <option value="google_ads">Google Ads</option>
                    <option value="tiktok_ads">TikTok Ads</option>
                    <option value="influencer">Influenciador / Parceria</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Valor Investido (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="500.00"
                    value={formData.amount_spent_brl || ''}
                    onChange={(e) => setFormData({ ...formData, amount_spent_brl: parseFloat(e.target.value) || 0 })}
                    className="w-full h-10 px-3 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Data Início</label>
                  <input
                    type="date"
                    required
                    value={formData.period_start}
                    onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Data Fim</label>
                  <input
                    type="date"
                    required
                    value={formData.period_end}
                    onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-slate-800 text-slate-300 font-semibold cursor-pointer min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingSpend}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
                >
                  {submittingSpend ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminGrowthPage;
