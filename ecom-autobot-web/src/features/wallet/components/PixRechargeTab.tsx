/**
 * src/features/wallet/components/PixRechargeTab.tsx
 *
 * Componente visual de apresentação (UI Pura) da aba de Pagamento via PIX.
 * Consome o hook usePixRecharge para gerenciar a contagem regressiva e cópia para o clipboard.
 */

import React from 'react';
import { QrCode, Copy, Check, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/display/Card';
import { Input } from '@/components/ui/form/Input';
import { Button } from '@/components/ui/Button';
import { usePixRecharge } from '../hooks/usePixRecharge';

export interface PixRechargeTabProps {
  pixQrCode?: string;
  pixCopiaECola?: string;
  expirationDate?: string;
  loading: boolean;
  onGeneratePix?: () => void;
}

export const PixRechargeTab: React.FC<PixRechargeTabProps> = ({
  pixQrCode,
  pixCopiaECola,
  loading,
  onGeneratePix,
}) => {
  // Consome a lógica desacoplada via custom hook
  const { isCopied, formattedTimeLeft, handleCopyPixCode } = usePixRecharge(pixCopiaECola);

  return (
    <Card
      glass
      className="bg-[#221e2c]/90 border-[#3c3647] rounded-xl p-5 sm:p-6 relative overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-[#a078ff] before:to-[#6d3bd7] text-[#e7e0ed] space-y-6"
    >
      {/* Header com Timer Regressivo */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#3c3647]">
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-[#a078ff]" />
          <h3 className="text-sm font-bold text-[#e7e0ed]">
            Pagamento via PIX Instantâneo
          </h3>
        </div>

        {/* Timer Regressivo em Tom Violeta */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#a078ff]/10 border border-[#a078ff]/30 rounded-full text-[#d0bcff] font-mono text-xs font-semibold">
          <Clock className="w-3.5 h-3.5 text-[#a078ff] animate-pulse" />
          <span>Expira em {formattedTimeLeft}</span>
        </div>
      </div>

      {/* Conteúdo Principal: Grid QR Code + Campo Copia e Cola */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
        {/* Lado Esquerdo: Container do QR Code (Fundo Branco Arredondado) */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center">
          <div className="p-3 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center justify-center min-h-[190px] w-[190px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin text-[#a078ff]" />
                <span className="text-xs font-medium">Gerando QR Code...</span>
              </div>
            ) : pixQrCode ? (
              <img
                src={pixQrCode.startsWith('data:') ? pixQrCode : `data:image/png;base64,${pixQrCode}`}
                alt="QR Code PIX"
                className="w-40 h-40 object-contain"
              />
            ) : (
              // Placeholder de QR Code Ilustrativo caso não venha base64
              <div className="w-40 h-40 bg-slate-900 rounded-lg flex flex-col items-center justify-center text-center p-2 text-white">
                <QrCode className="w-20 h-20 text-[#a078ff] mb-1" />
                <span className="text-[10px] text-slate-300 font-mono">Escaneie o QR Code</span>
              </div>
            )}
          </div>
          <span className="text-[11px] text-[#978e9e] mt-2 text-center">
            Abra o app do seu banco e escolha a opção PIX
          </span>
        </div>

        {/* Lado Direito: Instrução, Campo Copia e Cola e Botão */}
        <div className="sm:col-span-7 space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#cabed0]">
              Chave PIX Copia e Cola
            </label>
            <p className="text-xs text-[#978e9e]">
              Copie a chave abaixo para realizar a transferência no seu aplicativo bancário:
            </p>
          </div>

          {/* Campo de Texto Somente Leitura em JetBrains Mono */}
          <div className="space-y-2">
            {!pixCopiaECola && !pixQrCode && onGeneratePix ? (
              <Button
                type="button"
                variant="primary"
                onClick={onGeneratePix}
                isLoading={loading}
                iconLeft={<QrCode className="w-4 h-4" />}
                className="w-full min-h-[44px] bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white font-semibold cursor-pointer"
              >
                Gerar Cobrança PIX
              </Button>
            ) : (
              <>
                <Input
                  readOnly
                  value={pixCopiaECola || ''}
                  placeholder="Aguardando geração do PIX..."
                  className="font-mono text-xs bg-[#17141d] border-[#494454] text-[#d0bcff] selection:bg-[#a078ff]/30 min-h-[44px]"
                />

                {/* Botão de Cópia com Feedback Visual */}
                <Button
                  type="button"
                  variant={isCopied ? 'secondary' : 'primary'}
                  onClick={handleCopyPixCode}
                  disabled={!pixCopiaECola}
                  iconLeft={
                    isCopied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )
                  }
                  className={`w-full min-h-[44px] font-semibold transition-all cursor-pointer ${
                    isCopied
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white hover:opacity-90'
                  }`}
                >
                  {isCopied ? 'Chave PIX Copiada!' : 'Copiar Chave PIX'}
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1 text-[11px] text-[#978e9e]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Aprovação automática e instantânea em poucos segundos.</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PixRechargeTab;
