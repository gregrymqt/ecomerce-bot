/**
 * src/features/live-demo/constants/mock-demo-data.ts
 *
 * Dados de amostra e resultados enriquecidos simulados para a demonstração ao vivo.
 */

import type { SampleUrlItem, ScrapedProductResult } from '../types';

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

export const MOCK_DEMO_RESULT: ScrapedProductResult = {
  titleOriginal: 'Fone de Ouvido Bluetooth Sem Fio com Cancelamento de Ruído Preto',
  titleMagnetic: 'Fone Pro ANC Pro Wireless: Silêncio Absoluto & Graves de Alta Definição',
  tone: 'Persuasivo & Tecnológico',
  category: 'Áudio & Eletrônicos Premium',
  seoScore: 98,
  bulletPoints: [
    'Cancelamento Ativo de Ruído (ANC) híbrido que bloqueia até 98% dos sons externos.',
    'Bateria ultradurável com até 40 horas de reprodução contínua e carga rápida USB-C.',
    'Drivers dinâmicos de 40mm com resposta de frequência ajustada para graves profundos.',
    'Conexão multiponto Bluetooth 5.3 com latência ultrabaixa para jogos e chamadas.',
    'Almofadas em espuma memory foam respirável para máximo conforto o dia todo.',
  ],
  price: 'R$ 389,90',
  imageUrl:
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
  rawJson: {
    sku: 'ANC-PRO-BLK-01',
    name: 'Fone Pro ANC Pro Wireless',
    price: 389.9,
    currency: 'BRL',
    brand: 'AcousticTech',
    availability: 'https://schema.org/InStock',
    aggregateRating: {
      ratingValue: 4.9,
      reviewCount: 142,
    },
    seo: {
      meta_title: 'Fone Bluetooth com Cancelamento de Ruído ANC Pro | Frete Grátis',
      meta_description:
        'Experimente o melhor isolamento acústico com o Fone Pro ANC. Bateria de 40h, graves potentes e chamadas cristalinas.',
      keywords: ['fone bluetooth', 'cancelamento de ruido', 'fone sem fio', 'ANC'],
    },
  },
};
