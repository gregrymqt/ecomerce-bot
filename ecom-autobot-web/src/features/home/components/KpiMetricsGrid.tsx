import React from 'react';
import { Zap, PackageCheck, Activity, TrendingUp } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Card, StatCard, ProgressBar, Badge } from '@/components/ui';
import { type HomeMetrics } from '../types/home.types';

const DEFAULT_METRICS: HomeMetrics = {
  aiCreditsUsed: 0,
  aiCreditsTotal: 5000,
  productsProcessedMonth: 0,
  activeJobsCount: 0,
  successRate: 100,
};

export interface KpiMetricsGridProps {
  metrics?: HomeMetrics;
  className?: string;
}

export const KpiMetricsGrid: React.FC<KpiMetricsGridProps> = ({
  metrics = DEFAULT_METRICS,
  className,
}) => {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6', className)}>
      {/* 1. Créditos de IA */}
      <Card
        glass
        hoverable
        className="border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between hover:border-purple-500/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Créditos de IA
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Zap className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">
              {metrics.aiCreditsUsed.toLocaleString('pt-BR')}{' '}
              <span className="text-xs text-slate-400 font-normal">
                / {metrics.aiCreditsTotal.toLocaleString('pt-BR')}
              </span>
            </span>
          </div>

          <ProgressBar
            value={metrics.aiCreditsUsed}
            max={metrics.aiCreditsTotal}
            color="amber"
            showPercentage
          />
        </div>
      </Card>

      {/* 2. Produtos Processados */}
      <StatCard
        title="PRODUTOS PROCESSADOS"
        value={metrics.productsProcessedMonth.toLocaleString('pt-BR')}
        description="Este mês no catálogo"
        icon={<PackageCheck className="h-4 w-4 text-purple-400" />}
        className="border-slate-800 bg-slate-900/80 p-5 hover:border-purple-500/30"
      />

      {/* 3. Jobs em Fila / Ativos */}
      <Card
        glass
        hoverable
        className="border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between hover:border-purple-500/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Jobs em Fila
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold text-white">{metrics.activeJobsCount}</div>
            <p className="text-xs text-slate-400 mt-1">Em execução no worker</p>
          </div>

          <Badge variant="success" dot className="bg-emerald-950/60 border-emerald-500/30">
            Ativo
          </Badge>
        </div>
      </Card>

      {/* 4. Taxa de Sucesso */}
      <StatCard
        title="TAXA DE SUCESSO"
        value={`${metrics.successRate.toFixed(1)}%`}
        description="Extração sem erros"
        icon={<TrendingUp className="h-4 w-4 text-cyan-400" />}
        trend={{ value: '98.5%', isPositive: true }}
        className="border-slate-800 bg-slate-900/80 p-5 hover:border-purple-500/30"
      />
    </div>
  );
};

export default KpiMetricsGrid;
