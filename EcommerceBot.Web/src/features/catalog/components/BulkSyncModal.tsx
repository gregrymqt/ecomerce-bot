import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, ShoppingBag, Store, Layers } from 'lucide-react';
import { Modal, Button, Badge, Checkbox, Select } from '@/components/ui';
import { useBulkPlatformSync, type PlatformTarget } from '../hooks/useBulkPlatformSync';
import type { NuvemshopVisibility } from '@/features/integrations';

export interface BulkSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSkus: string[];
  onSuccess?: () => void;
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

  const { isSyncing, syncError, lastResult, executeBulkSync, setSyncError } = useBulkPlatformSync();

  if (!isOpen) return null;

  const handleSync = async () => {
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

  const footerActions = (
    <div className="flex items-center justify-end gap-3 w-full">
      <Button variant="secondary" onClick={onClose} disabled={isSyncing}>
        {lastResult?.success ? 'Fechar' : 'Cancelar'}
      </Button>
      <Button
        variant="primary"
        onClick={handleSync}
        disabled={isSyncing || selectedSkus.length === 0}
        iconLeft={<RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />}
      >
        {isSyncing ? 'Disparando Sincronização...' : 'Confirmar Sincronização'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sincronizar em Lote"
      description="Disparar catalogação remota via Worker / Bulk API"
      size="md"
      footer={footerActions}
    >
      <div className="space-y-6">
        {/* Selected Items Counter */}
        <div className="flex items-center justify-between bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-300 font-medium">Produtos selecionados:</span>
          <Badge variant="info" className="text-xs px-2.5 py-1 font-semibold">
            {selectedSkus.length} {selectedSkus.length === 1 ? 'produto' : 'produtos'}
          </Badge>
        </div>

        {/* Platform Selector Cards */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
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
              className={`flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all cursor-pointer ${
                platform === 'SHOPIFY'
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/10'
                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <ShoppingBag className="w-5 h-5 mb-1.5" />
              <span className="text-xs font-semibold">Shopify</span>
              <span className="text-[10px] text-slate-400 mt-0.5">GraphQL Bulk</span>
            </button>

            {/* Nuvemshop Option */}
            <button
              type="button"
              onClick={() => {
                setPlatform('NUVEMSHOP');
                setSyncError(null);
              }}
              className={`flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all cursor-pointer ${
                platform === 'NUVEMSHOP'
                  ? 'bg-sky-500/10 border-sky-500/50 text-sky-300 shadow-md shadow-sky-500/10'
                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <Store className="w-5 h-5 mb-1.5" />
              <span className="text-xs font-semibold">Nuvemshop</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Fila RabbitMQ</span>
            </button>

            {/* All Options */}
            <button
              type="button"
              onClick={() => {
                setPlatform('ALL');
                setSyncError(null);
              }}
              className={`flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all cursor-pointer ${
                platform === 'ALL'
                  ? 'bg-violet-600/10 border-violet-500/50 text-violet-300 shadow-md shadow-violet-500/10'
                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <Layers className="w-5 h-5 mb-1.5" />
              <span className="text-xs font-semibold">Ambas</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Multi-canal</span>
            </button>
          </div>
        </div>

        {/* Nuvemshop Specific Settings */}
        {(platform === 'NUVEMSHOP' || platform === 'ALL') && (
          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800/80 space-y-2">
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Visibilidade na Nuvemshop
            </label>
            <Select
              value={nuvemVisibility}
              onChange={(e) => setNuvemVisibility(e.target.value as NuvemshopVisibility)}
              options={[
                { label: 'Visível (Loja On-line)', value: 'visible' },
                { label: 'Não listado (Apenas link)', value: 'unlisted' },
                { label: 'Oculto (Rascunho)', value: 'hidden' },
              ]}
            />
          </div>
        )}

        {/* Force Update Checkbox */}
        <div className="px-1">
          <Checkbox
            id="force-update-checkbox"
            checked={forceUpdate}
            onChange={(e) => setForceUpdate(e.target.checked)}
            label="Forçar atualização de produtos existentes"
          />
        </div>

        {/* Result & Error Banners */}
        {syncError && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{syncError}</span>
          </div>
        )}

        {lastResult && lastResult.success && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Sincronização em Lote Solicitada com Sucesso!</span>
            </div>
            <p className="text-emerald-200/80 leading-relaxed pl-6">{lastResult.message}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
