/**
 * src/features/settings/components/SettingsSuccessToast.tsx
 *
 * Toast Flutuante de Sucesso ao Salvar Configurações.
 */

import React from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SettingsSuccessToastProps {
  show: boolean;
  onClose: () => void;
  message?: string;
  className?: string;
}

export const SettingsSuccessToast: React.FC<SettingsSuccessToastProps> = ({
  show,
  onClose,
  message = 'Configurações atualizadas com sucesso!',
  className,
}) => {
  if (!show) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 max-w-md',
        className
      )}
    >
      <div className="rounded-xl bg-[#15121B] border border-emerald-500/40 p-4 shadow-2xl shadow-emerald-500/10 flex items-center justify-between gap-4 text-slate-100">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Alterações Salvas</h4>
            <p className="text-xs text-slate-300">{message}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar notificação"
          className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-[#090D16] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
