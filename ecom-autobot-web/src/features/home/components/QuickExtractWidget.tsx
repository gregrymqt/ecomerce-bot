import React, { useState } from 'react';
import { Sparkles, Link as LinkIcon, Cpu } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Card, Input, Select, Button } from '@/components/ui';
import type { AIModel } from '../types/home.types';

export interface QuickExtractWidgetProps {
  onExtract?: (url: string, model: AIModel) => void | Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export const QuickExtractWidget: React.FC<QuickExtractWidgetProps> = ({
  onExtract,
  isLoading = false,
  className,
}) => {
  const [url, setUrl] = useState('');
  const [model, setModel] = useState<AIModel>('DeepSeek V3');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Por favor, insira uma URL válida de produto.');
      return;
    }
    setError(null);
    if (onExtract) {
      await onExtract(url.trim(), model);
    }
  };

  const modelOptions = [
    { label: 'DeepSeek V3', value: 'DeepSeek V3' },
    { label: 'Groq Llama 3', value: 'Groq Llama 3' },
    { label: 'OpenAI GPT-4o', value: 'OpenAI GPT-4o' },
  ];

  return (
    <Card
      glass
      className={cn(
        'relative overflow-hidden border-slate-800 bg-slate-900/90 shadow-xl shadow-slate-950/50 p-6',
        className
      )}
    >
      {/* Decorative gradient glow effect */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl" />

      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Extração Rápida de Produto</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Insira a URL do produto para raspar metadados e gerar cópias otimizadas com IA.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Input de URL */}
          <div className="flex-1">
            <Input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Cole a URL do e-commerce aqui (ex: Shopify, Nuvemshop)..."
              disabled={isLoading}
              error={Boolean(error)}
              iconLeft={<LinkIcon className="h-5 w-5 text-slate-400" />}
              className="bg-slate-950/80 border-slate-800 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Seletor de Modelo de IA */}
            <div className="min-w-[180px]">
              <Select
                value={model}
                onChange={(e) => setModel(e.target.value as AIModel)}
                disabled={isLoading}
                options={modelOptions}
                iconLeft={<Cpu className="h-4 w-4 text-slate-400" />}
                className="bg-slate-950/80 border-slate-800 text-slate-200"
              />
            </div>

            {/* Botão Extrair & Enriquecer */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              iconLeft={!isLoading ? <Sparkles className="h-4 w-4 text-purple-200 fill-purple-300/20" /> : undefined}
              className="bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25 px-6 whitespace-nowrap"
            >
              {isLoading ? 'Extraindo...' : 'Extrair & Enriquecer'}
            </Button>
          </div>
        </form>

        {error && (
          <p className="text-xs text-rose-400 pl-1 font-medium">{error}</p>
        )}
      </div>
    </Card>
  );
};

export default QuickExtractWidget;
