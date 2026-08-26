// src/lib/apiClient.ts
import { getTenantId, clearTenantId } from '@/utils/storage';
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 10000, // 10s
  withCredentials: true,
});

// Interceptor de Requisição: Injeção do Tenant ID e Bypass da tela de aviso do ngrok
apiClient.interceptors.request.use((config) => {
  const tenantId = getTenantId();

  if (tenantId) {
    config.headers['X-Tenant-ID'] = tenantId;
  }
  config.headers['ngrok-skip-browser-warning'] = 'true';

  return config;
});


// Interceptor de Resposta: Proteção contra Token Expirado / Sessão Inválida / 401 & 403
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;

      // Se a sessão expirou ou o tenant não tem acesso autorizado
      if (status === 401 || status === 403) {
        clearTenantId();
        // Notifica a aplicação para resetar o AuthContext e redirecionar para login
        window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { status } }));
      }
    }

    return Promise.reject(error);
  }
);