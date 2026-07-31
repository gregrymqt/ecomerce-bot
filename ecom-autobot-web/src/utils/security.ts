// src/utils/security.ts

/**
 * Valida se uma string é uma URL HTTP/HTTPS válida e segura.
 */
export const isValidHttpUrl = (urlString: string): boolean => {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Sanitiza links de imagens externas para evitar injeção de esquemas (ex: javascript:).
 * Retorna null se a URL for maliciosa ou inválida.
 */
export const sanitizeImageUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  
  // Permite apenas http, https e data:image/
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }
  
  return null;
};