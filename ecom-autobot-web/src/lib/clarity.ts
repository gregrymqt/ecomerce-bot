import clarity from '@microsoft/clarity';

const CLARITY_PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID;

/**
 * Inicializa o Microsoft Clarity se a chave VITE_CLARITY_PROJECT_ID estiver presente.
 */
export const initClarity = () => {
  if (CLARITY_PROJECT_ID) {
    clarity.init(CLARITY_PROJECT_ID);
  }
};
