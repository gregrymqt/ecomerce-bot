/**
 * src/features/catalog/components/DeleteProductModal.tsx
 *
 * Modal acessível de confirmação para exclusão definitiva de produto no catálogo.
 */

import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/overlay/Modal';
import { Button } from '@/components/ui/Button';

export interface DeleteProductModalProps {
  sku: string | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sku: string) => Promise<void> | void;
}

export const DeleteProductModal: React.FC<DeleteProductModalProps> = ({
  sku,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !sku) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(sku);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-end gap-3 w-full">
      <Button
        type="button"
        variant="secondary"
        onClick={onClose}
        disabled={isDeleting}
        className="min-h-[44px]"
      >
        Cancelar
      </Button>
      <Button
        type="button"
        variant="danger"
        onClick={handleConfirm}
        isLoading={isDeleting}
        disabled={isDeleting}
        iconLeft={<Trash2 className="w-4 h-4" />}
        className="min-h-[44px] bg-rose-600 hover:bg-rose-500 text-white font-semibold"
      >
        {isDeleting ? 'Excluindo...' : 'Excluir Produto'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Excluir Produto do Catálogo"
      description="Esta ação removerá o produto e todo o histórico de copywriting associado."
      size="sm"
      footer={footer}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3.5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="text-sm leading-relaxed">
            <p className="font-semibold text-slate-100 mb-1">
              Tem certeza que deseja excluir o SKU <span className="font-mono text-rose-300 font-bold">{sku}</span>?
            </p>
            <p className="text-slate-400 text-xs">
              O produto deixará de ser sincronizado e será removido do banco de dados do tenant.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteProductModal;
