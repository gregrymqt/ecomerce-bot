/**
 * src/features/catalog/components/BulkSyncModal.tsx
 *
 * Modal de disparo e acompanhamento em tempo real (SSE) da sincronização em massa.
 */

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Store,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Modal } from '@/components/ui/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/feedback/Badge';
import { Checkbox } from '@/components/ui/form/Checkbox';
import { Select } from '@/components/ui/form/Select';
import { useBulkPlatformSync, type PlatformTarget } from '../hooks/useBulkPlatformSync';
import { SSEClient } from '@/lib/sseClient';
import type { NuvemshopVisibility } from '@/features/integrations';
import { cn } from '@/lib/utils';

export interface BulkSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSkus: string[];
  onSuccess?: () => void;
}

interface SseSyncEvent {
  type: string;
  job_id: string;
  sku: string;
  status: string;
  shopify_id?: string;
  timestamp?: string;
}

export const BulkSyncModal: React.FC<BulkSyncModalProps> = ({
  isOpen,
  onClose,
  selectedSkus,
  onSuccess,
}) => {
  const [platform, setPlatform] = useState<PlatformTarget>('ALL');
  const [nuvemVisibility, setNuvemVisibility] = useState<NuvemshopVisibility>('visible');
  const [forceUpdate, setForceUpdate] = useState(true);
  const [progressCount, setProgressCount] = useState<number>(0);
  const [syncedSkus, setSyncedSkus] = useState<string[]>([]);

  const { isSyncing, syncError, lastResult, executeBulkSync, setSyncError } = useBulkPlatformSync();

  // Escuta SSE durante a sincronização
  useEffect(() => {
    if (!isOpen) {
      setProgressCount(0);
      setSyncedSkus([]);
      return;
    }

    const sse = new SSEClient<SseSyncEvent>();
    sse.connect({
      endpoint: '/api/v1/stream',
      onMessage: (event) => {
        if (event && (event.type === 'SHOPIFY_SYNC_PROGRESS' || event.type === 'NUVEMSHOP_SYNC_PROGRESS')) {
          setProgressCount((prev) => Math.min(prev + 1, selectedSkus.length));
          if (event.sku) {
            setSyncedSkus((prev) => (prev.includes(event.sku) ? prev : [...prev, event.sku]));
          }
        }
      },
    });

    return () => {
      sse.close();
    };
  }, [isOpen, selectedSkus.length]);

  if (!isOpen) return null;

  const handleSync = async () => {
    setProgressCount(0);
    setSyncedSkus([]);
    const result = await executeBulkSync({
      platform,
      skus: selectedSkus,
      forceUpdate,
      nuvemshopVisibility: nuvemVisibility,
    });

    if (result.success && onSuccess) {
      onSuccess();
    }
  };

  const progressPercent = selectedSkus.length > 0 ? Math.round((progressCount / selectedSkus.length) * 100) : 0;

  const footerActions = (
    <div className="flex items-center justify-end gap-3 w-full">
      <Button
        variant="secondary"
        onClick={onClose}
        disabled={isSyncing}
        className="min-h-[44px]"
      >
        {lastResult?.success ? 'Concluir' : 'Cancelar'}
      </Button>
      <Button
        variant="primary"
        onClick={handleSync}
        disabled={isSyncing || selectedSkus.length === 0}
        iconLeft={<RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />}
        className="bg-indigo-600 hover:bg-indigo-500 font-bold text-white shadow-lg shadow-indigo-600/25 min-h-[44px]"
      >
        {isSyncing ? 'Enviando Lote para Fila...' : 'Confirmar e Sincronizar'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sincronização em Massa (Bulk Sync)"
      description="Envie múltiplos produtos enriquecidos por IA simultaneamente para as lojas conectadas."
      size="md"
      footer={footerActions}
    >
      <div className="space-y-5">
        {/* Contador de Itens Selecionados */}
        <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800 shadow-inner">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span>Itens selecionados no catálogo:</span>
          </div>
          <Badge variant="info" className="text-xs px-3 py-1 font-bold">
            {selectedSkus.length} {selectedSkus.length === 1 ? 'produto' : 'produtos'}
          </Badge>
        </div>

        {/* Seletor de Plataformas */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            Plataforma de Destino
          </label>
          <div className="grid grid-cols-3 gap-3">
            {/* Shopify Option */}
            <button
              type="button"
              onClick={() => {
                setPlatform('SHOPIFY');
                setSyncError(null);
              }}
              className={cn(
                'min-h-[44px] flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500',
                platform === 'SHOPIFY'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/15 scale-[1.02]'
                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              )}
            >
              <ShoppingBag className="w-5 h-5 mb-1.5 text-emerald-400" />
              <span className="text-xs font-bold">Shopify</span>
              <span className="text-[10px] text-slate-400 mt-0.5">GraphQL Admin</span>
            </button>

            {/* Nuvemshop Option */}
            <button
              type="button"
              onClick={() => {
                setPlatform('NUVEMSHOP');
                setSyncError(null);
              }}
              className={cn(
                'min-h-[44px] flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500',
                platform === 'NUVEMSHOP'
                  ? 'bg-purple-500/10 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/15 scale-[1.02]'
                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              )}
            >
              <Store className="w-5 h-5 mb-1.5 text-purple-400" />
              <span className="text-xs font-bold">Nuvemshop</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Fila RabbitMQ</span>
            </button>

            {/* All Option */}
            <button
              type="button"
              onClick={() => {
                setPlatform('ALL');
                setSyncError(null);
              }}
              className={cn(
                'min-h-[44px] flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500',
                platform === 'ALL'
                  ? 'bg-violet-600/15 border-violet-500 text-violet-300 shadow-lg shadow-violet-500/15 scale-[1.02]'
                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              )}
            >
              <Layers className="w-5 h-5 mb-1.5 text-violet-400" />
              <span className="text-xs font-bold">Todas as Lojas</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Multi-canal</span>
            </button>
          </div>
        </div>

        {/* Opções de Visibilidade para Nuvemshop */}
        {(platform === 'NUVEMSHOP' || platform === 'ALL') && (
          <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Visibilidade na Nuvemshop
            </label>
            <Select
              value={nuvemVisibility}
              onChange={(e) => setNuvemVisibility(e.target.value as NuvemshopVisibility)}
              options={[
                { label: 'Visível (Loja On-line)', value: 'visible' },
                { label: 'Não listado (Apenas via link direto)', value: 'unlisted' },
                { label: 'Oculto (Rascunho)', value: 'hidden' },
              ]}
              className="text-base min-h-[44px] bg-slate-950/60 border-slate-800 text-slate-100"
            />
          </div>
        )}

        {/* Checkbox de Force Update */}
        <div className="px-1">
          <Checkbox
            id="force-update-checkbox"
            checked={forceUpdate}
            onChange={(e) => setForceUpdate(e.target.checked)}
            label="Sobrescrever imagens, preços e descrições na loja remota"
          />
        </div>

        {/* Barra de Progresso Viva SSE */}
        {progressCount > 0 && (
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                Progresso em Tempo Real (SSE):
              </span>
              <span className="text-violet-300 font-mono">
                {progressCount} / {selectedSkus.length} ({progressPercent}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-violet-500 to-emerald-400 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {syncedSkus.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {syncedSkus.slice(-4).map((sku) => (
                  <span key={sku} className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                    {sku} ✓
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mensagens de Erro e Sucesso */}
        {syncError && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{syncError}</span>
          </div>
        )}

        {lastResult && lastResult.success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Sincronização Iniciada na Fila RabbitMQ!</span>
            </div>
            <p className="text-emerald-200/90 leading-relaxed pl-6">{lastResult.message}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BulkSyncModal;
