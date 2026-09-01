// src/utils/storage.ts

const TENANT_KEY = 'app_active_tenant_id';

/**
 * Armazena um valor no localStorage de forma segura e tipada.
 */
export const setLocalStorage = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Erro ao armazenar item no localStorage:', key, e);
  }
};

/**
 * Busca um valor tipado do localStorage de forma segura.
 */
export const getLocalStorage = <T>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch (e) {
    console.error('Erro ao buscar item no localStorage:', key, e);
    return null;
  }
};

/**
 * Remove uma chave do localStorage de forma segura.
 */
export const deleteLocalStorage = (key: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Erro ao deletar item do localStorage:', key, e);
  }
};

/**
 * Busca e sanitiza o Tenant ID ativo para envio seguro em cabeçalhos HTTP.
 */
export const getTenantId = (): string | null => {
  const tenant = getLocalStorage<string>(TENANT_KEY);
  if (!tenant || typeof tenant !== 'string') return null;
  // Remove caracteres potencialmente perigosos para segurança de cabeçalho (Header Injection)
  return tenant.trim().replace(/[^\w-]/g, '');
};

/**
 * Salva o Tenant ID ativo.
 */
export const saveTenantId = (tenantId: string): void => {
  if (!tenantId) return;
  setLocalStorage(TENANT_KEY, tenantId.trim());
};

/**
 * Limpa o Tenant ID ativo do armazenamento local.
 */
export const clearTenantId = (): void => {
  deleteLocalStorage(TENANT_KEY);
};

const AUTH_TOKEN_KEY = 'app_auth_token';

/**
 * Busca o JWT de autenticação armazenado.
 */
export const getAuthToken = (): string | null => {
  const token = getLocalStorage<string>(AUTH_TOKEN_KEY);
  if (!token || typeof token !== 'string') return null;
  return token.trim();
};

/**
 * Salva o JWT de autenticação no armazenamento local.
 */
export const saveAuthToken = (token: string): void => {
  if (!token) return;
  setLocalStorage(AUTH_TOKEN_KEY, token.trim());
};

/**
 * Limpa o JWT de autenticação do armazenamento local.
 */
export const clearAuthToken = (): void => {
  deleteLocalStorage(AUTH_TOKEN_KEY);
};