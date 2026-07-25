import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Copy,
  Check,
  Clock,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import type { CheckoutResultOutput, OrderDetails } from '../types/checkout.type';
import { Modal } from '@/components/ui/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/feedback/Badge';
import { cn } from '@/utils/cn';

export interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkoutResult: CheckoutResultOutput | null;
  onSyncOrder?: (mpOrderId: string) => Promise<OrderDetails | undefined>;
  onPaymentSuccess?: (order: OrderDetails) => void;
  className?: string;
}

export const PixModal: React.FC<PixModalProps> = ({
  isOpen,
  onClose,
  checkoutResult,
  onSyncOrder,
  onPaymentSuccess,
}) => {
  const [copied, setCopied] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(600); // 10 min padrão
  const [isPaid, setIsPaid] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Formatação da imagem Base64 do QR Code PIX
  const getQrCodeBase64Src = (base64Str?: string | null): string => {
    if (!base64Str) return '';
    if (base64Str.startsWith('data:image')) return base64Str;
    return `data:image/png;base64,${base64Str}`;
  };

  // Trata o botão "Copia e Cola" com feedback visual de 2s
  const handleCopyCode = async () => {
    if (!checkoutResult?.pix_qr_code) return;
    try {
      await navigator.clipboard.writeText(checkoutResult.pix_qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback em caso de bloqueio de clipboard
      const input = document.getElementById('pix-copia-cola-input') as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    }
  };

  // Cálculo do tempo restante em segundos a partir da data de expiração
  useEffect(() => {
    if (!checkoutResult?.pix_expiration_date) {
      setTimeLeftSeconds(600);
      return;
    }

    const calcTimeLeft = () => {
      const expTime = new Date(checkoutResult.pix_expiration_date!).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((expTime - now) / 1000));
      setTimeLeftSeconds(diff);
    };

    calcTimeLeft();
    const interval = setInterval(calcTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [checkoutResult?.pix_expiration_date]);

  // Função de polling para sincronização de pagamento PIX
  const checkPaymentStatus = useCallback(async () => {
    if (!checkoutResult?.mp_order_id || !onSyncOrder || isPaid) return;
    try {
      setIsChecking(true);
      const syncedOrder = await onSyncOrder(checkoutResult.mp_order_id);
      if (
        syncedOrder &&
        (syncedOrder.status === 'approved' ||
          syncedOrder.status === 'processed' ||
          syncedOrder.status === 'paid')
      ) {
        setIsPaid(true);
        if (onPaymentSuccess) {
          onPaymentSuccess(syncedOrder);
        }
      }
    } catch (err) {
      console.warn('[PixModal] Erro ao verificar status PIX:', err);
    } finally {
      setIsChecking(false);
    }
  }, [checkoutResult?.mp_order_id, onSyncOrder, isPaid, onPaymentSuccess]);

  // Polling automático a cada 4 segundos quando o modal estiver aberto
  useEffect(() => {
    if (isOpen && checkoutResult && !isPaid) {
      pollingRef.current = setInterval(() => {
        checkPaymentStatus();
      }, 4000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isOpen, checkoutResult, isPaid, checkPaymentStatus]);

  // Formatação do tempo em MM:SS
  const formatTimer = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!checkoutResult) return null;

  const isExpired = timeLeftSeconds <= 0 && !isPaid;
  const qrCodeImage = getQrCodeBase64Src(checkoutResult.pix_qr_code_base64);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pagamento Instantâneo via PIX"
      description="Escaneie o QR Code ou utilize o código Copia e Cola no aplicativo do seu banco."
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <RefreshCw
              className={cn('w-3.5 h-3.5 text-indigo-500', isChecking && 'animate-spin')}
            />
            <span>{isChecking ? 'Verificando pagamento...' : 'Verificação automática ativa'}</span>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-11 min-h-[44px] px-5 text-sm font-semibold"
          >
            {isPaid ? 'Concluir' : 'Fechar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 text-center">
        {/* Banner de Estado de Sucesso */}
        {isPaid ? (
          <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3 animate-scale-up">
            <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-emerald-900 dark:text-emerald-100">
              Pagamento Confirmado!
            </h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Seu pedido foi aprovado com sucesso. O sistema já liberou os recursos da sua conta.
            </p>
          </div>
        ) : isExpired ? (
          /* Banner de Expiração */
          <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-600 dark:text-rose-400 mx-auto" />
            <h3 className="text-lg font-bold text-rose-900 dark:text-rose-200">
              Código PIX Expirado
            </h3>
            <p className="text-xs text-rose-700 dark:text-rose-300">
              O tempo limite para pagamento deste código expirou. Por favor, gere uma nova cobrança.
            </p>
          </div>
        ) : (
          /* Exibição normal do QR Code e Copia e Cola */
          <>
            {/* Cronômetro de Expiração */}
            <div className="flex items-center justify-center gap-2">
              <Badge variant="warning" icon={<Clock className="w-3.5 h-3.5" />}>
                Expira em: <strong className="font-mono text-sm ml-1">{formatTimer(timeLeftSeconds)}</strong>
              </Badge>
            </div>

            {/* Imagem do QR Code PIX */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-[260px] mx-auto shadow-sm">
              {qrCodeImage ? (
                <img
                  src={qrCodeImage}
                  alt="QR Code PIX Mercado Pago"
                  className="w-48 h-48 object-contain rounded-lg shadow-xs"
                />
              ) : (
                <div className="w-48 h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <QrCode className="w-12 h-12 stroke-[1.5]" />
                  <span className="text-xs">QR Code indisponível</span>
                </div>
              )}
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2">
                Abra o app do seu banco e escaneie
              </span>
            </div>

            {/* Campo e Botão PIX Copia e Cola */}
            <div className="space-y-2 text-left">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Código PIX Copia e Cola:
              </label>

              <div className="flex items-center gap-2">
                <input
                  id="pix-copia-cola-input"
                  type="text"
                  readOnly
                  value={checkoutResult.pix_qr_code || ''}
                  className="flex-1 h-11 min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:outline-none select-all"
                />

                <Button
                  type="button"
                  variant={copied ? 'secondary' : 'primary'}
                  size="md"
                  onClick={handleCopyCode}
                  className={cn(
                    'h-11 min-h-[44px] px-4 font-bold text-sm shrink-0 transition-all duration-200',
                    copied && 'bg-emerald-600 text-white hover:bg-emerald-700'
                  )}
                  iconLeft={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </Button>
              </div>
            </div>

            {/* Informação sobre valor total e segurança */}
            <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Mercado Pago Seguro
              </span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                Total: R$ {checkoutResult.total_amount.toFixed(2)}
              </span>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
