import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

const throwState = { active: true };

const ThrowControl: React.FC = () => {
  if (throwState.active) {
    throw new Error('Falha simulada no componente filho');
  }
  return <div>Conteúdo recuperado</div>;
};

describe('ErrorBoundary (UX-01)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    throwState.active = true;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('deve capturar erro em runtime no componente filho e exibir fallback acessível', () => {
    render(
      <ErrorBoundary>
        <ThrowControl />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Algo deu errado ao exibir esta página/i)).toBeInTheDocument();
    expect(screen.getByText(/Falha simulada no componente filho/i)).toBeInTheDocument();

    throwState.active = false;
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));

    expect(screen.getByText('Conteúdo recuperado')).toBeInTheDocument();
  });
});
