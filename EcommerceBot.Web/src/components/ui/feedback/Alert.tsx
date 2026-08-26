import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
}

const variantStyles: Record<AlertVariant, { container: string; icon: string }> = {
  info: {
    container: 'bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-950/50 dark:border-sky-800 dark:text-sky-200',
    icon: 'text-sky-600 dark:text-sky-400',
  },
  success: {
    container: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  error: {
    container: 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200',
    icon: 'text-rose-600 dark:text-rose-400',
  },
};

const icons: Record<AlertVariant, React.ReactNode> = {
  info: <Info className="w-5 h-5" />,
  success: <CheckCircle2 className="w-5 h-5" />,
  warning: <AlertTriangle className="w-5 h-5" />,
  error: <AlertCircle className="w-5 h-5" />,
};

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  className,
  ...props
}) => {
  return (
    <div
      role="alert"
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-xl border text-sm shadow-sm transition-all',
        variantStyles[variant].container,
        className
      )}
      {...props}
    >
      <div className={cn('shrink-0 mt-0.5', variantStyles[variant].icon)}>{icons[variant]}</div>
      <div className="flex-1">
        {title && <h5 className="font-semibold mb-1 leading-tight">{title}</h5>}
        <div className="leading-relaxed">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-1 -mr-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
