import React from 'react';
import { Zap, Sparkles, Save } from 'lucide-react';
import { Drawer } from '@/components/ui/overlay/Drawer';
import { Input, Textarea, Button, Badge } from '@/components/ui';
import { cn } from '@/utils/cn';
import type { CatalogProduct, AITone } from '../types/catalog.types';
import { useEditCopyDrawer } from '../hooks/useEditCopyDrawer';

export interface EditCopyDrawerProps {
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
  isLoading?: boolean;
}

export const EditCopyDrawer: React.FC<EditCopyDrawerProps> = (props) => {
  const { isOpen, product, onClose, onGenerateSuggestion, isLoading = false } = props;

  const {
    titleAi,
    setTitleAi,
    descriptionAi,
    setDescriptionAi,
    tone,
    setTone,
    isGenerating,
    handleSuggestClick,
    handleSubmit,
  } = useEditCopyDrawer(props);

  if (!isOpen || !product) return null;

  const toneOptions: AITone[] = ['Persuasivo', 'Direto', 'Premium'];

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={onClose}
        disabled={isLoading}
      >
        Cancelar
      </Button>

      <Button
        type="submit"
        form="edit-copy-form"
        variant="primary"
        disabled={isLoading || isGenerating}
        isLoading={isLoading}
        iconLeft={!isLoading ? <Save className="w-4 h-4" /> : undefined}
      >
        Salvar & Sincronizar
      </Button>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Edição Fina por IA"
      position="right"
      footer={footer}
    >
      <form id="edit-copy-form" onSubmit={handleSubmit} className="space-y-6">
        {/* SKU Badge & Platform */}
        <div className="flex items-center justify-between p-3.5 bg-[#090D16] rounded-xl border border-slate-800/80">
          <span className="font-mono text-xs font-semibold text-slate-400">
            SKU: <span className="text-violet-300">{product.sku}</span>
          </span>
          <Badge variant="purple">
            {product.platform}
          </Badge>
        </div>

        {/* 1. Título Original (Extraído) - Readonly Itálico */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider font-mono text-slate-400">
            Título Original (Extraído)
          </label>
          <div className="p-3.5 bg-slate-900/60 border border-slate-800/60 rounded-xl text-slate-400 italic text-sm leading-relaxed">
            "{product.titleOriginal}"
          </div>
        </div>

        {/* 2. Seletor de Tom de Voz (Pills Grid) */}
        <div className="space-y-2.5">
          <label className="block text-xs font-semibold uppercase tracking-wider font-mono text-slate-400">
            Tom de Voz da IA
          </label>
          <div className="grid grid-cols-3 gap-2">
            {toneOptions.map((t) => {
              const isSelected = tone === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={cn(
                    'min-h-[44px] h-11 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono cursor-pointer',
                    isSelected
                      ? 'bg-violet-600/25 border-violet-500 text-violet-200 shadow-sm shadow-violet-500/10'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  )}
                >
                  <Sparkles className={cn('w-3.5 h-3.5', isSelected ? 'text-violet-400' : 'text-slate-500')} />
                  <span>{t}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Título Magnético IA + Botão "Nova Sugestão" */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider font-mono text-slate-400">
              Título Magnético (IA)
            </label>
            {onGenerateSuggestion && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSuggestClick}
                disabled={isGenerating}
                isLoading={isGenerating}
                iconLeft={!isGenerating ? <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> : undefined}
                className="text-violet-400 hover:text-violet-300"
              >
                Nova Sugestão
              </Button>
            )}
          </div>
          <Input
            type="text"
            value={titleAi}
            onChange={(e) => setTitleAi(e.target.value)}
            placeholder="Insira o título otimizado por IA..."
            required
          />
        </div>

        {/* 4. Descrição Persuasiva IA */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider font-mono text-slate-400">
            Descrição Persuasiva (IA)
          </label>
          <Textarea
            value={descriptionAi}
            onChange={(e) => setDescriptionAi(e.target.value)}
            rows={7}
            placeholder="Insira a copy de vendas persuasiva gerada pela IA..."
          />
        </div>
      </form>
    </Drawer>
  );
};

