/**
 * src/hooks/useUtmTracker.ts
 *
 * Custom Hook para rastreamento de tráfego pago na Landing Page e páginas de autenticação do SaaS.
 * Captura UTMs e ad_id da URL, persiste em localStorage/Cookie por 30 dias e
 * envia o evento de visita para a API administrativa.
 */

import { useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';

const UTM_STORAGE_KEY = '_saas_utm_attribution';

export interface StoredUtmAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  ad_id?: string;
  fbclid?: string;
  gclid?: string;
  captured_at: string;
}

export function getStoredUtmAttribution(): StoredUtmAttribution | null {
  try {
    const raw = localStorage.getItem(UTM_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignora erros de parse
  }
  return null;
}

export function useUtmTracker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source');
    const utmMedium = urlParams.get('utm_medium');
    const utmCampaign = urlParams.get('utm_campaign');
    const utmContent = urlParams.get('utm_content');
    const utmTerm = urlParams.get('utm_term');
    const adId = urlParams.get('ad_id');
    const fbclid = urlParams.get('fbclid');
    const gclid = urlParams.get('gclid');

    const hasTrackingParams = !!(utmSource || utmCampaign || adId || fbclid || gclid);

    // Se houver parâmetros de tracking na URL atual, atualiza o storage
    if (hasTrackingParams) {
      const dataToStore: StoredUtmAttribution = {
        utm_source: utmSource || undefined,
        utm_medium: utmMedium || undefined,
        utm_campaign: utmCampaign || undefined,
        utm_content: utmContent || undefined,
        utm_term: utmTerm || undefined,
        ad_id: adId || undefined,
        fbclid: fbclid || undefined,
        gclid: gclid || undefined,
        captured_at: new Date().toISOString(),
      };

      try {
        localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(dataToStore));
      } catch {
        // Fallback silencioso
      }

      // Obtém ou cria SessionId
      let sessionId = sessionStorage.getItem('_saas_session_id');
      if (!sessionId) {
        sessionId = `sess_saas_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem('_saas_session_id', sessionId);
      }

      // Envia evento de visita para a API
      apiClient
        .post('/admin/traffic/visit', {
          session_id: sessionId,
          path: window.location.pathname,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_content: utmContent,
          utm_term: utmTerm,
          ad_id: adId,
          fbclid,
          gclid,
          referrer: document.referrer || undefined,
        })
        .catch(() => {
          // Erros de telemetria são ignorados no cliente
        });
    }
  }, []);

  return {
    getStoredUtms: getStoredUtmAttribution,
  };
}

export default useUtmTracker;
