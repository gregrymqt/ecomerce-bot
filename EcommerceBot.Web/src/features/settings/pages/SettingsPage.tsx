/**
 * src/features/settings/pages/SettingsPage.tsx
 *
 * Página Principal de Configurações & Preferências do Tenant.
 * Tema Synthetica Dark (#090D16), navegação por abas com min-h-[44px] e salvamento assíncrono.
 * Em conformidade estrita com acessibilidade WCAG 2.1 AA e arquitetura em 4 camadas.
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '../hooks/useSettings';
import {
  AiRulesTab,
  StoreProfileTab,
  BillingProfileTab,
  TenantSsoTab,
  SettingsSuccessToast,
} from '../components';
import type { SettingsTab } from '../types';
import { Button, Alert } from '@/components/ui';

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
      icon: <Sparkles className="h-4 w-4 text-indigo-400" />,
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
    {
      id: 'SSO_MAPPINGS',
      label: 'SSO & Grupos IdP',
      icon: <ShieldCheck className="h-4 w-4 text-violet-400" />,
    },
  ];

  return (
    <div
      role="main"
      aria-label="Configurações e Preferências do Tenant"
      className="space-y-8 max-w-7xl mx-auto pb-16 px-4 sm:px-6 text-slate-100 animate-fade-in"
    >
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1">
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
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={fetchSettings}
            disabled={loading || saving}
            className="min-h-[44px] border-slate-800 text-slate-300 hover:bg-slate-800/80"
          >
            Cancelar / Resetar
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSaveSettings}
            disabled={saving}
            isLoading={saving}
            iconLeft={!saving ? <Save className="h-4 w-4" /> : undefined}
            className="min-h-[44px] font-bold"
          >
            Salvar Configurações
          </Button>
        </div>
      </div>

      {/* Alerta de Erro */}
      {error && (
        <div className="animate-fade-in">
          <Alert
            variant="error"
            title="Erro ao salvar configurações"
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        </div>
      )}

      {/* Navegação por Abas (min-h-[44px] com suporte a A11y role=tablist) */}
      <div
        role="tablist"
        aria-label="Abas de configuração"
        className="flex border-b border-slate-800 overflow-x-auto gap-2 scrollbar-none"
      >
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${t.id}`}
              onClick={() => handleTabChange(t.id)}
              className={cn(
                'min-h-[44px] h-11 px-5 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none',
                isActive
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
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
            <div
              role="tabpanel"
              id="panel-AI_RULES"
              aria-labelledby="tab-AI_RULES"
              className="animate-fade-in"
            >
              <AiRulesTab
                data={formData.ai}
                onChange={handleAiSettingChange}
                onAddTag={handleAddSeoTag}
                onRemoveTag={handleRemoveSeoTag}
              />
            </div>
          )}

          {activeTab === 'STORE_PROFILE' && (
            <div
              role="tabpanel"
              id="panel-STORE_PROFILE"
              aria-labelledby="tab-STORE_PROFILE"
              className="animate-fade-in"
            >
              <StoreProfileTab
                data={formData.profile}
                onChange={handleProfileSettingChange}
              />
            </div>
          )}

          {activeTab === 'BILLING_DATA' && (
            <div
              role="tabpanel"
              id="panel-BILLING_DATA"
              aria-labelledby="tab-BILLING_DATA"
              className="animate-fade-in"
            >
              <BillingProfileTab
                data={formData.billing}
                onChange={handleBillingSettingChange}
              />
            </div>
          )}

          {activeTab === 'SSO_MAPPINGS' && (
            <div
              role="tabpanel"
              id="panel-SSO_MAPPINGS"
              aria-labelledby="tab-SSO_MAPPINGS"
              className="animate-fade-in"
            >
              <TenantSsoTab />
            </div>
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
