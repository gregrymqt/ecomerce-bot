// src/utils/storage.ts

/**
 * Armazena um valor no localStorage de forma segura e tipada.
 */
export const setLocalStorage = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Erro ao armazenar "${key}" no localStorage:`, e);
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
    console.error(`Erro ao buscar "${key}" no localStorage:`, e);
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
    console.error(`Erro ao deletar "${key}" do localStorage:`, e);
  }
};