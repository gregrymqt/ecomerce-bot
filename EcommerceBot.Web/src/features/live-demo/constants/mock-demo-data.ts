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

