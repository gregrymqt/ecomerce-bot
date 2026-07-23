// Exemplo de uso no seu serviço de Auth / Tenant
import { getLocalStorage, setLocalStorage, deleteLocalStorage } from '@/utils/storage';

export const saveAuthSession = (token: string, tenantId: string) => {
  setLocalStorage('@ecom:token', token);
  setLocalStorage('@ecom:tenant_id', tenantId);
};

export const getAuthToken = () => getLocalStorage<string>('@ecom:token');
export const getTenantId = () => getLocalStorage<string>('@ecom:tenant_id');

export const clearAuthSession = () => {
  deleteLocalStorage('@ecom:token');
  deleteLocalStorage('@ecom:tenant_id');
};