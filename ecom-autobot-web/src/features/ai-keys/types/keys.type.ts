/**
 * Provedores de IA suportados pelo backend.
 */
export const AIProviderEnum = {
  DEEPSEEK: 'deepseek',
  GROQ: 'groq',
  OPENAI: 'openai',
  GEMINI: 'gemini',
  OPENROUTER: 'openrouter',
} as const;

export type AIProvider = (typeof AIProviderEnum)[keyof typeof AIProviderEnum];

/**
 * Labels dos provedores para exibição no frontend.
 */
export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  deepseek: 'DeepSeek',
  groq: 'Groq',
  openai: 'OpenAI',
  gemini: 'Gemini',
  openrouter: 'OpenRouter Gateway',
};

/**
 * Payload para salvar ou atualizar a credencial BYOK do Tenant.
 * Corresponde ao AICredentialsRequest do Pydantic.
 */
export interface AICredentialsRequest {
  provider: AIProvider;
  access_token: string;
  tenant_id?: string;
  preferred_models?: string[];
}

/**
 * Resposta de sucesso do salvamento criptografado da chave (AES-256).
 */
export interface AICredentialsResponse {
  status: string;
  message: string;
}

/**
 * DTO para teste de validade da chave de API do provedor em tempo real.
 */
export interface TestAIKeyRequest {
  provider: AIProvider;
  api_key: string;
  preferred_models?: string[];
}

/**
 * Resposta da rota de teste da chave de API de IA.
 */
export interface TestAIKeyResponse {
  status: 'success' | 'error';
  message: string;
}

/**
 * Return type do hook useAIKeys.
 */
export interface UseAIKeysReturn {
  provider: AIProvider | null;
  setProvider: (provider: AIProvider) => void;
  accessToken: string;
  setAccessToken: (token: string) => void;
  showToken: boolean;
  toggleShowToken: () => void;
  maskedToken: string;
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  saveCredentials: () => Promise<void>;
  reset: () => void;
}

/**
 * Props do componente AIKeysForm.
 */
export interface AIKeysFormProps {
  className?: string;
}