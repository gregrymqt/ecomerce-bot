import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface DropdownMenuItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  align = 'right',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-2 w-56 rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 py-1 focus:outline-none animate-fade-in',
            align === 'right' ? 'right-0' : 'left-0',
            className
          )}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  setIsOpen(false);
                }
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-left transition-colors min-h-[44px] md:min-h-0',
                item.danger
                  ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
                item.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
