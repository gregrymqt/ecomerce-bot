import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';

interface TenantProfileState {
  tenantId: string;
  name: string;
}

/**
 * Fetches and caches the active tenant display name from `/api/v1/tenant/me`,
 * preventing raw tenant UUID exposure in authenticated layout headers.
 */
export function useTenantProfile(currentTenant: string | null | undefined, fallbackLabel = 'Loja Ativa') {
  const [tenantProfile, setTenantProfile] = useState<TenantProfileState | null>(null);

  useEffect(() => {
    if (!currentTenant) {
      return;
    }

    let isMounted = true;
    apiClient
      .get<{ name?: string }>('/api/v1/tenant/me')
      .then((res) => {
        if (isMounted && res.data?.name) {
          setTenantProfile({ tenantId: currentTenant, name: res.data.name });
        }
      })
      .catch(() => {
        // Keeps the friendly fallback label when tenant metadata is temporarily unavailable.
      });

    return () => {
      isMounted = false;
    };
  }, [currentTenant]);

  const tenantName = tenantProfile && tenantProfile.tenantId === currentTenant ? tenantProfile.name : null;
  return {
    tenantName,
    storeLabel: tenantName || fallbackLabel,
  };
}
