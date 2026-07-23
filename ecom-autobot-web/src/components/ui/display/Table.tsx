import React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '../feedback/Skeleton';

export interface TableColumn<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'Nenhum registro encontrado.',
  emptyIcon,
  onRowClick,
  className,
}: TableProps<T>) {
  const alignClasses = {
    left: 'text-left justify-start',
    center: 'text-center justify-center',
    right: 'text-right justify-end',
  };

  return (
    <div className={cn('w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm', className)}>
      <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300 border-collapse">
        <thead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 select-none">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={cn('px-4 py-3.5 font-semibold', alignClasses[col.align || 'left'], col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, rIdx) => (
              <tr key={`skeleton-${rIdx}`}>
                {columns.map((col) => (
                  <td key={`skeleton-col-${col.key}`} className="px-4 py-4">
                    <Skeleton className="h-4 w-full rounded" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                <div className="flex flex-col items-center justify-center gap-2">
                  {emptyIcon && <div className="text-slate-300 dark:text-slate-600">{emptyIcon}</div>}
                  <p className="text-sm font-medium">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, rIdx) => {
              const rowKey = keyExtractor(row, rIdx);
              const isClickable = Boolean(onRowClick);

              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick?.(row, rIdx)}
                  className={cn(
                    'transition-colors duration-150',
                    isClickable && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800/70',
                    !isClickable && 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                  )}
                >
                  {columns.map((col) => {
                    const value = (row as Record<string, unknown>)[col.key];
                    const content = col.render ? col.render(row, rIdx) : (value as React.ReactNode);

                    return (
                      <td
                        key={`${rowKey}-${col.key}`}
                        className={cn('px-4 py-3.5 align-middle', alignClasses[col.align || 'left'], col.className)}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
