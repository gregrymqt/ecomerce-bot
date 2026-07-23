import { getLocalStorage, setLocalStorage, deleteLocalStorage } from '@/utils/storage';

export const saveTenantId = (tenantId: string) => {
  setLocalStorage('@ecom:tenant_id', tenantId);
};

export const getTenantId = () => getLocalStorage<string>('@ecom:tenant_id');

export const clearTenantId = () => {
  deleteLocalStorage('@ecom:tenant_id');
};