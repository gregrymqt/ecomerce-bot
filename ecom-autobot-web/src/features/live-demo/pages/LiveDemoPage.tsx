import React from 'react';
import { Zap, Bot, Sparkles, Activity } from 'lucide-react';
import { LiveDemoContainer } from '../components/LiveDemoContainer';
import { Badge } from '@/components/ui/feedback/Badge';

export const LiveDemoPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Principal da Página */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="purple" icon={<Sparkles className="w-3.5 h-3.5" />}>
                Live Extraction Engine
              </Badge>
              <Badge variant="info" icon={<Activity className="w-3.5 h-3.5 animate-pulse" />}>
                Redis Pub/Sub SSE
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Zap className="w-8 h-8 text-indigo-600 dark:text-indigo-400 shrink-0" />
              Demonstração ao Vivo
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl">
              Insira de 1 a 3 URLs de produtos de e-commerce para testar o fluxo em tempo real de scraping, parsing JSON-LD/LLM e enriquecimento via IA.
            </p>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs shrink-0">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <span className="font-semibold block text-slate-900 dark:text-slate-100">Worker Status</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Pronto para ingestão
              </span>
            </div>
          </div>
        </div>

        {/* Container Principal da Demo */}
        <main>
          <LiveDemoContainer />
        </main>
      </div>
    </div>
  );
};

export default LiveDemoPage;
