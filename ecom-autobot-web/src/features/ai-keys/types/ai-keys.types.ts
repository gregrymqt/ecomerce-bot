export type AiProviderId = 'deepseek' | 'groq' | 'openai' | 'gemini' | 'openrouter';

export interface AiProviderMeta {
  id: AiProviderId;
  name: string;
  badgeText: string;
  placeholder: string;
  logoUrl: string;
  docUrl: string;
  defaultModels?: string[];
}

export interface UserAiKey {
  providerId: AiProviderId;
  apiKey: string;
  isValidated: boolean;
  pingTime?: string;
  isCustomActive: boolean;
  preferred_models?: string[];
}
