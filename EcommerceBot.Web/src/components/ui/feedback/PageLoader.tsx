/**
 * src/components/ui/feedback/PageLoader.tsx
 * Componente de fallback para carregamento sob demanda de páginas (React.Suspense & Code Splitting).
 */

import React from 'react';
import { Bot, RefreshCw } from 'lucide-react';

export const PageLoader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-400 animate-fade-in">
      <div className="relative flex items-center justify-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/30 animate-pulse">
          <Bot className="w-7 h-7 text-white" />
        </div>
        <RefreshCw className="w-20 h-20 text-indigo-500/30 animate-spin absolute" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-bold text-slate-200">Carregando módulo...</span>
        <span className="text-xs text-slate-500">Sincronizando Workspace E-commerce Bot</span>
      </div>
    </div>
  );
};

export default PageLoader;
