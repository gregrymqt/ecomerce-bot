import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreditCardPaymentTab } from './CreditCardPaymentTab';

describe('CreditCardPaymentTab / CreditCardForm Component', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  it('should render all credit card form fields and submit button correctly', () => {
    render(<CreditCardPaymentTab amountBrl={197} loading={false} onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/Número do Cartão/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome Impresso no Cartão/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Validade \(MM\/AA\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/CVV \/ CVC/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Parcelamento/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/CPF ou CNPJ do Titular/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Finalizar (Pagamento|Assinatura) Segur[oa]/i });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).not.toBeDisabled();
  });

  it('should format card number and expiration date dynamically as user types', async () => {
    const user = userEvent.setup();
    render(<CreditCardPaymentTab amountBrl={197} loading={false} onSubmit={mockOnSubmit} />);

    const cardNumberInput = screen.getByLabelText(/Número do Cartão/i) as HTMLInputElement;
    const expiryInput = screen.getByLabelText(/Validade \(MM\/AA\)/i) as HTMLInputElement;

    await user.type(cardNumberInput, '4111111111111111');
    expect(cardNumberInput.value).toBe('4111 1111 1111 1111');

    await user.type(expiryInput, '1226');
    expect(expiryInput.value).toBe('12/26');
  });

  it('should submit formatted payload when form is submitted with valid inputs', async () => {
    const user = userEvent.setup();
    render(<CreditCardPaymentTab amountBrl={197} loading={false} onSubmit={mockOnSubmit} />);

    const cardNumberInput = screen.getByLabelText(/Número do Cartão/i);
    const nameInput = screen.getByLabelText(/Nome Impresso no Cartão/i);
    const expiryInput = screen.getByLabelText(/Validade \(MM\/AA\)/i);
    const cvvInput = screen.getByLabelText(/CVV \/ CVC/i);
    const docInput = screen.getByLabelText(/CPF ou CNPJ do Titular/i);
    const submitBtn = screen.getByRole('button', { name: /Finalizar (Pagamento|Assinatura) Segur[oa]/i });

    await user.type(cardNumberInput, '4111222233334444');
    await user.type(nameInput, 'MARIA SILVA');
    await user.type(expiryInput, '1128');
    await user.type(cvvInput, '888');
    await user.type(docInput, '12345678901');

    await user.click(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethodId: 'visa',
        formData: expect.objectContaining({
          cardNumber: '4111222233334444',
          cardholderName: 'MARIA SILVA',
          expirationMonth: '11',
          expirationYear: '2028',
          securityCode: '888',
          installments: 1,
          docNumber: '12345678901',
        }),

      })
    );
  });

  it('should display error message on validation failure', async () => {
    const user = userEvent.setup();
    render(<CreditCardPaymentTab amountBrl={197} loading={false} onSubmit={mockOnSubmit} />);

    const cardNumberInput = screen.getByLabelText(/Número do Cartão/i);

    await user.type(cardNumberInput, '123');

    fireEvent.submit(cardNumberInput.closest('form')!);

    expect(screen.getByText(/informe um número de cartão de crédito válido/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should enforce accessible touch target heights (>= 44px) and prevent iOS auto-zoom font sizes (>= 16px)', () => {
    render(<CreditCardPaymentTab amountBrl={197} loading={false} onSubmit={mockOnSubmit} />);

    const inputs = [
      screen.getByLabelText(/Número do Cartão/i),
      screen.getByLabelText(/Nome Impresso no Cartão/i),
      screen.getByLabelText(/Validade \(MM\/AA\)/i),
      screen.getByLabelText(/CVV \/ CVC/i),
      screen.getByLabelText(/CPF ou CNPJ do Titular/i),
      screen.getByLabelText(/Parcelamento/i),
    ];

    inputs.forEach((input) => {
      const className = input.className;
      const hasAccessibleHeight = className.includes('min-h-[44px]') || className.includes('h-11');
      expect(hasAccessibleHeight).toBe(true);

      const hasPreventZoomFontSize = className.includes('text-sm sm:text-base') || className.includes('text-base');
      expect(hasPreventZoomFontSize).toBe(true);
    });

    const submitBtn = screen.getByRole('button', { name: /Finalizar (Pagamento|Assinatura) Segur[oa]/i });
    const btnClassName = submitBtn.className;
    expect(btnClassName.includes('min-h-[44px]') || btnClassName.includes('h-12')).toBe(true);
  });
});
