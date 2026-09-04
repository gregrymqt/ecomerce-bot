import React from 'react';
import { Helmet } from 'react-helmet-async';

export interface SEOProps {
  /** Título da página (será sufixado com | E-Commerce AutoBot se fornecido) */
  title?: string;
  /** Descrição detalhada para buscadores e redes sociais */
  description?: string;
  /** URL da imagem Open Graph/Twitter */
  image?: string;
  /** URL canônica da página */
  url?: string;
  /** Tipo Open Graph (padrão: website) */
  type?: string;
  /** Palavras-chave separadas por vírgula */
  keywords?: string;
  /** Se verdadeiro, instrui robôs a não indexarem a página */
  noIndex?: boolean;
  /** Dados estruturados Schema.org (JSON-LD) */
  schemaData?: Record<string, unknown>;
}

const DEFAULT_TITLE = 'E-Commerce AutoBot - Extração e Enriquecimento de Catálogos com IA';
const DEFAULT_DESCRIPTION = 'Plataforma inteligente para extração automática, enriquecimento via IA e exportação/sincronização de catálogos de produtos de e-commerce.';
const DEFAULT_IMAGE = '/og-image.png';
const DEFAULT_URL = 'https://ecommercebot.com';
const SITE_NAME = 'E-Commerce AutoBot';

export const SEO: React.FC<SEOProps> = ({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url = DEFAULT_URL,
  type = 'website',
  keywords,
  noIndex = false,
  schemaData,
}) => {
  const pageTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;

  return (
    <Helmet>
      {/* Title & Meta Tags Básicas */}
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph / Facebook / WhatsApp / LinkedIn */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Schema.org / JSON-LD */}
      {schemaData && (
        <script type="application/ld+json">
          {JSON.stringify(schemaData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
