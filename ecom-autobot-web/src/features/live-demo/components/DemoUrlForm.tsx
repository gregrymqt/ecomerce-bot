import React, { useState } from 'react';
import { Globe, Plus, Trash2, Zap } from 'lucide-react';
import { Card } from '@/components/ui/display/Card';
import { FormField } from '@/components/ui/form/FormField';
import { Button } from '@/components/ui/Button';
import type { DemoUrlFormProps } from '..';

export const DemoUrlForm: React.FC<DemoUrlFormProps> = ({
  onSubmit,
  isLoading = false,
  className,
}) => {
  const [urls, setUrls] = useState<string[]>(['']);
  const [errors, setErrors] = useState<Record<number, string>>({});

  const handleAddUrl = () => {
    if (urls.length < 3) {
      setUrls((prev) => [...prev, '']);
    }
  };

  const handleRemoveUrl = (index: number) => {
    if (urls.length > 1) {
      setUrls((prev) => prev.filter((_, i) => i !== index));
      setErrors((prev) => {
        const newErrors: Record<number, string> = {};
        Object.entries(prev).forEach(([key, val]) => {
          const k = Number(key);
          if (k < index) newErrors[k] = val;
          else if (k > index) newErrors[k - 1] = val;
        });
        return newErrors;
      });
    }
  };

  const handleChangeUrl = (index: number, value: string) => {
    setUrls((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

    if (errors[index]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<number, string> = {};
    let isValid = true;

    urls.forEach((url, i) => {
      const trimmed = url.trim();
      if (!trimmed) {
        newErrors[i] = 'Por favor, insira a URL do produto.';
        isValid = false;
        return;
      }

      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          newErrors[i] = 'A URL deve iniciar com http:// ou https://';
          isValid = false;
        }
      } catch {
        newErrors[i] = 'URL inválida. Ex: https://sualoja.com.br/produto';
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const cleanUrls = urls.map((u) => u.trim());
      onSubmit(cleanUrls);
    }
  };

  return (
    <Card className={className}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            Testar Extração ao Vivo
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Insira de 1 a 3 URLs de produtos de e-commerce para visualizar o fluxo em tempo real de extração e enriquecimento com IA.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {urls.map((url, index) => (
            <div key={index} className="flex items-start gap-2">
              <FormField
                label={`URL do Produto #${index + 1}`}
                placeholder="https://exemplo.com.br/produto"
                value={url}
                onChange={(e) => handleChangeUrl(index, e.target.value)}
                error={errors[index]}
                disabled={isLoading}
                iconLeft={<Globe className="w-4 h-4 text-slate-400" />}
                required
                containerClassName="flex-1"
              />

              {urls.length > 1 && (
                <div className="pt-7">
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => handleRemoveUrl(index)}
                    disabled={isLoading}
                    aria-label={`Remover URL ${index + 1}`}
                    className="min-h-[44px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-3"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {urls.length < 3 ? (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleAddUrl}
              disabled={isLoading}
              iconLeft={<Plus className="w-4 h-4" />}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Adicionar URL ({urls.length}/3)
            </Button>
          ) : (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 self-center">
              Limite máximo atingido (3/3 URLs)
            </span>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            iconLeft={<Zap className="w-4 h-4" />}
            className="w-full sm:w-auto h-11 min-h-[44px]"
          >
            {isLoading ? 'Iniciando Extração...' : 'Iniciar Extração'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
