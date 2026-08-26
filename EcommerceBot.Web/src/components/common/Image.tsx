import React from 'react';

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** URL da imagem */
  src: string;
  /** Texto alternativo obrigatório para acessibilidade */
  alt: string;
  /** Se verdadeiro (padrão), utiliza carregamento preguiçoso (loading="lazy") */
  lazy?: boolean;
}

/**
 * Componente otimizado de Imagem com suporte nativo a carregamento preguiçoso (lazy loading) e decodificação assíncrona.
 */
export const Image: React.FC<ImageProps> = ({
  src,
  alt,
  lazy = true,
  className,
  ...props
}) => {
  return (
    <img
      src={src}
      alt={alt}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
      className={className}
      {...props}
    />
  );
};

export default Image;
