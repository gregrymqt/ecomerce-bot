export type AiProviderId = 'deepseek' | 'groq' | 'openai' | 'gemini';

export interface AiProviderMeta {
  id: AiProviderId;
  name: string;
  badgeText: string;
  placeholder: string;
  logoUrl: string;
  docUrl: string;
}

export interface UserAiKey {
  providerId: AiProviderId;
  apiKey: string;
  isValidated: boolean;
  pingTime?: string;
  isCustomActive: boolean;
}
