/**
 * src/features/analytics/components/MlIntelligenceView.tsx
 *
 * Visualizador Interativo de Inteligência de Clientes e Machine Learning (RFM, Churn e LTV).
 * Permite ao lojista disparar análises preditivas assíncronas com IA e visualizar ações recomendadas.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
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
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          <span className="text-sm font-medium">Carregando insights analíticos...</span>
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
