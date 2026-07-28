import type { DemoLogEvent, ScrapedProductResult } from '../types/live-demo.types';

export interface SampleUrlItem {
  label: string;
  url: string;
  platform: 'Shopify' | 'Nuvemshop' | 'Mercado Livre';
}

export const SAMPLE_URLS: SampleUrlItem[] = [
  {
    label: 'Loja Exemplo (Shopify)',
    url: 'https://exemplo-loja.myshopify.com/products/fone-bluetooth-noise-cancelling',
    platform: 'Shopify',
  },
  {
    label: 'Moda & Estilo (Nuvemshop)',
    url: 'https://lojamoda.nuvemshop.com.br/produtos/jaqueta-couro-premium',
    platform: 'Nuvemshop',
  },
  {
    label: 'Eletrônicos ML (Mercado Livre)',
    url: 'https://produto.mercadolivre.com.br/MLB-38910247-smartwatch-ultra-series-9',
    platform: 'Mercado Livre',
  },
];

export const MOCK_SSE_LOGS: DemoLogEvent[] = [
  {
    id: 'log-1',
    timestamp: '14:32:01.002',
    level: 'LISTEN',
    message: 'Iniciando escuta SSE em /api/v1/demo/stream...',
  },
  {
    id: 'log-2',
    timestamp: '14:32:01.215',
    level: 'INFO',
    message: 'Conexão estabelecida com sucesso com o servidor Pub/Sub.',
  },
  {
    id: 'log-3',
    timestamp: '14:32:01.430',
    level: 'SCRAPER',
    message: 'ScraperWorker: Baixando HTML/JSON-LD do produto (Shopify Store API)...',
  },
  {
    id: 'log-4',
    timestamp: '14:32:01.812',
    level: 'SCRAPER',
    message: 'Parser JSON-LD: 1 metadado estruturado extraído (Schema.org/Product).',
  },
  {
    id: 'log-5',
    timestamp: '14:32:02.050',
    level: 'AI_PROCESS',
    message: 'ProcessorWorker: Enviando payload bruto para DeepSeek V3 (LLM Enrichment)...',
  },
  {
    id: 'log-6',
    timestamp: '14:32:02.480',
    level: 'AI_PROCESS',
    message: 'LLM Response: Título magnético e Copywriting de alta conversão gerados.',
  },
  {
    id: 'log-7',
    timestamp: '14:32:02.710',
    level: 'AI_PROCESS',
    message: 'Cálculo de SEO: Score 98/100 gerado com 5 palavras-chave estratégicas.',
  },
  {
    id: 'log-8',
    timestamp: '14:32:02.825',
    level: 'SUCCESS',
    message: 'Extração & Enriquecimento concluídos com sucesso em 1.8s!',
  },
];

export const MOCK_PRODUCT_RESULT: ScrapedProductResult = {
  titleOriginal: 'Fone Bluetooth Sem Fio Noise Cancelling Pro Ultra Sound Black Edition',
  titleMagnetic: 'Fone Sem Fio Extreme Pro Noise Cancelling — Imersão Sonora Total & Bateria de 40h',
  tone: 'Persuasivo & Premium',
  category: 'Áudio & Eletrônicos',
  seoScore: 98,
  bulletPoints: [
    'Cancelamento Ativo de Ruído (ANC) de 35dB para imersão absoluta',
    'Bateria de longa duração: até 40 horas de reprodução contínua',
    'Conexão Ultra Fast Bluetooth 5.3 sem latência para jogos e chamadas',
    'Driver de 40mm com graves profundos e agudos cristalinos',
    'Design ergonômico dobrável com almofadas memory foam',
  ],
  price: 'R$ 299,90',
  imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=800&auto=format&fit=crop',
  rawJson: {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: 'Fone Bluetooth Sem Fio Noise Cancelling Pro Ultra Sound Black Edition',
    image: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e'],
    description: 'Fone de ouvido com cancelamento de ruído e alta fidelidade sonora.',
    sku: 'FONE-EXTREME-PRO-BLK',
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: '299.90',
      availability: 'https://schema.org/InStock',
    },
  },
};
