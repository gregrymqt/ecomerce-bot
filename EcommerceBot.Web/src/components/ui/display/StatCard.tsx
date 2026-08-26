import React from 'react';
import { Card } from './Card';
import { cn } from '@/lib/utils';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon,
  trend,
  className,
  ...props
}) => {
  return (
    <Card className={cn('flex flex-col justify-between gap-3', className)} {...props}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</span>
        {icon && (
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            {icon}
          </div>
        )}
      </div>

      <div>
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {value}
        </div>

        {(description || trend) && (
          <div className="flex items-center gap-2 mt-1 text-xs">
            {trend && (
              <span
                className={cn(
                  'font-semibold px-1.5 py-0.5 rounded',
                  trend.isPositive
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                )}
              >
                {trend.isPositive ? '+' : ''}
                {trend.value}
              </span>
            )}
            {description && <span className="text-slate-500 dark:text-slate-400">{description}</span>}
          </div>
        )}
      </div>
    </Card>
  );
};
