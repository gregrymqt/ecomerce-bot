import React, { useState, useEffect } from 'react';
import type { CatalogProduct, AITone } from '@/features/catalog';

export interface UseEditCopyDrawerProps {
  isOpen: boolean;
  product: CatalogProduct | null;
  onClose: () => void;
  onSave: (
    sku: string,
    data: { titleAi: string; descriptionAi: string; tone: AITone }
  ) => Promise<void> | void;
  onGenerateSuggestion?: (
    sku: string,
    tone: AITone
  ) => Promise<{ titleAi?: string; descriptionAi?: string } | void> | void;
}

export function useEditCopyDrawer({
  isOpen,
  product,
  onClose,
  onSave,
  onGenerateSuggestion,
}: UseEditCopyDrawerProps) {
  const [titleAi, setTitleAi] = useState('');
  const [descriptionAi, setDescriptionAi] = useState('');
  const [tone, setTone] = useState<AITone>('Persuasivo');
  const [isGenerating, setIsGenerating] = useState(false);

  // Sincroniza o estado interno quando um novo produto é aberto
  useEffect(() => {
    if (product) {
      setTitleAi(product.titleAi || '');
      setDescriptionAi(product.descriptionAi || '');
    }
  }, [product]);

  // Handler para tecla ESC e trava do scroll do body
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleSuggestClick = async () => {
    if (!onGenerateSuggestion || !product) return;
    setIsGenerating(true);
    try {
      const res = await onGenerateSuggestion(product.sku, tone);
      if (res) {
        if (res.titleAi) setTitleAi(res.titleAi);
        if (res.descriptionAi) setDescriptionAi(res.descriptionAi);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (product) {
      await onSave(product.sku, { titleAi, descriptionAi, tone });
    }
  };

  return {
    titleAi,
    setTitleAi,
    descriptionAi,
    setDescriptionAi,
    tone,
    setTone,
    isGenerating,
    handleSuggestClick,
    handleSubmit,
  };
}
