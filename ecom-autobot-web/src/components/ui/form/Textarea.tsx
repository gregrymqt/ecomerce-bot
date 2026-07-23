import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, rows = 4, disabled, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        aria-invalid={error ? 'true' : undefined}
        className={cn(
          'w-full rounded-lg border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm transition-all duration-200 resize-y',
          'p-3 text-base md:text-sm min-h-[88px]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          error
            ? 'border-red-500 text-red-900 dark:text-red-100 focus-visible:ring-red-500 focus-visible:border-red-500'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 focus-visible:ring-indigo-500 focus-visible:border-indigo-500',
          'disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed disabled:hover:border-slate-300 dark:disabled:hover:border-slate-700',
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
