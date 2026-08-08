import { isAxiosError } from 'axios';

/**
 * Extrai uma mensagem legível de erro a partir de um valor de exceção capturado (unknown).
 */
export function getErrorMessage(err: unknown, fallback: string = 'Ocorreu um erro inesperado.'): string {
  if (!err) return fallback;

  if (isAxiosError(err)) {
    return err.response?.data?.detail || err.response?.data?.message || err.message || fallback;
  }

  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === 'string') {
    return err;
  }

  return fallback;
}
