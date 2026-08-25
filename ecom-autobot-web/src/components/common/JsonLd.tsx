import React from 'react';

export interface JsonLdProps {
  /** Objeto de dados estruturados Schema.org */
  data: Record<string, any>;
}

/**
 * Componente para injeção de Schema Markup (JSON-LD) no HTML para motores de busca e Rich Snippets.
 */
export const JsonLd: React.FC<JsonLdProps> = ({ data }) => {
  return (
    <script
      type="application/ld+json"
      // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
};

export default JsonLd;
