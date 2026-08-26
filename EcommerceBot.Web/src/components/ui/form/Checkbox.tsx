import React, { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  indeterminate?: boolean;
  error?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      label,
      description,
      indeterminate = false,
      error = false,
      disabled = false,
      checked,
      id,
      onChange,
      ...props
    },
    ref
  ) => {
    const innerRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    return (
      <label
        htmlFor={id}
        className={cn(
          'inline-flex items-start gap-3 p-1.5 -m-1.5 rounded-lg cursor-pointer min-h-[44px] select-none group',
          disabled && 'cursor-not-allowed opacity-60',
          className
        )}
      >
        <div className="relative flex items-center justify-center shrink-0 mt-0.5">
          <input
            type="checkbox"
            ref={innerRef}
            id={id}
            disabled={disabled}
            checked={checked}
            onChange={onChange}
            aria-invalid={error ? 'true' : undefined}
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              'w-5 h-5 rounded border shadow-sm transition-all duration-150 flex items-center justify-center text-white',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-1',
              checked || indeterminate
                ? 'bg-indigo-600 border-indigo-600 dark:bg-indigo-600 dark:border-indigo-600'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 group-hover:border-slate-400 dark:group-hover:border-slate-600',
              error && !checked && !indeterminate && 'border-red-500 text-red-500',
              disabled && 'opacity-60 cursor-not-allowed'
            )}
          >
            {indeterminate ? (
              <Minus className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
            ) : (
              checked && <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
            )}
          </div>
        </div>

        {(label || description) && (
          <div className="flex flex-col text-sm leading-tight">
            {label && (
              <span
                className={cn(
                  'font-medium text-slate-900 dark:text-slate-100 group-hover:text-slate-800 dark:group-hover:text-slate-200',
                  disabled && 'text-slate-400 dark:text-slate-500'
                )}
              >
                {label}
              </span>
            )}
            {description && (
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
