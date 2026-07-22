import React, { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ToggleSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
}

export const ToggleSwitch = forwardRef<HTMLButtonElement, ToggleSwitchProps>(
  (
    {
      checked: controlledChecked,
      defaultChecked = false,
      onChange,
      label,
      description,
      disabled = false,
      id,
      name,
      className,
    },
    ref
  ) => {
    const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);
    const isChecked = controlledChecked !== undefined ? controlledChecked : uncontrolledChecked;

    const handleToggle = () => {
      if (disabled) return;
      const nextChecked = !isChecked;
      if (controlledChecked === undefined) {
        setUncontrolledChecked(nextChecked);
      }
      onChange?.(nextChecked);
    };

    return (
      <div
        className={cn(
          // Touch target container min-h-[44px]
          'inline-flex items-start gap-3 p-1.5 -m-1.5 rounded-lg min-h-[44px] select-none cursor-pointer group',
          disabled && 'cursor-not-allowed opacity-60',
          className
        )}
        onClick={handleToggle}
      >
        <button
          ref={ref}
          type="button"
          role="switch"
          id={id}
          aria-checked={isChecked}
          disabled={disabled}
          className={cn(
            // Switch Track
            'relative inline-flex h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer mt-0.5',
            // Focus state
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
            // Colors: Checked vs Unchecked
            isChecked
              ? 'bg-indigo-600 dark:bg-indigo-600'
              : 'bg-slate-300 dark:bg-slate-700 group-hover:bg-slate-400 dark:group-hover:bg-slate-600',
            disabled && 'cursor-not-allowed'
          )}
        >
          {/* Hidden input for HTML form submission compatibility if name is passed */}
          {name && (
            <input
              type="checkbox"
              name={name}
              checked={isChecked}
              onChange={() => {}}
              className="sr-only"
              tabIndex={-1}
            />
          )}

          {/* Switch Knob / Thumb */}
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white dark:bg-slate-100 shadow-md transform ring-0 transition duration-200 ease-in-out',
              isChecked ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>

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
      </div>
    );
  }
);

ToggleSwitch.displayName = 'ToggleSwitch';
