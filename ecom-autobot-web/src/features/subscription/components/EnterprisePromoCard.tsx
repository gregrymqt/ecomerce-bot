import React from 'react';
import { Rocket, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui';
import { cn } from '@/utils/cn';

export interface EnterprisePromoCardProps {
  onContactEnterprise?: () => void;
  className?: string;
}

export const EnterprisePromoCard: React.FC<EnterprisePromoCardProps> = ({
  onContactEnterprise,
  className,
}) => {
  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-[#111827] via-slate-900 to-indigo-950/40 p-6 sm:p-8 shadow-xl flex flex-col justify-between',
        className
      )}
    >
      {/* Background Decorator */}
      <div
        className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="flex flex-col justify-between gap-6 h-full">
        <div>
          {/* Header & Rocket Badge */}
          <div className="mb-4">
            <Badge variant="purple" icon={<Rocket className="h-3.5 w-3.5 text-indigo-400" />}>
              Scale with AI
            </Badge>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
            Precisa de volume sob medida para sua operação?
          </h3>

          <p className="text-sm text-gray-300 leading-relaxed mb-4">
            Garanta servidores dedicados de scraping, API key exclusiva sem limites de requisição e gerente de conta dedicado para seu e-commerce.
          </p>

          <ul className="space-y-2 text-xs text-gray-300 font-medium font-mono">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-400 shrink-0" />
              SLA de 99.9% de uptime garantido
            </li>
            <li className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-400 shrink-0" />
              Scraping ilimitado concorrente em paralelo
            </li>
          </ul>
        </div>

        <div>
          <Button
            type="button"
            variant="primary"
            onClick={onContactEnterprise}
            iconRight={<ArrowRight className="h-4 w-4" />}
            className="w-full"
          >
            Falar com Consultor Enterprise
          </Button>
        </div>
      </div>
    </Card>
  );
};

