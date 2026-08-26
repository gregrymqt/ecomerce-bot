import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ErrorMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
  id?: string;
  className?: string;
}

export const ErrorMessage = forwardRef<HTMLParagraphElement, ErrorMessageProps>(
  ({ children, id, className, ...props }, ref) => {
    if (!children) return null;

    return (
      <p
        ref={ref}
        id={id}
        role="alert"
        className={cn('text-xs mt-1.5 font-medium text-red-600 dark:text-red-400 animate-fade-in', className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);

ErrorMessage.displayName = 'ErrorMessage';
