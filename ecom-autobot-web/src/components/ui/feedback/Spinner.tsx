import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  label?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  label,
  className,
  ...props
}) => {
  return (
    <div role="status" className={cn('inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400', className)} {...props}>
      <Loader2 className={cn('animate-spin shrink-0', sizeClasses[size])} />
      {label && <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</span>}
      <span className="sr-only">{label || 'Carregando...'}</span>
    </div>
  );
};
