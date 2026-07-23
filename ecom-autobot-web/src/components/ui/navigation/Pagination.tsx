import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../Button';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  className,
}) => {
  if (totalPages <= 1) return null;

  const startItem = itemsPerPage ? (currentPage - 1) * itemsPerPage + 1 : undefined;
  const endItem = itemsPerPage && totalItems ? Math.min(currentPage * itemsPerPage, totalItems) : undefined;

  return (
    <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1 select-none', className)}>
      {totalItems !== undefined && startItem && endItem ? (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Exibindo <span className="font-semibold text-slate-900 dark:text-white">{startItem}</span> a{' '}
          <span className="font-semibold text-slate-900 dark:text-white">{endItem}</span> de{' '}
          <span className="font-semibold text-slate-900 dark:text-white">{totalItems}</span> registros
        </span>
      ) : (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Página <span className="font-semibold text-slate-900 dark:text-white">{currentPage}</span> de{' '}
          <span className="font-semibold text-slate-900 dark:text-white">{totalPages}</span>
        </span>
      )}

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          iconLeft={<ChevronLeft className="w-4 h-4" />}
        >
          Anterior
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          iconRight={<ChevronRight className="w-4 h-4" />}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
};
