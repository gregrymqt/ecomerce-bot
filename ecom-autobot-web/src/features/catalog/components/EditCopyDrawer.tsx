import React from 'react';
import { X, Zap, Sparkles, Loader2, Save, Wand2 } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop Escuro */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-[#15121B] border-l border-slate-800 text-slate-100 shadow-2xl flex flex-col justify-between transform transition-transform duration-300 ease-in-out">
          
          {/* Header do Drawer */}
          <div className="px-6 py-5 border-b border-slate-800/80 bg-[#090D16]/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-600/10 border border-violet-500/20 rounded-xl text-violet-400">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                  Edição Fina por IA
                </h2>
                <p className="text-xs text-slate-400">
                  Refine o copywriting e a mensagem do produto
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors flex items-center justify-center"
              title="Fechar Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body com Scroll Interno */}
          <form id="edit-copy-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* SKU Badge & Platform */}
            <div className="flex items-center justify-between p-3.5 bg-[#090D16] rounded-xl border border-slate-800/80">
              <span className="font-mono text-xs font-semibold text-slate-400">
                SKU: <span className="text-violet-300">{product.sku}</span>
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {product.platform}
              </span>
            </div>

            {/* 1. Título Original (Extraído) - Readonly Itálico */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Título Original (Extraído)
              </label>
              <div className="p-3.5 bg-slate-900/60 border border-slate-800/60 rounded-xl text-slate-400 italic text-sm leading-relaxed">
                "{product.titleOriginal}"
              </div>
            </div>

            {/* 2. Seletor de Tom de Voz (Pills Grid) */}
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
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
                        'min-h-[44px] h-11 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500',
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Título Magnético (IA)
                </label>
                {onGenerateSuggestion && (
                  <button
                    type="button"
                    onClick={handleSuggestClick}
                    disabled={isGenerating}
                    className="min-h-[44px] text-xs text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-violet-950/40 border border-transparent hover:border-violet-800/30 transition-all disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    )}
                    <span>Nova Sugestão</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={titleAi}
                onChange={(e) => setTitleAi(e.target.value)}
                placeholder="Insira o título otimizado por IA..."
                required
                className={cn(
                  'w-full min-h-[44px] h-11 px-4 rounded-xl border border-slate-700/80 bg-[#090D16] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all',
                  'text-base sm:text-sm'
                )}
              />
            </div>

            {/* 4. Descrição Persuasiva IA */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Descrição Persuasiva (IA)
              </label>
              <textarea
                value={descriptionAi}
                onChange={(e) => setDescriptionAi(e.target.value)}
                rows={7}
                placeholder="Insira a copy de vendas persuasiva gerada pela IA..."
                className={cn(
                  'w-full p-4 rounded-xl border border-slate-700/80 bg-[#090D16] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all leading-relaxed resize-y',
                  'text-base sm:text-sm'
                )}
              />
            </div>
          </form>

          {/* Footer Fixo */}
          <div className="px-6 py-4 border-t border-slate-800/80 bg-[#090D16]/80 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="min-h-[44px] h-11 px-5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-semibold text-sm transition-all disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              form="edit-copy-form"
              disabled={isLoading || isGenerating}
              className="min-h-[44px] h-11 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all flex items-center gap-2 shadow-lg shadow-violet-600/25 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar & Sincronizar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
