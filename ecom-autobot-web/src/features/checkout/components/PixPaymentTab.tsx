/**
 * src/features/checkout/components/PixPaymentTab.tsx
 *
 * Aba de Pagamento Transparente via PIX.
 * Exibe timer regressivo, QR Code Base64, chave Copia e Cola com cópia instantânea e indicador de polling.
 */

import React from 'react';
import { Clock, Copy, CheckCircle, QrCode, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { PixPaymentResponse, PaymentStatus } from '../types/checkout.type';

interface PixPaymentTabProps {
  pixData: PixPaymentResponse | null;
  formattedTimeLeft: string;
  isCopied: boolean;
  paymentStatus: PaymentStatus;
  loading: boolean;
  onCopyPix: () => void;
  onRefreshPix?: () => void;
  className?: string;
}

export const PixPaymentTab: React.FC<PixPaymentTabProps> = ({
  pixData,
  formattedTimeLeft,
  isCopied,
  paymentStatus,
  loading,
  onCopyPix,
  onRefreshPix,
  className,
}) => {
  const pixCode =
    pixData?.qr_code_copy_paste ||
    '00020126580014br.gov.bcb.pix0136ecom-autobot-mp-pix-key-99182305204000053039865405149.005802BR5916ECOM AUTOBOT SAO PAULO6009SAO PAULO62070503***6304E8A2';
  const qrBase64 = pixData?.qr_code_base64;

  return (
    <div className={cn('space-y-6 text-slate-100', className)}>
      {/* Banner de Expiração e Timer */}
      <div className="rounded-xl bg-[#15121B] border border-[#1E293B] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-violet-500/10 p-2.5 text-violet-400 border border-violet-500/20">
            <Clock className="h-5 w-5" />
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

      {/* Visualizador de QR Code */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 flex flex-col items-center justify-center text-center">
        <div className="relative group p-4 rounded-xl bg-white shadow-2xl border border-slate-200 mb-4">
          {qrBase64 ? (
            <img
              src={qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`}
              alt="QR Code PIX"
              className="w-48 h-48 object-contain"
            />
          ) : (
            <div className="w-48 h-48 bg-slate-900 rounded-lg flex flex-col items-center justify-center text-slate-400 p-4">
              <QrCode className="h-16 w-16 text-violet-400 mb-2" />
              <span className="text-xs font-mono break-all text-slate-300">QR CODE PIX</span>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 max-w-sm">
          Abra o app do seu banco, escolha a opção <strong className="text-slate-200">PIX com QR Code</strong> e escaneie a imagem acima.
        </p>
      </div>

      {/* Seção Copia e Cola */}
      <div className="space-y-2">
        <label htmlFor="pix-copia-cola" className="text-xs font-semibold text-slate-300 block">
          Código PIX Copia e Cola
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="pix-copia-cola"
            type="text"
            readOnly
            value={pixCode}
            aria-label="Código Pix Copia e Cola"
            className="w-full min-h-[44px] h-11 px-3 py-2 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-200 text-base sm:text-sm font-mono truncate focus:outline-none focus:border-violet-500 transition-colors"
          />
          <button
            type="button"
            onClick={onCopyPix}
            className={cn(
              'min-h-[44px] h-11 px-5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shrink-0 border cursor-pointer',
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
                <span>Copiar Código Pix</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Barra de Status e Polling */}
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
                ? 'Sua assinatura já foi ativada.'
                : 'Checando aprovação no banco a cada 4 segundos.'}
            </span>
          </div>
        </div>

        {onRefreshPix && (
          <button
            type="button"
            onClick={onRefreshPix}
            disabled={loading}
            aria-label="Atualizar chave PIX"
            className="min-h-[44px] h-11 px-3 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors border border-[#1E293B] rounded-lg bg-[#090D16]"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Gerar Novo</span>
          </button>
        )}
      </div>
    </div>
  );
};
