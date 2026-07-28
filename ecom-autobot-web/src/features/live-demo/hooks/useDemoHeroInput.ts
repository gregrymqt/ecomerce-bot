import { useState } from 'react';
import type { SampleUrlItem } from '../constants/mock-demo-data';

export interface UseDemoHeroInputProps {
  onSubmit: (url: string) => void;
}

export interface UseDemoHeroInputReturn {
  urlInput: string;
  error: string | null;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectSample: (sample: SampleUrlItem) => void;
  handleSubmit: (e: React.FormEvent) => void;
}

export function useDemoHeroInput({
  onSubmit,
}: UseDemoHeroInputProps): UseDemoHeroInputReturn {
  const [urlInput, setUrlInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value);
    if (error) setError(null);
  };

  const handleSelectSample = (sample: SampleUrlItem) => {
    setUrlInput(sample.url);
    if (error) setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setError('Por favor, insira a URL de um produto.');
      return;
    }
    setError(null);
    onSubmit(trimmed);
  };

  return {
    urlInput,
    error,
    handleInputChange,
    handleSelectSample,
    handleSubmit,
  };
}
