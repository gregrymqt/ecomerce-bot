/**
 * src/features/analytics/components/traffic/TrackerInstallationCard.tsx
 *
 * Card de Onboarding & Instalação do script tracker.js com cópia rápida e verificação ativa de tag.
 */

import React from 'react';
import { Code2, Check, Copy, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback/Alert';
import { cn } from '@/lib/utils';
import type { VerifyTagResponse } from '../../types/traffic.types';

interface TrackerInstallationCardProps {
  trackerSnippet: string;
  isCopied: boolean;
  onCopySnippet: () => void;
  storeUrlInput: string;
  setStoreUrlInput: (url: string) => void;
  onVerifyTag: (e: React.FormEvent) => void;
  verifyingTag: boolean;
  tagStatus: VerifyTagResponse | null;
  tagError?: string | null;
}

export const TrackerInstallationCard: React.FC<TrackerInstallationCardProps> = ({
  trackerSnippet,
  isCopied,
  onCopySnippet,
  storeUrlInput,
  setStoreUrlInput,
  onVerifyTag,
  verifyingTag,
  tagStatus,
  tagError,
}) => {
  return (
    <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
      {/* Cabeçalho do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Code2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Instalar Tag de Rastreamento (tracker.js)</h2>
            <p className="text-xs text-slate-400">
              Cole este código no cabeçalho (&lt;head&gt;) da sua loja Shopify ou Nuvemshop para ativar a atribuição.
            </p>
          </div>
        </div>

        {tagStatus && (
          <span
            className={cn(
              'self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border',
              tagStatus.is_installed
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            )}
          >
            {tagStatus.is_installed ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {tagStatus.is_installed ? 'Tag Ativa' : 'Pendente de Instalação'}
          </span>
        )}
      </div>

      {tagError && (
        <Alert variant="error" title="Erro na Verificação">
          {tagError}
        </Alert>
      )}

      {/* Snippet com Botão de Cópia (Touch target >= 44px) */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <input
          type="text"
          readOnly
          value={trackerSnippet}
          className="w-full h-11 px-3.5 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-300 font-mono text-xs sm:text-sm truncate focus:outline-none min-h-[44px]"
        />
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onCopySnippet}
          iconLeft={isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          className={cn(
            'w-full sm:w-auto min-h-[44px] shrink-0 font-bold transition-all',
            isCopied
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          )}
        >
          {isCopied ? 'Copiado!' : 'Copiar Tag'}
        </Button>
      </div>

      {/* Verificador de Tag com Inputs >= 16px */}
      <form onSubmit={onVerifyTag} className="pt-3 border-t border-[#1E293B] flex flex-col sm:flex-row items-center gap-3">
        <input
          type="url"
          required
          placeholder="https://minhaloja.com.br"
          value={storeUrlInput}
          onChange={(e) => setStoreUrlInput(e.target.value)}
          className="w-full sm:w-80 h-11 px-3.5 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base sm:text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 min-h-[44px]"
        />
        <Button
          type="submit"
          variant="outline"
          size="md"
          disabled={verifyingTag || !storeUrlInput.trim()}
          iconLeft={verifyingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          className="w-full sm:w-auto min-h-[44px] bg-[#1E293B] hover:bg-slate-800 text-slate-200 border-slate-700 font-semibold"
        >
          Verificar Instalação
        </Button>

        {tagStatus && (
          <span className="text-xs text-slate-400 sm:ml-2">
            {tagStatus.message}
          </span>
        )}
      </form>
    </div>
  );
};

export default TrackerInstallationCard;
