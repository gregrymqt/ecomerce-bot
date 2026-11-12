export function sanitizeDocumentNumber(raw?: string | null): string {
  return (raw || '').replace(/\D/g, '');
}

export function isValidCpfOrCnpjDigits(raw?: string | null): boolean {
  const digits = sanitizeDocumentNumber(raw);
  if (digits.length !== 11 && digits.length !== 14) {
    return false;
  }
  return !/^(\d)\1+$/.test(digits);
}
