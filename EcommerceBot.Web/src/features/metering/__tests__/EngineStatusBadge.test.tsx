/**
 * src/features/metering/__tests__/EngineStatusBadge.test.tsx
 *
 * Testes unitários para o componente EngineStatusBadge.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EngineStatusBadge } from '../components/EngineStatusBadge';

describe('EngineStatusBadge component', () => {
  it('deve renderizar o texto "Sua Chave OpenRouter (BYOK)" quando isByokActive for true', () => {
    render(<EngineStatusBadge isByokActive={true} />);

    expect(screen.getByText('Sua Chave OpenRouter (BYOK)')).toBeInTheDocument();
  });

  it('deve renderizar o texto "Infraestrutura SaaS (Créditos)" quando isByokActive for false', () => {
    render(<EngineStatusBadge isByokActive={false} />);

    expect(screen.getByText('Infraestrutura SaaS (Créditos)')).toBeInTheDocument();
  });
});
