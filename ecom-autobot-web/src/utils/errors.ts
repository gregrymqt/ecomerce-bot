/**
 * Extrai uma mensagem legível de erro a partir de um valor de exceção capturado (unknown).
 */
export function getErrorMessage(err: unknown, fallback: string = 'Ocorreu um erro inesperado.'): string {
  if (!err) return fallback;

  if (typeof err === 'string') {
    return err;
  }

  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>;
    
    // Tratamento específico para erros da Axios/ApiClient
    if (errorObj.response && typeof errorObj.response === 'object' && errorObj.response !== null) {
      const response = errorObj.response as Record<string, unknown>;
      if (response.data && typeof response.data === 'object' && response.data !== null) {
        const data = response.data as Record<string, unknown>;
        if (typeof data.detail === 'string') {
          return data.detail;
        }
        if (typeof data.message === 'string') {
          return data.message;
        }
      }
    }

    if (typeof errorObj.message === 'string') {
      return errorObj.message;
    }
  }

  return fallback;
}
