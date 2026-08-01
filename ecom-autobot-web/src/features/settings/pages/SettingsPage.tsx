/**
 * src/features/settings/pages/SettingsPage.tsx
 *
 * Página Principal de Configurações & Preferências do Tenant.
 * Tema Synthetica Dark (#090D16), navegação por abas com min-h-[44px] e salvamento assíncrono.
 */

import React from 'react';
import {
  Settings,
  Sparkles,
  Store,
  Receipt,
  Save,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useSettings } from '../hooks/useSettings';
import { AiRulesTab } from '../components/AiRulesTab';
import { StoreProfileTab } from '../components/StoreProfileTab';
import { BillingProfileTab } from '../components/BillingProfileTab';
import { SettingsSuccessToast } from '../components/SettingsSuccessToast';
import type { SettingsTab } from '../types/settings.type';

export const SettingsPage: React.FC = () => {
  const {
    activeTab,
    formData,
    loading,
    saving,
    showToast,
    error,
    setError,
    setShowToast,
    fetchSettings,
    handleTabChange,
    handleAiSettingChange,
    handleAddSeoTag,
    handleRemoveSeoTag,
    handleProfileSettingChange,
    handleBillingSettingChange,
    handleSaveSettings,
  } = useSettings('AI_RULES');

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'AI_RULES',
      label: 'Regras da IA & Copywriting',
      icon: <Sparkles className="h-4 w-4 text-violet-400" />,
    },
    {
      id: 'STORE_PROFILE',
      label: 'Perfil da Loja & Tenant',
      icon: <Store className="h-4 w-4 text-blue-400" />,
    },
    {
      id: 'BILLING_DATA',
      label: 'Dados Fiscais & Cobrança',
      icon: <Receipt className="h-4 w-4 text-emerald-400" />,
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 px-4 sm:px-6 text-slate-100 animate-in fade-in duration-300">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-400 mb-1">
            <Settings className="h-4 w-4" />
            <span>Configurações Globais</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Configurações & Preferências
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Personalize as regras da inteligência artificial, perfil da organização e dados de faturamento.
          </p>
        </div>

        {/* Barra de Ações (min-h-[44px]) */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchSettings}
            disabled={loading || saving}
            className="min-h-[44px] h-11 px-4 rounded-xl bg-[#15121B] hover:bg-[#1E293B] border border-[#1E293B] text-slate-300 text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            Cancelar / Resetar
          </button>

          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
            className="min-h-[44px] h-11 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-violet-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Salvar Configurações</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alerta de Erro */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-bold underline hover:text-white cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Navegação por Abas (min-h-[44px]) */}
      <div className="flex border-b border-[#1E293B] overflow-x-auto gap-2 scrollbar-none">
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={cn(
                'min-h-[44px] h-11 px-5 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer',
                isActive
                  ? 'border-violet-500 text-violet-400 bg-violet-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              )}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Conteúdo Dinâmico da Aba Ativa */}
      {loading ? (
        <div className="h-64 rounded-2xl bg-[#15121B] border border-[#1E293B] flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
          <span className="text-sm font-medium">Carregando configurações do tenant...</span>
        </div>
      ) : (
        <section>
          {activeTab === 'AI_RULES' && (
            <AiRulesTab
              data={formData.ai}
              onChange={handleAiSettingChange}
              onAddTag={handleAddSeoTag}
              onRemoveTag={handleRemoveSeoTag}
            />
          )}

          {activeTab === 'STORE_PROFILE' && (
            <StoreProfileTab
              data={formData.profile}
              onChange={handleProfileSettingChange}
            />
          )}

          {activeTab === 'BILLING_DATA' && (
            <BillingProfileTab
              data={formData.billing}
              onChange={handleBillingSettingChange}
            />
          )}
        </section>
      )}

      {/* Banner de Segurança no Rodapé */}
      <div className="rounded-2xl bg-[#15121B] border border-[#1E293B] p-4 flex items-center gap-3 text-xs text-slate-400">
        <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
        <span>
          Suas configurações afetam diretamente o comportamento de extração, enriquecimento e sincronia do robô com suas lojas parceiras.
        </span>
      </div>

      {/* Toast Flutuante de Sucesso */}
      <SettingsSuccessToast show={showToast} onClose={() => setShowToast(false)} />
    </div>
  );
};

export default SettingsPage;
