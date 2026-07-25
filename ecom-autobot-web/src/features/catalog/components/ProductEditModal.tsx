import React, { useState, useEffect } from 'react';
import type { Product, ProductStatus } from '../types/product.type';
import { cn } from '@/utils/cn';
import { X, Loader2 } from 'lucide-react';

interface ProductEditModalProps {
  isOpen: boolean;
  product: Product | null;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (sku: string, payload: {
    title: string;
    description: string;
    price: number;
    status: ProductStatus | string;
  }) => Promise<boolean>;
}

export const ProductEditModal: React.FC<ProductEditModalProps> = ({
  isOpen,
  product,
  isLoading = false,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | string>('');
  const [status, setStatus] = useState<string>('RAW');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setTitle(product.title || '');
      setDescription(product.description || product.copywriting || '');
      setPrice(product.price !== undefined && product.price !== null ? product.price : '');
      setStatus(String(product.status || 'RAW').toUpperCase());
      setErrorMsg(null);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedPrice = typeof price === 'number' ? price : parseFloat(price);

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setErrorMsg('Por favor, informe um preço válido.');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('O título do produto é obrigatório.');
      return;
    }

    const success = await onSave(product.sku, {
      title: title.trim(),
      description: description.trim(),
      price: parsedPrice,
      status,
    });

    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Editar Produto
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              SKU: {product.sku}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Fechar Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Title Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Título do Produto *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título do produto..."
              className={cn(
                'w-full min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all',
                'text-base sm:text-sm' // EVITA AUTO-ZOOM NO SAFARI IOS (font-size >= 16px)
              )}
              required
            />
          </div>

          {/* Grid de Preço e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Preço (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className={cn(
                  'w-full min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all',
                  'text-base sm:text-sm'
                )}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={cn(
                  'w-full min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all',
                  'text-base sm:text-sm'
                )}
              >
                <option value="RAW">RAW (Bruto)</option>
                <option value="PROCESSING">PROCESSING (Processando)</option>
                <option value="PROCESSED">PROCESSED (Enriquecido)</option>
                <option value="FAILED">FAILED (Falhou)</option>
                <option value="EXPORTED">EXPORTED (Exportado)</option>
              </select>
            </div>
          </div>

          {/* Description Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Copywriting / Descrição
            </label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Digite a descrição ou copy magnética do produto..."
              className={cn(
                'w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-y min-h-[120px]',
                'text-base sm:text-sm'
              )}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salbrando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
