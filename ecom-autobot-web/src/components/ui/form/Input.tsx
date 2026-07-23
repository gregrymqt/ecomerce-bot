import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, iconLeft, iconRight, disabled, type = 'text', ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {iconLeft && (
          <div className="absolute left-3 inset-y-0 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-500">
            {iconLeft}
          </div>
        )}
        <input
          type={type}
          ref={ref}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          className={cn(
            'w-full rounded-lg border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm transition-all duration-200',
            'h-11 md:h-10 text-base md:text-sm px-3.5',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
            error
              ? 'border-red-500 text-red-900 dark:text-red-100 focus-visible:ring-red-500 focus-visible:border-red-500'
              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 focus-visible:ring-indigo-500 focus-visible:border-indigo-500',
            'disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed disabled:hover:border-slate-300 dark:disabled:hover:border-slate-700',
            iconLeft && 'pl-10',
            iconRight && 'pr-10',
            className
          )}
          {...props}
        />
        {iconRight && (
          <div className="absolute right-3 inset-y-0 flex items-center justify-center text-slate-400 dark:text-slate-500">
            {iconRight}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
