/**
 * src/features/wallet/hooks/useCreditCardForm.ts
 *
 * Hook customizado para gerenciar a lógica de formulário, máscaras, validações
 * e cálculo de parcelas do cartão de crédito (CreditCardRechargeTab).
 */

import { useState, useMemo } from 'react';

export interface CreditCardFormData {
  cardNumber: string;
  cardholderName: string;
  expirationDate: string;
  securityCode: string;
  installments: number;
}

export interface UseCreditCardFormProps {
  onSubmitCard: (cardData: CreditCardFormData) => Promise<void>;
  amountBrl?: number;
}

export function useCreditCardForm({ onSubmitCard, amountBrl = 80 }: UseCreditCardFormProps) {
  const [formData, setFormData] = useState<CreditCardFormData>({
    cardNumber: '',
    cardholderName: '',
    expirationDate: '',
    securityCode: '',
    installments: 1,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Máscara simples para número do cartão (0000 0000 0000 0000)
   */
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 16);
    return v.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  /**
   * Máscara para data de expiração (MM/AA)
   */
  const formatExpiration = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 3) {
      return `${v.slice(0, 2)}/${v.slice(2)}`;
    }
    return v;
  };

  const handleChange = (field: keyof CreditCardFormData, value: string | number) => {
    let formattedVal = value;
    if (field === 'cardNumber' && typeof value === 'string') {
      formattedVal = formatCardNumber(value);
    } else if (field === 'expirationDate' && typeof value === 'string') {
      formattedVal = formatExpiration(value);
    } else if (field === 'cardholderName' && typeof value === 'string') {
      formattedVal = value.toUpperCase();
    } else if (field === 'securityCode' && typeof value === 'string') {
      formattedVal = value.replace(/\D/g, '');
    }

    setFormData((prev) => ({ ...prev, [field]: formattedVal }));

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.cardNumber.replace(/\s/g, '') || formData.cardNumber.replace(/\s/g, '').length < 13) {
      newErrors.cardNumber = 'Número de cartão inválido';
    }
    if (!formData.cardholderName.trim()) {
      newErrors.cardholderName = 'Informe o nome impresso no cartão';
    }
    if (!formData.expirationDate || formData.expirationDate.length < 5) {
      newErrors.expirationDate = 'Validade inválida (MM/AA)';
    }
    if (!formData.securityCode || formData.securityCode.length < 3) {
      newErrors.securityCode = 'CVV inválido';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await onSubmitCard(formData);
  };

  // Opções de Parcelamento (1x até 12x com cálculo dinâmico)
  const installmentOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const count = index + 1;
      const valuePerInstallment = (amountBrl / count).toFixed(2).replace('.', ',');
      return {
        value: count,
        label: `${count}x de R$ ${valuePerInstallment} ${count === 1 ? '(à vista)' : 'sem juros'}`,
      };
    });
  }, [amountBrl]);

  return {
    formData,
    errors,
    installmentOptions,
    handleChange,
    handleSubmit,
  };
}

export default useCreditCardForm;
