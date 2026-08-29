/**
 * src/features/admin/pages/AdminGrowthPage.tsx
 *
 * Painel Administrativo de Growth & Atribuição de Tráfego Pago do SaaS (Card 78).
 * Apresenta Funil de Aquisição, Unit Economics (Receita Mercado Pago vs Custo de IA),
 * CAC, LTV, ROAS e Margem Real por Campanha.
 */

import React from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useAdminGrowth } from '../hooks/useAdminGrowth';
import {
  GrowthMetricsCards,
  GrowthFunnelCard,
  CampaignPerformanceTable,
  CreateAdSpendModal,
} from '../components';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback/Alert';
import { SEO } from '@/components/common/SEO';
import { cn } from '@/lib/utils';

export const AdminGrowthPage: React.FC = () => {
  const {
    days,
    setDays,
    loading,
    funnel,
    unitEconomics,
    error,
    isModalOpen,
    setIsModalOpen,
    submittingSpend,
    spendError,
    formData,
    setFormData,
    handleCreateAdSpend,
  } = useAdminGrowth();

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
          {/* Seletor de Período com Touch Targets >= 44px */}
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

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setIsModalOpen(true)}
            iconLeft={<Plus className="h-4 w-4" />}
            className="min-h-[44px] bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20"
          >
            Lançar Gasto em Ads
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Erro ao carregar dados">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <span className="text-sm font-medium">Calculando Unit Economics...</span>
        </div>
      ) : (
        <>
          {/* 1. Cards de KPIs Principais */}
          <GrowthMetricsCards unitEconomics={unitEconomics} />

          {/* 2. Funil de Conversão Visual */}
          <GrowthFunnelCard funnel={funnel} unitEconomics={unitEconomics} />

          {/* 3. Tabela Analítica de Campanhas & Unit Economics */}
          <CampaignPerformanceTable campaigns={unitEconomics?.campaigns} />
        </>
      )}

      {/* Modal de Lançamento de Gasto em Ads */}
      <CreateAdSpendModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleCreateAdSpend}
        submitting={submittingSpend}
        error={spendError}
      />
    </div>
  );
};

export default AdminGrowthPage;
