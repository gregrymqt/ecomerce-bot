/**
 * src/components/ui/payment/PixPaymentDisplay.tsx
 *
 * Componente de UI Atômico e Reutilizável para Exibição de Pagamento via PIX.
 * Gerencia a apresentação visual do QR Code (Base64), timer de expiração,
 * campo "Copia e Cola" em fonte monoespaçada e botão de cópia com feedback visual em tom emerald.
 */

import React from 'react';
import { Clock, Copy, CheckCircle, QrCode, RefreshCw, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';

export interface PixPaymentDisplayProps {
  /** String da imagem do QR Code em Base64 ou URL de data */
  qrCodeBase64?: string;
  /** Código PIX Copia e Cola */
  copyPasteCode?: string;
  /** String de tempo restante formatada (ex: "14:59") */
  formattedTimeLeft?: string;
  /** Flag indicando se a chave PIX foi copiada para a área de transferência */
  isCopied?: boolean;
  /** Status atual da cobrança no gateway */
  paymentStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  /** Estado de carregamento ao gerar ou renovar cobrança */
  loading?: boolean;
  /** Callback para copiar o código PIX */
  onCopyPix: () => void;
  /** Callback opcional para gerar ou atualizar a chave PIX */
  onGenerateOrRefreshPix?: () => void;
  /** Texto personalizado para o botão de cópia */
  copyButtonText?: string;
  /** Exibir indicador de polling ("Checando aprovação a cada 4s...") */
  showPollingIndicator?: boolean;
  /** Estilos CSS adicionais */
  className?: string;
}

export const PixPaymentDisplay: React.FC<PixPaymentDisplayProps> = ({
  qrCodeBase64,
  copyPasteCode,
  formattedTimeLeft,
  isCopied = false,
  paymentStatus,
  loading = false,
  onCopyPix,
  onGenerateOrRefreshPix,
  copyButtonText,
  showPollingIndicator = false,
  className,
}) => {
  return (
    <div className={cn('space-y-6 text-slate-100', className)}>
      {/* Banner de Expiração e Timer (se fornecido) */}
      {formattedTimeLeft && (
        <div className="rounded-xl bg-[#15121B] border border-[#1E293B] p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-500/10 p-2.5 text-violet-400 border border-violet-500/20">
              <Clock className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Tempo restante para pagar</span>
              <span className="text-sm font-bold text-white">Chave PIX válida por 15 minutos</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-mono font-black text-violet-400 tracking-wider">
              {formattedTimeLeft}
            </span>
          </div>
        </div>
      )}

      {/* Visualizador do QR Code */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 flex flex-col items-center justify-center text-center">
        <div className="relative group p-4 rounded-xl bg-white shadow-2xl border border-slate-200 mb-4 min-h-[190px] w-[190px] flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-violet-600" />
              <span className="text-xs font-medium">Gerando QR Code...</span>
            </div>
          ) : qrCodeBase64 ? (
            <img
              src={qrCodeBase64.startsWith('data:') ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`}
              alt="QR Code PIX"
              className="w-40 h-40 object-contain"
            />
          ) : (
            <div className="w-40 h-40 bg-slate-900 rounded-lg flex flex-col items-center justify-center text-slate-400 p-3">
              <QrCode className="h-16 w-16 text-violet-400 mb-2" />
              <span className="text-[10px] font-mono text-slate-300">QR CODE PIX</span>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 max-w-sm">
          Abra o app do seu banco, escolha a opção <strong className="text-slate-200">PIX com QR Code</strong> e escaneie a imagem acima.
        </p>
      </div>

      {/* Seção Copia e Cola */}
      <div className="space-y-2">
        <label htmlFor="pix-copia-cola-input" className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
          Chave PIX Copia e Cola
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          {!copyPasteCode && !qrCodeBase64 && onGenerateOrRefreshPix ? (
            <Button
              type="button"
              variant="primary"
              onClick={onGenerateOrRefreshPix}
              isLoading={loading}
              iconLeft={<QrCode className="w-4 h-4" />}
              className="w-full min-h-[44px] bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold cursor-pointer"
            >
              Gerar Cobrança PIX
            </Button>
          ) : (
            <>
              <input
                id="pix-copia-cola-input"
                type="text"
                readOnly
                value={copyPasteCode || ''}
                placeholder="Aguardando geração do PIX..."
                aria-label="Código Pix Copia e Cola"
                className="w-full min-h-[44px] h-11 px-3 py-2 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-200 text-base sm:text-sm font-mono truncate focus:outline-none focus:border-violet-500 transition-colors"
              />
              <button
                type="button"
                onClick={onCopyPix}
                disabled={!copyPasteCode}
                className={cn(
                  'min-h-[44px] h-11 px-5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shrink-0 border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                  isCopied
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20'
                    : 'bg-violet-600 hover:bg-violet-500 text-white border-violet-500 shadow-lg shadow-violet-600/20'
                )}
              >
                {isCopied ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>{copyButtonText || 'Copiar Código Pix'}</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Indicador de Polling / Status do Pagamento (opcional) */}
      {showPollingIndicator && (
        <div className="rounded-xl bg-[#15121B] border border-[#1E293B] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {paymentStatus === 'APPROVED' ? (
              <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
                <CheckCircle className="h-5 w-5" />
              </div>
            ) : (
              <Loader2 className="h-5 w-5 text-violet-400 animate-spin shrink-0" />
            )}
            <div>
              <span className="text-xs font-semibold text-slate-200 block">
                {paymentStatus === 'APPROVED'
                  ? 'Pagamento Confirmado!'
                  : 'Aguardando confirmação do pagamento...'}
              </span>
              <span className="text-xs text-slate-400">
                {paymentStatus === 'APPROVED'
                  ? 'Sua transação já foi processada.'
                  : 'Checando aprovação no banco a cada 4 segundos.'}
              </span>
            </div>
          </div>

          {onGenerateOrRefreshPix && (
            <button
              type="button"
              onClick={onGenerateOrRefreshPix}
              disabled={loading}
              aria-label="Atualizar chave PIX"
              className="min-h-[44px] h-11 px-3 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors border border-[#1E293B] rounded-lg bg-[#090D16] cursor-pointer"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              <span className="hidden sm:inline">Gerar Novo</span>
            </button>
          )}
        </div>
      )}

      {/* Selo de Segurança em Rodapé */}
      {!showPollingIndicator && (
        <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Aprovação automática e instantânea em poucos segundos via Banco Central / Mercado Pago.</span>
        </div>
      )}
    </div>
  );
};

export default PixPaymentDisplay;
