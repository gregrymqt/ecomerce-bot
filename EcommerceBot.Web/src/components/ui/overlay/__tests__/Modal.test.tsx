/**
 * src/components/ui/overlay/__tests__/Modal.test.tsx
 *
 * Testes unitários para o componente Modal com React Portal.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../Modal';

describe('Modal component (React Portal)', () => {
  it('não deve renderizar nada no DOM quando isOpen for false', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Título de Teste">
        <p>Conteúdo Oculto</p>
      </Modal>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Conteúdo Oculto')).not.toBeInTheDocument();
  });

  it('deve renderizar no document.body com z-[60] quando isOpen for true', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Checkout Seguro" description="Descrição do modal">
        <p>Conteúdo do Modal</p>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Checkout Seguro')).toBeInTheDocument();
    expect(screen.getByText('Descrição do modal')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo do Modal')).toBeInTheDocument();

    // Verifica se o container raiz está anexado ao document.body
    const overlayContainer = dialog.parentElement;
    expect(overlayContainer?.classList.contains('z-[60]')).toBe(true);
    expect(document.body.contains(dialog)).toBe(true);
  });

  it('deve chamar onClose ao clicar no botão de fechar', () => {
    const handleClose = vi.fn();

    render(
      <Modal isOpen={true} onClose={handleClose} title="Modal Fechável">
        <p>Corpo</p>
      </Modal>
    );

    const closeButton = screen.getByRole('button', { name: /Fechar modal/i });
    fireEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('deve chamar onClose ao pressionar a tecla Escape', () => {
    const handleClose = vi.fn();

    render(
      <Modal isOpen={true} onClose={handleClose} title="Modal ESC">
        <p>Corpo</p>
      </Modal>
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('não deve chamar onClose ao clicar no interior do diálogo (stopPropagation)', () => {
    const handleClose = vi.fn();

    render(
      <Modal isOpen={true} onClose={handleClose} title="Modal Protegido">
        <div data-testid="modal-inner">Conteúdo Interno</div>
      </Modal>
    );

    const inner = screen.getByTestId('modal-inner');
    fireEvent.click(inner);

    expect(handleClose).not.toHaveBeenCalled();
  });

  it('deve travar o overflow do body ao abrir e restaurar ao fechar', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="Modal Overflow">
        <p>Corpo</p>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal isOpen={false} onClose={vi.fn()} title="Modal Overflow">
        <p>Corpo</p>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('unset');
  });
});
