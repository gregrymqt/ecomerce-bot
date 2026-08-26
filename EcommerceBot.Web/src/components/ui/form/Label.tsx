import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ children, htmlFor, required, className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        htmlFor={htmlFor}
        className={cn(
          'inline-flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 select-none cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
        {required && (
          <span className="ml-1 text-red-500 font-semibold select-none" aria-hidden="true">
            *
          </span>
        )}
      </label>
    );
  }
);

Label.displayName = 'Label';
