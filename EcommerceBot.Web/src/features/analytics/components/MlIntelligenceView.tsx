/**
 * src/features/analytics/components/MlIntelligenceView.tsx
 *
 * Visualizador Interativo de Inteligência de Clientes e Machine Learning (RFM, Churn e LTV).
 * Permite ao lojista disparar análises preditivas assíncronas com IA e visualizar ações recomendadas.
 */

import { Skeleton } from '@/components/ui/feedback/Skeleton';
import { useMlAnalytics } from '../hooks/useMlAnalytics';
import {
  MlTriggerBanner,
  MlKpiCards,
  ChurnPredictionTable,
  RfmSegmentationTable,
  LtvTiersTable,
} from './';

export const MlIntelligenceView: React.FC = () => {
  const {
    loading,
    triggering,
    insights,
    error,
    triggerMessage,
    copiedActionId,
    handleTriggerAnalysis,
    handleCopyCoupon,
  } = useMlAnalytics();

  return (
    <div className="space-y-8">
      {/* Banner de Disparo e Status de Machine Learning */}
      <MlTriggerBanner
        onTrigger={handleTriggerAnalysis}
        triggering={triggering}
        triggerMessage={triggerMessage}
        error={error}
      />

      {loading ? (
        <div className="space-y-8 animate-pulse" role="region" aria-label="Carregando inteligência de clientes">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`ml-kpi-${i}`} className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-8 w-32 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            ))}
          </div>
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
            <Skeleton className="h-6 w-52 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
              <Skeleton className="h-6 w-40 rounded" />
              <Skeleton className="h-4 w-full rounded" />
            </div>
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
              <Skeleton className="h-6 w-40 rounded" />
              <Skeleton className="h-4 w-full rounded" />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 1. Cards de KPIs de Machine Learning */}
          <MlKpiCards insights={insights} />

          {/* 2. Tabela de Previsão de Churn & Ações de Retenção */}
          <ChurnPredictionTable
            predictions={insights?.churn?.predictions}
            copiedActionId={copiedActionId}
            onCopyCoupon={handleCopyCoupon}
          />

          {/* 3. Segmentação RFM & Tiers de LTV */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RfmSegmentationTable customers={insights?.rfm?.customers} />
            <LtvTiersTable forecasts={insights?.ltv?.forecasts} />
          </div>
        </>
      )}
    </div>
  );
};

export default MlIntelligenceView;
