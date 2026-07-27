import React from 'react';
import {
  CheckCircle2,
  Key,
  ShoppingBag,
  CreditCard,
  Headphones,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Card, Badge, Button } from '@/components/ui';

export interface IntegrationsStatusProps {
  onConfigureKeys?: () => void;
  onOpenSupport?: () => void;
  className?: string;
}

export const IntegrationsStatus: React.FC<IntegrationsStatusProps> = ({
  onConfigureKeys,
  onOpenSupport,
  className,
}) => {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Cards de Status de Integrações */}
      <Card
        glass
        className="border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/40 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Integrações Ativas</h3>
          <span className="text-xs text-purple-400 font-medium">3 de 3 conectadas</span>
        </div>

        <div className="space-y-3">
          {/* Shopify Card */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Shopify API</h4>
                <p className="text-xs text-slate-400">Sincronização de catálogo ativa</p>
              </div>
            </div>
            <Badge variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
              Conectado
            </Badge>
          </div>

          {/* Mercado Pago Card */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Mercado Pago</h4>
                <p className="text-xs text-slate-400">Checkout Transparente e PIX</p>
              </div>
            </div>
            <Badge variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
              Conectado
            </Badge>
          </div>

          {/* BYOK Custom Card */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Chaves IA (BYOK)</h4>
                <p className="text-xs text-slate-400">DeepSeek, Groq, OpenAI, Gemini</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onConfigureKeys}
              iconRight={<ChevronRight className="w-3.5 h-3.5" />}
              className="bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/40 text-purple-300 text-xs font-semibold"
            >
              Configurar
            </Button>
          </div>
        </div>
      </Card>

      {/* Widget "Suporte Prioritário AI" */}
      <Card
        glass
        className="relative overflow-hidden bg-gradient-to-br from-purple-950/70 via-slate-900 to-slate-950 border-purple-500/30 p-5 shadow-xl shadow-purple-950/30"
      >
        <div className="pointer-events-none absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-purple-500/10 blur-2xl" />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Suporte Prioritário AI</h4>
              <p className="text-xs text-purple-200/80">Atendimento e ajuda com integrações</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Precisa de auxílio para ajustar os prompts de enriquecimento ou integrar sua loja?
            Nossa equipe e o bot assistente estão à disposição 24/7.
          </p>

          <Button
            variant="primary"
            size="md"
            onClick={onOpenSupport}
            iconLeft={<Headphones className="w-4 h-4" />}
            iconRight={<ExternalLink className="w-3.5 h-3.5 opacity-70" />}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25 text-xs sm:text-sm"
          >
            Abrir Canal de Atendimento
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default IntegrationsStatus;
