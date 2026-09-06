/**
 * src/features/settings/services/settings.service.ts
 *
 * Camada de serviços HTTP para gestão de configurações do Tenant (/api/v1/settings).
 * Conecta o frontend via apiClient com suporte a mapeamento bidirecional resiliente
 * entre os DTOs do backend C# e a tipagem do frontend.
 */

import { apiClient } from '@/lib/apiClient';
import { getErrorMessage } from '@/utils/errors';
import type {
  TenantSettingsResponse,
  TenantSettingsBackendResponse,
  TenantSettingsBackendUpdate,
  AiSettingsPayload,
  StoreProfilePayload,
  BillingProfilePayload,
  ToneOfVoice,
  DefaultLanguage,
} from '../types';

export const DEFAULT_AI_SETTINGS: AiSettingsPayload = {
  default_language: 'PT_BR',
  seo_tags: ['ecommerce', 'oferta', 'frete-gratis', 'qualidade-garantida'],
  tone_of_voice: 'PERSUASIVE',
  price_markup_percentage: 15,
  rounding_rule: 'ENDING_99',
};

export const DEFAULT_STORE_PROFILE: StoreProfilePayload = {
  store_name: 'Minha Loja E-Commerce',
  tenant_id: 'tenant-default',
  admin_email: 'admin@loja.com.br',
  timezone: 'America/Sao_Paulo',
  base_currency: 'BRL',
};

export const DEFAULT_BILLING_PROFILE: BillingProfilePayload = {
  company_name: 'E-Commerce Bot Tech Ltda',
  tax_id: '12.345.678/0001-99',
  billing_email: 'financeiro@loja.com.br',
  commercial_address: 'Av. Paulista, 1000 - São Paulo, SP',
};

/**
 * Converte a resposta do backend C# para o formato consumido pelas abas do frontend.
 */
export function mapBackendToFrontend(
  raw?: TenantSettingsBackendResponse | TenantSettingsResponse | null
): TenantSettingsResponse {
  if (!raw) {
    return {
      ai: { ...DEFAULT_AI_SETTINGS },
      profile: { ...DEFAULT_STORE_PROFILE },
      billing: { ...DEFAULT_BILLING_PROFILE },
    };
  }

  // Se já estiver no formato frontend
  if ('ai' in raw && raw.ai && 'profile' in raw && raw.profile) {
    return {
      ai: { ...DEFAULT_AI_SETTINGS, ...raw.ai },
      profile: { ...DEFAULT_STORE_PROFILE, ...raw.profile },
      billing: { ...DEFAULT_BILLING_PROFILE, ...(raw.billing || {}) },
    };
  }

  const backend = raw as TenantSettingsBackendResponse;
  const aiRaw = backend.ai_settings;
  const pricingRaw = backend.pricing_settings;
  const storeRaw = backend.store_profile;

  // Normalização do tom de voz
  let tone: ToneOfVoice = 'PERSUASIVE';
  if (aiRaw?.tone_of_voice) {
    const upper = aiRaw.tone_of_voice.toUpperCase();
    if (['PERSUASIVE', 'TECHNICAL', 'DIRECT', 'CASUAL'].includes(upper)) {
      tone = upper as ToneOfVoice;
    }
  }

  // Normalização do idioma padrão
  let lang: DefaultLanguage = 'PT_BR';
  if (aiRaw?.target_language) {
    const l = aiRaw.target_language.toLowerCase();
    if (l.includes('en')) lang = 'EN_US';
    else if (l.includes('es')) lang = 'ES';
  }

  return {
    ai: {
      default_language: lang,
      seo_tags: DEFAULT_AI_SETTINGS.seo_tags,
      tone_of_voice: tone,
      price_markup_percentage: pricingRaw?.margin_percentage ?? DEFAULT_AI_SETTINGS.price_markup_percentage,
      rounding_rule: (pricingRaw?.round_cents ?? true) ? 'ENDING_99' : 'NONE',
    },
    profile: {
      store_name: storeRaw?.store_name || DEFAULT_STORE_PROFILE.store_name,
      tenant_id: backend.tenant_id || DEFAULT_STORE_PROFILE.tenant_id,
      admin_email: storeRaw?.support_email || DEFAULT_STORE_PROFILE.admin_email,
      timezone: DEFAULT_STORE_PROFILE.timezone,
      base_currency: DEFAULT_STORE_PROFILE.base_currency,
    },
    billing: {
      ...DEFAULT_BILLING_PROFILE,
    },
  };
}

/**
 * Converte o estado do frontend para o DTO aceito pelo backend C#.
 */
export function mapFrontendToBackend(
  frontend: Partial<TenantSettingsResponse>
): TenantSettingsBackendUpdate {
  const update: TenantSettingsBackendUpdate = {};

  if (frontend.ai) {
    update.ai_settings = {
      tone_of_voice: frontend.ai.tone_of_voice.toLowerCase(),
      target_language: frontend.ai.default_language === 'PT_BR' ? 'pt-BR' : 'en-US',
      seo_tags_enabled: (frontend.ai.seo_tags || []).length > 0,
      custom_instructions: null,
    };

    update.pricing_settings = {
      margin_percentage: frontend.ai.price_markup_percentage,
      round_cents: frontend.ai.rounding_rule === 'ENDING_99',
    };
  }

  if (frontend.profile) {
    update.store_profile = {
      store_name: frontend.profile.store_name,
      support_email: frontend.profile.admin_email,
      niche: null,
    };
  }

  return update;
}

export const settingsService = {
  /**
   * Obtém as configurações consolidadas ativas do Tenant (IA, Perfil da Loja, Faturamento).
   * Endpoint: GET /api/v1/settings
   */
  getSettings: async (signal?: AbortSignal): Promise<TenantSettingsResponse> => {
    try {
      const response = await apiClient.get<TenantSettingsBackendResponse>('/api/v1/settings', { signal });
      return mapBackendToFrontend(response.data);
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Não foi possível carregar as configurações do tenant.'
      );
      throw new Error(message, { cause: error });
    }
  },

  /**
   * Atualiza as configurações do Tenant (parcial ou total).
   * Endpoint: PUT /api/v1/settings
   */
  updateSettings: async (
    payload: Partial<TenantSettingsResponse>
  ): Promise<TenantSettingsResponse> => {
    try {
      const backendPayload = mapFrontendToBackend(payload);
      const response = await apiClient.put<TenantSettingsBackendResponse>('/api/v1/settings', backendPayload);
      return mapBackendToFrontend(response.data);
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        'Erro ao salvar as alterações de configurações.'
      );
      throw new Error(message, { cause: error });
    }
  },
};

export default settingsService;
