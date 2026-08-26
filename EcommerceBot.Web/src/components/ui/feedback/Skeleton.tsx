import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'animate-pulse bg-slate-200 dark:bg-slate-800/80',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'h-4 w-full rounded',
        variant === 'rectangular' && 'rounded-lg',
        className
      )}
      {...props}
    />
  );
};
