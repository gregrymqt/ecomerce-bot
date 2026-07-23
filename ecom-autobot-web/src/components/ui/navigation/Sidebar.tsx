import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  badge?: string | number;
  badgeVariant?: 'indigo' | 'emerald' | 'rose' | 'amber';
  active?: boolean;
  onClick?: () => void;
}

export interface SidebarProps {
  brand?: {
    logo?: React.ReactNode;
    name: string;
    description?: string;
  };
  items: SidebarNavItem[];
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  brand,
  items,
  headerSlot,
  footerSlot,
  defaultCollapsed = false,
  className,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const badgeVariants = {
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none"
        aria-label="Abrir Menu Lateral"
      >
        <Menu className="w-5 h-5" />
      </button>

      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-fade-in"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed lg:static top-0 bottom-0 left-0 z-50 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300 ease-in-out select-none',
          isCollapsed ? 'w-20' : 'w-64',
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0',
          className
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800/80 min-h-[64px]">
          {brand && (
            <div className={cn('flex items-center gap-3 overflow-hidden', isCollapsed && 'lg:justify-center w-full')}>
              {brand.logo && <div className="shrink-0 text-indigo-600 dark:text-indigo-400">{brand.logo}</div>}
              {(!isCollapsed || isMobileOpen) && (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-slate-900 dark:text-white truncate text-base leading-snug">
                    {brand.name}
                  </span>
                  {brand.description && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      {brand.description}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {headerSlot && (!isCollapsed || isMobileOpen) && (
          <div className="p-3 border-b border-slate-100 dark:border-slate-800/80">{headerSlot}</div>
        )}

        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {items.map((item) => {
            const isActive = item.active;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.onClick?.();
                  setIsMobileOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 min-h-[44px] cursor-pointer group relative',
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100',
                  isCollapsed && 'lg:justify-center lg:px-0'
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <span className={cn('shrink-0 text-lg', isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300')}>
                  {item.icon}
                </span>

                {(!isCollapsed || isMobileOpen) && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}

                {item.badge && (!isCollapsed || isMobileOpen) && (
                  <span
                    className={cn(
                      'ml-auto px-2 py-0.5 rounded-full text-xs font-semibold shrink-0',
                      badgeVariants[item.badgeVariant || 'indigo']
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {footerSlot && (
          <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 mt-auto">
            {footerSlot}
          </div>
        )}

        <div className="hidden lg:flex items-center justify-end p-2 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isCollapsed ? 'Expandir Sidebar' : 'Recolher Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </aside>
    </>
  );
};
