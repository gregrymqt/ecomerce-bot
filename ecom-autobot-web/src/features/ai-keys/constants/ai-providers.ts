import type { AiProviderMeta } from '@/features/ai-keys';

export const AI_PROVIDERS_META: AiProviderMeta[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek V3',
    badgeText: 'Recomendado',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
    logoUrl: '/logos/deepseek.svg',
    docUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    badgeText: 'Ultra Rápido',
    placeholder: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxx',
    logoUrl: '/logos/groq.svg',
    docUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT-4o)',
    badgeText: 'Padrão Industry',
    placeholder: 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx',
    logoUrl: '/logos/openai.svg',
    docUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    badgeText: 'Multimodal',
    placeholder: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx',
    logoUrl: '/logos/gemini.svg',
    docUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter Gateway',
    badgeText: 'Multi-Modelo / BYOK',
    placeholder: 'sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx',
    logoUrl: '/logos/openrouter.svg',
    docUrl: 'https://openrouter.ai/keys',
    defaultModels: [
      'groq/llama-3.3-70b',
      'deepseek/deepseek-chat',
      'anthropic/claude-3.5-sonnet',
    ],
  },
];
