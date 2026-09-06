/**
 * src/features/settings/__tests__/settings.service.test.ts
 *
 * Testes unitários para o mapper e serviço de configurações do tenant.
 */

import { describe, it, expect } from 'vitest';
import {
  mapBackendToFrontend,
  mapFrontendToBackend,
  DEFAULT_AI_SETTINGS,
  DEFAULT_STORE_PROFILE,
  DEFAULT_BILLING_PROFILE,
} from '../services/settings.service';
import type { TenantSettingsBackendResponse, TenantSettingsResponse } from '../types';

describe('settings.service mappers', () => {
  it('deve mapear resposta bruta do backend C# para o formato esperado pelo frontend', () => {
    const backendResponse: TenantSettingsBackendResponse = {
      tenant_id: 'tenant-abc-123',
      ai_settings: {
        tone_of_voice: 'persuasive',
        target_language: 'pt-BR',
        seo_tags_enabled: true,
        custom_instructions: 'Usar emojis',
      },
      pricing_settings: {
        margin_percentage: 25,
        round_cents: true,
      },
      store_profile: {
        store_name: 'Moda Fashion Online',
        niche: 'Vestuário',
        support_email: 'contato@modafashion.com',
      },
      updated_at: '2026-09-05T20:00:00Z',
    };

    const mapped = mapBackendToFrontend(backendResponse);

    // AI
    expect(mapped.ai.tone_of_voice).toBe('PERSUASIVE');
    expect(mapped.ai.default_language).toBe('PT_BR');
    expect(mapped.ai.price_markup_percentage).toBe(25);
    expect(mapped.ai.rounding_rule).toBe('ENDING_99');

    // Profile
    expect(mapped.profile.store_name).toBe('Moda Fashion Online');
    expect(mapped.profile.tenant_id).toBe('tenant-abc-123');
    expect(mapped.profile.admin_email).toBe('contato@modafashion.com');

    // Billing (fallback)
    expect(mapped.billing.company_name).toBe(DEFAULT_BILLING_PROFILE.company_name);
  });

  it('deve aplicar fallbacks seguros quando o backend responder com campos vazios ou nulos', () => {
    const emptyBackendResponse: TenantSettingsBackendResponse = {
      tenant_id: undefined,
      ai_settings: undefined,
      pricing_settings: undefined,
      store_profile: undefined,
      updated_at: null,
    };

    const mapped = mapBackendToFrontend(emptyBackendResponse);

    expect(mapped.ai.tone_of_voice).toBe(DEFAULT_AI_SETTINGS.tone_of_voice);
    expect(mapped.profile.store_name).toBe(DEFAULT_STORE_PROFILE.store_name);
    expect(mapped.billing.company_name).toBe(DEFAULT_BILLING_PROFILE.company_name);
  });

  it('deve converter o formato do frontend para o DTO aceito pelo backend C# no salvamento', () => {
    const frontendData: TenantSettingsResponse = {
      ai: {
        default_language: 'PT_BR',
        seo_tags: ['promo', 'brasil'],
        tone_of_voice: 'CASUAL',
        price_markup_percentage: 30,
        rounding_rule: 'NONE',
      },
      profile: {
        store_name: 'Loja Nova',
        tenant_id: 'tenant-123',
        admin_email: 'sac@lojanova.com',
        timezone: 'America/Sao_Paulo',
        base_currency: 'BRL',
      },
      billing: {
        company_name: 'Empresa Teste',
        tax_id: '00.000.000/0001-00',
        billing_email: 'fin@teste.com',
        commercial_address: 'Rua das Flores, 10',
      },
    };

    const backendPayload = mapFrontendToBackend(frontendData);

    expect(backendPayload.ai_settings?.tone_of_voice).toBe('casual');
    expect(backendPayload.ai_settings?.target_language).toBe('pt-BR');
    expect(backendPayload.ai_settings?.seo_tags_enabled).toBe(true);
    expect(backendPayload.pricing_settings?.margin_percentage).toBe(30);
    expect(backendPayload.pricing_settings?.round_cents).toBe(false);
    expect(backendPayload.store_profile?.store_name).toBe('Loja Nova');
    expect(backendPayload.store_profile?.support_email).toBe('sac@lojanova.com');
  });
});
