import React from 'react';
import { useAiCapacity } from '../hooks/useAiCapacity';
import { Alert } from '@/components/ui/feedback/Alert';
import { SEO } from '@/components/common/SEO';
import {
  CapacityHeader,
  CapacityRunwayAlert,
  CapacityMetricsCards,
  CapacityScenariosGrid,
  ProviderCapacityCards,
  TopupHistoryTable,
  RegisterTopupModal,
} from '../components';

export const AdminAiCapacityPage: React.FC = () => {
  const {
    days,
    setDays,
    overview,
    error,
    triggering,
    topupLoading,
    isTopupModalOpen,
    topupForm,
    openTopupModal,
    closeTopupModal,
    setTopupFormField,
    submitTopupForm,
    handleTriggerForecast,
  } = useAiCapacity();

  const consolidated = overview?.consolidated;
  const isCritical = consolidated?.isCritical ?? false;
  const runwayDays = consolidated?.consolidatedRunwayDays ?? 0;
  const recommendedTopupUsd = consolidated?.recommendedTopupUsd ?? 0;

  return (
    <div className="space-y-8 text-white min-h-screen pb-12 font-sans selection:bg-indigo-500 selection:text-white">
      <SEO
        title="Capacidade de IA & FinOps de Tokens (Admin)"
        description="Gestão de custos e previsão preditiva de compra de tokens para DeepSeek, Gemini e OpenRouter."
      />

      {/* 1. Cabeçalho com Filtros de Horizonte e Ações */}
      <CapacityHeader
        days={days}
        onSelectDays={setDays}
        onRecalculate={handleTriggerForecast}
        onOpenTopupModal={openTopupModal}
        triggering={triggering}
      />

      {/* Mensagem de Erro Global */}
      {error && (
        <Alert variant="error" title="Erro no FinOps de IA">
          {error}
        </Alert>
      )}

      {/* 2. Alerta Proativo de Autonomia Crítica (< 7 dias) */}
      <CapacityRunwayAlert
        isCritical={isCritical}
        runwayDays={runwayDays}
        recommendedTopupUsd={recommendedTopupUsd}
      />

      {/* 3. Cards Consolidados de Métricas (Saldo, Runway, Burn Rate, Recarga) */}
      <CapacityMetricsCards consolidated={consolidated} />

      {/* 4. Os 3 Cenários Preditivos de Compra (Baixa, Recomendada, Segurança) */}
      <CapacityScenariosGrid days={days} consolidated={consolidated} />

      {/* 5. Status Detalhado por Operadora (DeepSeek, Gemini, OpenRouter) */}
      <ProviderCapacityCards providers={overview?.providers} />

      {/* 6. Histórico de Recargas das Operadoras */}
      <TopupHistoryTable topups={overview?.recentTopups} />

      {/* 7. Modal Acessível de Registro de Recarga */}
      <RegisterTopupModal
        isOpen={isTopupModalOpen}
        onClose={closeTopupModal}
        formData={topupForm}
        onFieldChange={setTopupFormField}
        onSubmit={submitTopupForm}
        loading={topupLoading}
      />
    </div>
  );
};

export default AdminAiCapacityPage;
