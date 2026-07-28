import { useState, useCallback } from 'react';
import type { ScrapedProductResult } from '../types/live-demo.types';

export interface UseResultPreviewCardReturn {
  activeTab: 'visual' | 'json';
  setActiveTab: (tab: 'visual' | 'json') => void;
  copied: boolean;
  handleCopyJson: () => void;
}

export function useResultPreviewCard(
  result: ScrapedProductResult | null
): UseResultPreviewCardReturn {
  const [activeTab, setActiveTab] = useState<'visual' | 'json'>('visual');
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyJson = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result.rawJson, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return {
    activeTab,
    setActiveTab,
    copied,
    handleCopyJson,
  };
}
