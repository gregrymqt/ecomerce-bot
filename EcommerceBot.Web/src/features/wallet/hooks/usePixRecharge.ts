/**
 * src/features/wallet/hooks/usePixRecharge.ts
 *
 * Hook customizado para gerenciar a lógica de temporizador regressivo e cópia
 * para área de transferência da aba PixRechargeTab.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export function usePixRecharge(pixCopiaECola?: string, initialTimeSeconds = 900) {
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(initialTimeSeconds);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer Regressivo de Expiração
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Limpeza de timeout ao desmontar
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Formata os segundos em MM:SS
   */
  const formatTime = useCallback((totalSeconds: number): string => {
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(min)}:${pad(sec)}`;
  }, []);

  /**
   * Copia o código PIX Copia e Cola para o clipboard com feedback visual de 3s
   */
  const handleCopyPixCode = useCallback(async () => {
    if (!pixCopiaECola) return;

    try {
      await navigator.clipboard.writeText(pixCopiaECola);
      setIsCopied(true);

      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      copyTimeoutRef.current = setTimeout(() => {
        setIsCopied(false);
      }, 3000);
    } catch {
      // Ignora erros no clipboard em navegadores não suportados
    }
  }, [pixCopiaECola]);

  return {
    isCopied,
    timeLeft,
    formattedTimeLeft: formatTime(timeLeft),
    formatTime,
    handleCopyPixCode,
  };
}

export default usePixRecharge;
