/**
 * src/features/live-demo/hooks/useLiveSseTerminal.ts
 *
 * Hook para auto-scroll suave e rastreamento do final da lista de logs no terminal.
 */

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
import type { DemoLogEvent } from '../types';

export interface UseLiveSseTerminalReturn {
  terminalEndRef: RefObject<HTMLDivElement | null>;
  copied: boolean;
  copyLogs: () => Promise<void>;
}

export function useLiveSseTerminal(
  logs: DemoLogEvent[]
): UseLiveSseTerminalReturn {
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const copyLogs = useCallback(async () => {
    if (logs.length === 0) return;

    const formattedLogs = logs
      .map((log) => {
        const repeatSuffix = log.count && log.count > 1 ? ` (x${log.count})` : '';
        return `[${log.timestamp}] [${log.level}] ${log.message}${repeatSuffix}`;
      })
      .join('\n');

    try {
      await navigator.clipboard.writeText(formattedLogs);
      setCopied(true);

      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Fallback simples se navigator.clipboard falhar
      const textarea = document.createElement('textarea');
      textarea.value = formattedLogs;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  }, [logs]);

  return {
    terminalEndRef,
    copied,
    copyLogs,
  };
}

export default useLiveSseTerminal;
