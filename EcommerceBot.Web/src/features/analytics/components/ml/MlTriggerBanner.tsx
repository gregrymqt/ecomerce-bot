/**
 * src/features/analytics/components/ml/MlTriggerBanner.tsx
 *
 * Banner de Disparo e Status de Machine Learning & IA Preditiva (Scikit-Learn).
 */

import React from 'react';
import { BrainCircuit, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback/Alert';

interface MlTriggerBannerProps {
  onTrigger: () => void;
  triggering: boolean;
  triggerMessage?: string | null;
  error?: string | null;
}

export const MlTriggerBanner: React.FC<MlTriggerBannerProps> = ({
  onTrigger,
  triggering,
  triggerMessage,
  error,
}) => {
  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="error" title="Erro no Processamento de IA">
          {error}
        </Alert>
      )}

      {triggerMessage && (
        <Alert variant="info" title="Status da Operação">
          {triggerMessage}
        </Alert>
      )}

      <div className="rounded-2xl bg-gradient-to-r from-[#15121B] to-[#1E1A29] border border-[#2D243F] p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-inner">
            <BrainCircuit className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">Motor de Machine Learning & IA Preditiva</h2>
              <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400 border border-purple-500/20">
                SCIKIT-LEARN 1.4
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Modelos supervisionados de regressão e clustering calculando segmentação RFM, probabilidade de evasão (Churn) e valor de vida útil (LTV).
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onTrigger}
          disabled={triggering}
          iconLeft={
            triggering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 text-amber-300" />
            )
          }
          className="w-full md:w-auto min-h-[44px] px-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-purple-900/30 shrink-0"
        >
          {triggering ? 'Processando Modelos...' : 'Executar Análise de IA Agora'}
        </Button>
      </div>
    </div>
  );
};

export default MlTriggerBanner;
