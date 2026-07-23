/**
 * Definições de Tipos e Interfaces da Feature Live Demo
 */

export type DemoStep =
  | 'QUEUED'
  | 'SCRAPING'
  | 'PARSING'
  | 'LLM_ENRICHMENT'
  | 'SAVING'
  | 'FINISHED'
  | 'COMPLETED'
  | 'ERROR'
  | (string & {});

export interface DemoProgressPayload<TData = Record<string, unknown>> {
  /** Etapa atual do processamento */
  step: DemoStep;
  /** Mensagem descritiva ou log da etapa */
  message: string;
  /** Porcentagem de progresso de 0 a 100 */
  progress: number;
  /** Dados adicionais retornados pelo worker (ex: metadados do produto) */
  data?: TData;
}

export interface DemoRequestPayload {
  /** Lista de 1 a 3 URLs para processamento na demo */
  urls: string[];
}

export interface DemoResponsePayload {
  /** Status do enfileiramento na API */
  status: string;
}

export interface UseDemoStreamReturn {
  /** Histórico de todos os logs/mensagens recebidos via SSE */
  logs: DemoProgressPayload[];
  /** Porcentagem de progresso de 0 a 100 */
  progress: number;
  /** Indica se a transmissão está ativa e aguardando/processando */
  isStreaming: boolean;
  /** Mensagem de erro caso o POST ou o SSE falhem */
  error: string | null;
  /** Dispara o processo enviando as URLs para o backend */
  startDemo: (urls: string[]) => Promise<void>;
  /** Cancela manualmente a transmissão atual */
  stopDemo: () => void;
  /** Limpa o histórico de logs e reseta o estado */
  resetDemo: () => void;
}

export interface DemoUrlFormProps {
  /** Callback disparado com a lista de URLs validadas ao enviar o formulário */
  onSubmit: (urls: string[]) => void;
  /** Indica se a solicitação está sendo enviada ao servidor */
  isLoading?: boolean;
  /** Estilos CSS adicionais */
  className?: string;
}

export interface DemoStreamViewerProps {
  /** Histórico dos eventos/logs do SSE */
  logs: DemoProgressPayload[];
  /** Progresso em porcentagem (0-100) */
  progress: number;
  /** Estado da conexão SSE em tempo real */
  isStreaming: boolean;
  /** Erro retornado durante a transmissão, se houver */
  error: string | null;
  /** Interrompe a execução atual */
  onStop: () => void;
  /** Reseta o estado para iniciar nova demonstração */
  onReset: () => void;
  /** Estilos CSS adicionais */
  className?: string;
}

export interface LiveDemoContainerProps {
  /** Estilos CSS adicionais */
  className?: string;
}
