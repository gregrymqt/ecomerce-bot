import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface HelperTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
  id?: string;
  className?: string;
}

export const HelperText = forwardRef<HTMLParagraphElement, HelperTextProps>(
  ({ children, id, className, ...props }, ref) => {
    if (!children) return null;

    return (
      <p
        ref={ref}
        id={id}
        className={cn('text-xs mt-1.5 font-medium text-slate-500 dark:text-slate-400 animate-fade-in', className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);

HelperText.displayName = 'HelperText';
