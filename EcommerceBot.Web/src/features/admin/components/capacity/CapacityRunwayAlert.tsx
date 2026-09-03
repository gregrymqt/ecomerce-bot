import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface CapacityRunwayAlertProps {
  isCritical: boolean;
  runwayDays: number;
  recommendedTopupUsd: number;
}

export const CapacityRunwayAlert: React.FC<CapacityRunwayAlertProps> = ({
  isCritical,
  runwayDays,
  recommendedTopupUsd,
}) => {
  if (!isCritical) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3.5 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 animate-pulse shadow-lg"
    >
      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
      <div className="space-y-1 text-xs sm:text-sm">
        <span className="font-bold text-white block">
          🚨 Atenção: Autonomia de Créditos Abaixo da Margem de Segurança ({runwayDays} dias restantes)
        </span>
        <p className="text-rose-300 leading-relaxed">
          O saldo atual das operadoras de IA pode se esgotar em menos de uma semana com base no consumo atual.
          Recomenda-se uma recarga imediata de no mínimo{' '}
          <strong>${recommendedTopupUsd.toFixed(2)} USD</strong> para evitar interrupções no scraping e LLMs.
        </p>
      </div>
    </div>
  );
};

export default CapacityRunwayAlert;
