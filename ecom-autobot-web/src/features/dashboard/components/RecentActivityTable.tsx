/**
 * src/features/dashboard/components/RecentActivityTable.tsx
 *
 * Tabela de Atividades Recentes dos Robôs de Raspagem e Processamento por IA.
 * Apresenta produto, domínio, modelo de IA utilizado, status e botão de atualização com rotação.
 */

import React from 'react';
import { History, RefreshCw, Cpu, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { RobotActivity } from '../types/dashboard.type';

interface RecentActivityTableProps {
  activities?: RobotActivity[];
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

const DEFAULT_ACTIVITIES: RobotActivity[] = [
  {
    id: 'job-1',
    product_title: 'Smartphone Galaxy S24 Ultra 512GB',
    domain: 'amazon.com.br',
    ai_provider: 'DeepSeek V3',
    status: 'SUCCESS',
    created_at_relative: 'Há 2 min',
  },
  {
    id: 'job-2',
    product_title: 'Fone de Ouvido Bluetooth Noise Cancelling',
    domain: 'kabum.com.br',
    ai_provider: 'Groq Llama 3',
    status: 'SUCCESS',
    created_at_relative: 'Há 5 min',
  },
  {
    id: 'job-3',
    product_title: 'Notebook Gamer RTX 4060 16GB',
    domain: 'mercadolivre.com.br',
    ai_provider: 'OpenAI GPT-4o',
    status: 'PROCESSING',
    created_at_relative: 'Há 8 min',
  },
  {
    id: 'job-4',
    product_title: 'Cadeira Ergonômica Mesh Premium',
    domain: 'magazineluiza.com.br',
    ai_provider: 'DeepSeek V3',
    status: 'SUCCESS',
    created_at_relative: 'Há 12 min',
  },
  {
    id: 'job-5',
    product_title: 'Monitor Ultrawide 34" 144Hz',
    domain: 'terabyteshop.com.br',
    ai_provider: 'Groq Llama 3',
    status: 'FAILED',
    created_at_relative: 'Há 20 min',
  },
];

export const RecentActivityTable: React.FC<RecentActivityTableProps> = ({
  activities = DEFAULT_ACTIVITIES,
  loading = false,
  onRefresh,
  className,
}) => {
  const items = activities && activities.length > 0 ? activities.slice(0, 5) : DEFAULT_ACTIVITIES;

  return (
    <div
      className={cn(
        'rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 text-slate-100 shadow-xl space-y-4',
        className
      )}
    >
      {/* Cabeçalho da Tabela com Botão de Refresh */}
      <div className="flex items-center justify-between pb-4 border-b border-[#1E293B]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Atividades Recentes dos Robôs</h3>
            <p className="text-xs text-slate-400">Últimos jobs de ingestão e enriquecimento</p>
          </div>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Atualizar lista de atividades"
            className="min-h-[44px] h-11 px-3 text-xs text-slate-300 hover:text-white flex items-center gap-2 transition-colors border border-[#1E293B] rounded-xl bg-[#090D16] cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4 text-violet-400', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        )}
      </div>

      {/* Tabela Responsiva */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-slate-400 font-semibold uppercase text-[11px]">
              <th className="py-3 px-2">Produto</th>
              <th className="py-3 px-2">Domínio</th>
              <th className="py-3 px-2">Provider IA</th>
              <th className="py-3 px-2">Status</th>
              <th className="py-3 px-2 text-right">Horário</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]/50">
            {items.map((act) => (
              <tr key={act.id} className="hover:bg-[#090D16]/50 transition-colors">
                <td className="py-3 px-2 font-medium text-white max-w-[200px] truncate">
                  {act.product_title}
                </td>
                <td className="py-3 px-2 font-mono text-slate-400 text-xs">{act.domain}</td>
                <td className="py-3 px-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-xs text-purple-300 font-mono">
                    <Cpu className="h-3 w-3" />
                    {act.ai_provider}
                  </span>
                </td>
                <td className="py-3 px-2">
                  {act.status === 'SUCCESS' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                      <CheckCircle className="h-3 w-3" /> Sucesso
                    </span>
                  )}
                  {act.status === 'PROCESSING' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 text-xs font-bold text-violet-400">
                      <Clock className="h-3 w-3 animate-spin" /> Em Fila
                    </span>
                  )}
                  {act.status === 'FAILED' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-400">
                      <AlertTriangle className="h-3 w-3" /> Falhou
                    </span>
                  )}
                </td>
                <td className="py-3 px-2 text-right text-slate-400 font-mono text-xs">
                  {act.created_at_relative}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
