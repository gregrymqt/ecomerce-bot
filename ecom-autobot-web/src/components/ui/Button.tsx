import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm disabled:bg-indigo-400 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:disabled:bg-indigo-400/50',
  secondary:
    'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:active:bg-slate-600',
  outline:
    'border border-slate-300 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700',
  ghost:
    'bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700',
  danger:
    'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-sm disabled:bg-red-400 dark:bg-red-600 dark:hover:bg-red-500 dark:disabled:bg-red-400/50',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs min-h-[44px] md:min-h-0',
  md: 'h-11 md:h-10 px-4 text-base md:text-sm font-medium',
  lg: 'h-12 md:h-11 px-6 text-base font-semibold',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      iconLeft,
      iconRight,
      children,
      className,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 select-none cursor-pointer',
          // Tactile touch feedback on mobile
          'active:scale-[0.98]',
          // Focus ring
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
          // Disabled state
          'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
          // Variants and Sizes
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" aria-hidden="true" />
        ) : (
          iconLeft && <span className="shrink-0 text-current">{iconLeft}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && iconRight && <span className="shrink-0 text-current">{iconRight}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
