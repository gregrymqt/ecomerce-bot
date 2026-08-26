/**
 * src/features/settings/hooks/useSettings.ts
 *
 * Custom Hook reativo para gestão do estado do formulário de Configurações do Tenant.
 * Gerencia navegação entre abas, alteração de campos por seção, chips de SEO e envio HTTP.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { settingsService } from '@/features/settings';
import type {
  SettingsTab,
  TenantSettingsResponse,
  AiSettingsPayload,
  StoreProfilePayload,
  BillingProfilePayload,
} from '@/features/settings';
import { getErrorMessage } from '@/utils/errors';

const DEFAULT_SETTINGS: TenantSettingsResponse = {
  ai: {
    default_language: 'PT_BR',
    seo_tags: ['ecommerce', 'oferta', 'frete-gratis', 'qualidade-garantida'],
    tone_of_voice: 'PERSUASIVE',
    price_markup_percentage: 15,
    rounding_rule: 'ENDING_99',
  },
  profile: {
    store_name: 'Minha Loja E-Commerce',
    tenant_id: 'tenant-default',
    admin_email: 'admin@loja.com.br',
    timezone: 'America/Sao_Paulo',
    base_currency: 'BRL',
  },
  billing: {
    company_name: 'E-Commerce Bot Tech Ltda',
    tax_id: '12.345.678/0001-99',
    billing_email: 'financeiro@loja.com.br',
    commercial_address: 'Av. Paulista, 1000 - São Paulo, SP',
  },
};

export function useSettings(initialTab: SettingsTab = 'AI_RULES') {
  // 1. Estados Reativos
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [formData, setFormData] = useState<TenantSettingsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 2. Busca inicial das configurações
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await settingsService.getSettings();
      setFormData(data || DEFAULT_SETTINGS);
    } catch {
      // Fallback para exibir a UI com valores default se o endpoint não estiver rodando localmente
      setFormData(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 3. Troca de Abas
  const handleTabChange = useCallback((tab: SettingsTab) => {
    setActiveTab(tab);
  }, []);

  // 4. Alteração de Configurações de IA
  const handleAiSettingChange = useCallback(
    <K extends keyof AiSettingsPayload>(field: K, value: AiSettingsPayload[K]) => {
      setFormData((prev) => {
        const current = prev || DEFAULT_SETTINGS;
        return {
          ...current,
          ai: {
            ...current.ai,
            [field]: value,
          },
        };
      });
    },
    []
  );

  // 5. Adicionar / Remover Tags de SEO
  const handleAddSeoTag = useCallback((tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;

    setFormData((prev) => {
      const current = prev || DEFAULT_SETTINGS;
      if (current.ai.seo_tags.includes(trimmed)) return current;
      return {
        ...current,
        ai: {
          ...current.ai,
          seo_tags: [...current.ai.seo_tags, trimmed],
        },
      };
    });
  }, []);

  const handleRemoveSeoTag = useCallback((tagToRemove: string) => {
    setFormData((prev) => {
      const current = prev || DEFAULT_SETTINGS;
      return {
        ...current,
        ai: {
          ...current.ai,
          seo_tags: current.ai.seo_tags.filter((t) => t !== tagToRemove),
        },
      };
    });
  }, []);

  // 6. Alteração de Configurações do Perfil da Loja
  const handleProfileSettingChange = useCallback(
    <K extends keyof StoreProfilePayload>(field: K, value: StoreProfilePayload[K]) => {
      setFormData((prev) => {
        const current = prev || DEFAULT_SETTINGS;
        return {
          ...current,
          profile: {
            ...current.profile,
            [field]: value,
          },
        };
      });
    },
    []
  );

  // 7. Alteração de Configurações de Faturamento
  const handleBillingSettingChange = useCallback(
    <K extends keyof BillingProfilePayload>(field: K, value: BillingProfilePayload[K]) => {
      setFormData((prev) => {
        const current = prev || DEFAULT_SETTINGS;
        return {
          ...current,
          billing: {
            ...current.billing,
            [field]: value,
          },
        };
      });
    },
    []
  );

  // 8. Salvar Alterações no Backend
  const handleSaveSettings = useCallback(async () => {
    if (!formData) return;

    setSaving(true);
    setError(null);
    setShowToast(false);

    try {
      const updated = await settingsService.updateSettings(formData);
      setFormData(updated || formData);
      setShowToast(true);

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setShowToast(false);
      }, 5000);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Erro ao salvar configurações do tenant.');
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [formData]);

  // Limpeza de timers ao desmontar
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return {
    // Estados
    activeTab,
    formData: formData || DEFAULT_SETTINGS,
    loading,
    saving,
    showToast,
    error,
    setError,
    setShowToast,

    // Handlers
    fetchSettings,
    handleTabChange,
    handleAiSettingChange,
    handleAddSeoTag,
    handleRemoveSeoTag,
    handleProfileSettingChange,
    handleBillingSettingChange,
    handleSaveSettings,
  };
}
