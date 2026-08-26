import React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  showPercentage?: boolean;
  label?: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose';
}

const colorStyles = {
  indigo: 'bg-indigo-600 dark:bg-indigo-500',
  emerald: 'bg-emerald-600 dark:bg-emerald-500',
  amber: 'bg-amber-500 dark:bg-amber-400',
  rose: 'bg-rose-600 dark:bg-rose-500',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  showPercentage = false,
  label,
  color = 'indigo',
  className,
  ...props
}) => {
  const percentage = Math.min(Math.max(0, Math.round((value / max) * 100)), 100);

  return (
    <div className={cn('w-full flex flex-col gap-1.5', className)} {...props}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center text-xs font-medium text-slate-700 dark:text-slate-300">
          {label && <span>{label}</span>}
          {showPercentage && <span className="ml-auto">{percentage}%</span>}
        </div>
      )}
      <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300 ease-out rounded-full', colorStyles[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
