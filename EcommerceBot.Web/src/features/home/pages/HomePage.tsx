/**
 * src/features/home/pages/HomePage.tsx
 *
 * Página principal da Home / Visão Geral da Plataforma.
 * Consome o hook useHome e exibe métricas, ingestão rápida, jobs e integrações.
 */

import React from 'react';
import {
  HomeHeader,
  KpiMetricsGrid,
  RecentJobsTable,
  IntegrationsStatus,
} from '../components';
import { ScraperForm } from '@/features/scraper';
import { Alert } from '@/components/ui';
import { useHome } from '../hooks/useHome';

export const HomePage: React.FC = () => {
  const {
    userName,
    planName,
    isApiOnline,
    jobs,
    metrics,
    integrationsSummary,
    toastMessage,
    handleViewJob,
    handleExportJob,
    handleConfigureKeys,
    handleOpenSupport,
    handleDismissToast,
  } = useHome();

  return (
    <div
      role="main"
      aria-label="Dashboard Principal da Plataforma"
      className="min-h-screen bg-[#090D16] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 max-w-md animate-fade-in">
          <Alert
            variant="info"
            title="Notificação de Sistema"
            onClose={handleDismissToast}
          >
            {toastMessage}
          </Alert>
        </div>
      )}

      {/* 1. Componente Superior - Header */}
      <HomeHeader
        userName={userName}
        planName={planName}
        isApiOnline={isApiOnline}
      />

      {/* 2. Formulário Oficial de Ingestão de Produtos (Scraper) */}
      <section aria-labelledby="quick-extract-heading">
        <ScraperForm />
      </section>

      {/* 3. Grid de KPIs & Métricas */}
      <section aria-label="Métricas Principais da Plataforma">
        <KpiMetricsGrid metrics={metrics} />
      </section>

      {/* 4. Grid Responsivo de 2 Colunas no Desktop (2/3 Tabela + 1/3 Sidebar Integrações) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
        {/* Coluna Principal (2/3): Tabela de Extrações Recentes */}
        <section aria-labelledby="recent-jobs-heading" className="lg:col-span-2 space-y-4">
          <RecentJobsTable
            jobs={jobs}
            onViewJob={handleViewJob}
            onExportJob={handleExportJob}
          />
        </section>

        {/* Sidebar Lateral (1/3): Status de Integrações & Suporte */}
        <aside aria-label="Status de Integrações e Suporte" className="lg:col-span-1">
          <IntegrationsStatus
            summary={integrationsSummary}
            onConfigureKeys={handleConfigureKeys}
            onOpenSupport={handleOpenSupport}
          />
        </aside>
      </div>
    </div>
  );
};

export default HomePage;
