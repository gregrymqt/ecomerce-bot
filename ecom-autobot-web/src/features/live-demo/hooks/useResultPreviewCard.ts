import { useState, useCallback, useRef, useEffect } from 'react';
import type { ScrapedProductResult } from '@/features/live-demo';

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
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyJson = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result.rawJson, null, 2));
    setCopied(true);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => {
      setCopied(false);
      copyTimeoutRef.current = null;
    }, 2000);
  }, [result]);

  return {
    activeTab,
    setActiveTab,
    copied,
    handleCopyJson,
  };
}
