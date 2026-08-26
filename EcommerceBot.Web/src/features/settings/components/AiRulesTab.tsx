/**
 * src/features/settings/components/AiRulesTab.tsx
 *
 * Aba de Configurações das Regras de IA, Tom de Voz, Tags de SEO e Precificação.
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Megaphone,
  Wrench,
  Zap,
  Smile,
  Globe,
  Tag,
  Plus,
  X,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type {
  AiSettingsPayload,
  DefaultLanguage,
  RoundingRule,
  ToneOfVoice,
} from '@/features/settings';

interface AiRulesTabProps {
  data: AiSettingsPayload;
  onChange: <K extends keyof AiSettingsPayload>(field: K, value: AiSettingsPayload[K]) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  className?: string;
}

export const AiRulesTab: React.FC<AiRulesTabProps> = ({
  data,
  onChange,
  onAddTag,
  onRemoveTag,
  className,
}) => {
  const [newTagInput, setNewTagInput] = useState('');

  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagInput.trim()) {
      onAddTag(newTagInput.trim());
      setNewTagInput('');
    }
  };

  const tones: { id: ToneOfVoice; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      id: 'PERSUASIVE',
      label: 'Persuasivo & Vendedor',
      desc: 'Títulos chamativos e gatilhos mentais de alta conversão.',
      icon: <Megaphone className="h-5 w-5 text-violet-400" />,
    },
    {
      id: 'TECHNICAL',
      label: 'Técnico & Factual',
      desc: 'Foco em especificações, materiais e precisão descritiva.',
      icon: <Wrench className="h-5 w-5 text-blue-400" />,
    },
    {
      id: 'DIRECT',
      label: 'Direto & Objetivo',
      desc: 'Frases curtas, listas bulleted e rápida leitura.',
      icon: <Zap className="h-5 w-5 text-amber-400" />,
    },
    {
      id: 'CASUAL',
      label: 'Descontraído & Jovem',
      desc: 'Linguagem leve, amigável e conectada às redes sociais.',
      icon: <Smile className="h-5 w-5 text-emerald-400" />,
    },
  ];

  return (
    <div className={cn('space-y-8 text-slate-100', className)}>
      {/* Seção 1: Idioma Padrão da LLM */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Idioma Padrão para Enriquecimento</h3>
            <p className="text-xs text-slate-400">Idioma utilizado pela LLM no copywriting e tags de SEO</p>
          </div>
        </div>

        <div className="max-w-md">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Idioma de Destino
          </label>
          <select
            value={data.default_language}
            onChange={(e) => onChange('default_language', e.target.value as DefaultLanguage)}
            className="w-full min-h-[44px] h-11 px-4 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all cursor-pointer"
          >
            <option value="PT_BR">Português (Brasil)</option>
            <option value="EN_US">Inglês (Estados Unidos)</option>
            <option value="ES">Espanhol</option>
          </select>
        </div>
      </div>

      {/* Seção 2: Seletor Visual de Tom de Voz (Cards de Radio) */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Tom de Voz da Inteligência Artificial</h3>
            <p className="text-xs text-slate-400">Selecione como os títulos e cópias dos produtos devem soar</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {tones.map((t) => {
            const isSelected = data.tone_of_voice === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange('tone_of_voice', t.id)}
                className={cn(
                  'min-h-[44px] p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 relative',
                  isSelected
                    ? 'bg-violet-950/40 border-violet-500 shadow-lg shadow-violet-500/10 ring-1 ring-violet-500'
                    : 'bg-[#090D16] border-[#1E293B] hover:border-slate-700'
                )}
              >
                <div className="shrink-0 mt-0.5">{t.icon}</div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{t.label}</span>
                    {isSelected && (
                      <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,1)]" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{t.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Seção 3: Tags de SEO Padrão (Chips) */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Tags Padrão de SEO</h3>
            <p className="text-xs text-slate-400">Palavras-chave injetadas automaticamente nos produtos</p>
          </div>
        </div>

        <form onSubmit={handleAddTagSubmit} className="flex gap-2 max-w-md">
          <input
            type="text"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            placeholder="Digite uma tag (ex: frete-gratis)..."
            className="flex-1 min-h-[44px] h-11 px-4 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base focus:border-violet-500 focus:outline-none transition-all placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="min-h-[44px] h-11 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </form>

        {/* Chips de Tags */}
        <div className="flex flex-wrap gap-2 pt-2">
          {data.seo_tags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs font-mono text-violet-300"
            >
              #{tag}
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                className="hover:text-red-400 transition-colors p-0.5 cursor-pointer"
                aria-label={`Remover tag ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Seção 4: Regras de Precificação e Arredondamento */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Regras de Precificação & Margem</h3>
            <p className="text-xs text-slate-400">Markup de preço e arredondamento automático de centavos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          {/* Markup % */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Margem de Lucro / Markup (%)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="500"
                value={data.price_markup_percentage}
                onChange={(e) => onChange('price_markup_percentage', Number(e.target.value) || 0)}
                className="w-full min-h-[44px] h-11 px-4 pr-10 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base focus:border-violet-500 focus:outline-none transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">
                %
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Ex: 20% adiciona +20% sobre o valor raspado.</p>
          </div>

          {/* Arredondamento */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Regra de Arredondamento
            </label>
            <select
              value={data.rounding_rule}
              onChange={(e) => onChange('rounding_rule', e.target.value as RoundingRule)}
              className="w-full min-h-[44px] h-11 px-4 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base focus:border-violet-500 focus:outline-none transition-all cursor-pointer"
            >
              <option value="ENDING_99">Final .99 (ex: R$ 99,99)</option>
              <option value="ENDING_90">Final .90 (ex: R$ 99,90)</option>
              <option value="NEAREST_INTEGER">Inteiro mais próximo (ex: R$ 100,00)</option>
              <option value="NONE">Sem arredondamento</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
