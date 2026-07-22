import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[];
  error?: boolean;
  iconLeft?: React.ReactNode;
  placeholder?: string;
  children?: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, options, error, iconLeft, placeholder, children, disabled, value, defaultValue, ...props },
    ref
  ) => {
    return (
      <div className="relative flex items-center w-full">
        {iconLeft && (
          <div className="absolute left-3 inset-y-0 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-500 z-10">
            {iconLeft}
          </div>
        )}
        <select
          ref={ref}
          disabled={disabled}
          value={value}
          defaultValue={defaultValue}
          aria-invalid={error ? 'true' : undefined}
          className={cn(
            // Base styles: appearance-none hides native browser arrow, h-11 mobile touch target, text-base on mobile to avoid iOS Safari auto-zoom
            'w-full appearance-none rounded-lg border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm transition-all duration-200 cursor-pointer',
            'h-11 md:h-10 text-base md:text-sm pl-3.5 pr-10',
            // Focus ring & states
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
            // Conditional States: Normal vs Error
            error
              ? 'border-red-500 text-red-900 dark:text-red-100 focus-visible:ring-red-500 focus-visible:border-red-500'
              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 focus-visible:ring-indigo-500 focus-visible:border-indigo-500',
            // Disabled State
            'disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed disabled:hover:border-slate-300 dark:disabled:hover:border-slate-700',
            // Left icon padding adjustment
            iconLeft && 'pl-10',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <div className="absolute right-3 inset-y-0 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-500">
          <ChevronDown className="w-4 h-4 shrink-0" />
        </div>
      </div>
    );
  }
);

Select.displayName = 'Select';
