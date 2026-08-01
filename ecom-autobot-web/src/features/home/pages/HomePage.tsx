import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { HomeHeader } from '../components/HomeHeader';
import { KpiMetricsGrid } from '../components/KpiMetricsGrid';
import { RecentJobsTable } from '../components/RecentJobsTable';
import { IntegrationsStatus } from '../components/IntegrationsStatus';
import type { ExtractionJob, HomeMetrics, JobStatus } from '../types/home.types';
import { ScraperForm } from '@/features/scraper';
import { useProducts } from '@/features/catalog/hooks/useProducts';
import { AIKeysForm } from '@/features/ai-keys/components/AIKeysForm';
import { Modal, Alert } from '@/components/ui';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { products } = useProducts(50);

  const [isKeysModalOpen, setIsKeysModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Mapeia os produtos reais do catálogo para jobs na tabela da Home
  const jobs: ExtractionJob[] = useMemo(() => {
    return products.slice(0, 10).map((p, idx) => {
      let status: JobStatus = 'Processando';
      const st = String(p.status).toUpperCase();
      if (st === 'PROCESSED' || st === 'EXPORTED') status = 'Sucesso';
      else if (st === 'FAILED') status = 'Erro';

      let sourceDomain = 'e-commerce';
      const productUrl = (p.attributes?.url as string) || (p as any).url;
      if (productUrl) {
        try {
          sourceDomain = new URL(productUrl).hostname;
        } catch {
          // fallback silencioso
        }
      } else if (p.sku.startsWith('SHP')) {
        sourceDomain = 'shopify';
      } else if (p.sku.startsWith('NUV')) {
        sourceDomain = 'nuvemshop';
      }

      return {
        id: `job-${p.sku}-${idx}`,
        productName: p.title || p.sku,
        sourceDomain,
        aiModel: 'DeepSeek V3',
        status,
        createdAt: p.created_at || new Date().toISOString(),
      };
    });
  }, [products]);

  // Métricas dinâmicas calculadas a partir dos produtos do catálogo
  const metrics: HomeMetrics = useMemo(() => {
    const total = products.length;
    const processed = products.filter((p) => ['PROCESSED', 'EXPORTED'].includes(String(p.status).toUpperCase())).length;
    const active = products.filter((p) => String(p.status).toUpperCase() === 'PROCESSING' || String(p.status).toUpperCase() === 'RAW').length;
    const failed = products.filter((p) => String(p.status).toUpperCase() === 'FAILED').length;
    const successRate = total > 0 ? ((processed / (processed + failed || 1)) * 100) : 100;

    return {
      aiCreditsUsed: processed * 5,
      aiCreditsTotal: 5000,
      productsProcessedMonth: processed,
      activeJobsCount: active,
      successRate,
    };
  }, [products]);

  const handleViewJob = (_job: ExtractionJob) => {
    navigate('/catalog');
  };

  const handleExportJob = (job: ExtractionJob) => {
    setToastMessage(`Iniciando download para "${job.productName}"...`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenSupport = () => {
    window.open('https://discord.gg', '_blank', 'noopener,noreferrer');
  };

  const userName = user?.name || (user?.email ? user.email.split('@')[0] : 'Usuário');

  return (
    <div
      role="main"
      aria-label="Dashboard Principal da Plataforma"
      className="min-h-screen bg-[#090D16] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 max-w-md animate-fade-in">
          <Alert variant="info" title="Notificação de Sistema" onClose={() => setToastMessage(null)}>
            {toastMessage}
          </Alert>
        </div>
      )}

      {/* 1. Componente Superior - Header */}
      <HomeHeader
        userName={userName}
        planName="Plano Pro"
        isApiOnline={true}
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
            onConfigureKeys={() => setIsKeysModalOpen(true)}
            onOpenSupport={handleOpenSupport}
          />
        </aside>
      </div>

      {/* Modal de Configuração de Chaves BYOK */}
      <Modal
        isOpen={isKeysModalOpen}
        onClose={() => setIsKeysModalOpen(false)}
        title="Gerenciamento de Credenciais de IA (BYOK)"
        size="lg"
      >
        <div className="p-4">
          <AIKeysForm />
        </div>
      </Modal>
    </div>
  );
};

export default HomePage;
