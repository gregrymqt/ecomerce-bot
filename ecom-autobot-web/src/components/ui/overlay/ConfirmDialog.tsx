import React, { useState } from 'react';
import { AlertTriangle, Trash2, CheckCircle2, HelpCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from '../Button';
import { cn } from '@/lib/utils';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'success' | 'info';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: React.ReactNode;
  variant?: ConfirmDialogVariant;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

const variantConfig: Record<
  ConfirmDialogVariant,
  {
    icon: React.ReactNode;
    haloBg: string;
    iconColor: string;
    buttonVariant: 'danger' | 'primary' | 'secondary';
    defaultConfirmText: string;
  }
> = {
  danger: {
    icon: <Trash2 className="w-8 h-8" />,
    haloBg: 'bg-rose-100 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800',
    iconColor: 'text-rose-600 dark:text-rose-400',
    buttonVariant: 'danger',
    defaultConfirmText: 'Sim, excluir',
  },
  warning: {
    icon: <AlertTriangle className="w-8 h-8" />,
    haloBg: 'bg-amber-100 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-600 dark:text-amber-400',
    buttonVariant: 'primary',
    defaultConfirmText: 'Sim, continuar',
  },
  success: {
    icon: <CheckCircle2 className="w-8 h-8" />,
    haloBg: 'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    buttonVariant: 'primary',
    defaultConfirmText: 'OK, entendido',
  },
  info: {
    icon: <HelpCircle className="w-8 h-8" />,
    haloBg: 'bg-indigo-100 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    buttonVariant: 'primary',
    defaultConfirmText: 'Confirmar',
  },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  variant = 'warning',
  confirmText,
  cancelText = 'Cancelar',
  isLoading: externalLoading = false,
}) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading || internalLoading;

  const config = variantConfig[variant];

  const handleConfirm = async () => {
    try {
      setInternalLoading(true);
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Erro ao executar confirmação:', error);
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} size="sm">
      <div className="flex flex-col items-center text-center p-2">
        <div
          className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center border-2 mb-4 animate-scale-up shadow-sm',
            config.haloBg,
            config.iconColor
          )}
        >
          {config.icon}
        </div>

        <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight mb-2">
          {title}
        </h3>

        <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          {description}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-1/2"
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant={config.buttonVariant}
            isLoading={loading}
            onClick={handleConfirm}
            className="w-full sm:w-1/2"
          >
            {confirmText || config.defaultConfirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
