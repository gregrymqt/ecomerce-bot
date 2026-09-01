import ReactGA from 'react-ga4';
import { env } from '@/config/env';

const GA_MEASUREMENT_ID = env.gaMeasurementId;

/**
 * Inicializa o Google Analytics 4 se a chave VITE_GA_MEASUREMENT_ID estiver presente.
 */
export const initGA = () => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID);
  }
};

/**
 * Registra a visualização de uma página específica.
 */
export const logPageView = (path: string) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.send({ hitType: 'pageview', page: path });
  }
};

/**
 * Registra eventos customizados do usuário (ex: cliques, downloads, conversões).
 */
export const logEvent = (category: string, action: string, label?: string) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.event({ category, action, label });
  }
};
