import { isAxiosError } from 'axios';

/**
 * Extrai uma mensagem legível de erro a partir de um valor de exceção capturado (unknown).
 */
export function getErrorMessage(err: unknown, fallback: string = 'Ocorreu um erro inesperado.'): string {
  if (!err) return fallback;

  if (isAxiosError(err)) {
    const data = err.response?.data;

    if (typeof data === 'string' && data.trim()) return data;

    if (data && typeof data === 'object') {
      const { detail, message } = data as { detail?: unknown; message?: unknown };
      if (typeof detail === 'string' && detail.trim()) return detail;
      if (typeof message === 'string' && message.trim()) return message;
    }

    return err.message || fallback;
  }

  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === 'string') {
    return err;
  }

  return fallback;
}
