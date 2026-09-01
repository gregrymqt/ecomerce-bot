import clarity from '@microsoft/clarity';
import { env } from '@/config/env';

const CLARITY_PROJECT_ID = env.clarityProjectId;

/**
 * Inicializa o Microsoft Clarity se a chave VITE_CLARITY_PROJECT_ID estiver presente.
 */
export const initClarity = () => {
  if (CLARITY_PROJECT_ID) {
    clarity.init(CLARITY_PROJECT_ID);
  }
};
