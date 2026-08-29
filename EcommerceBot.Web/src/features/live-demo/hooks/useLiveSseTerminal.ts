/**
 * src/features/live-demo/hooks/useLiveSseTerminal.ts
 *
 * Hook para auto-scroll suave e rastreamento do final da lista de logs no terminal.
 */

import { useEffect, useRef, type RefObject } from 'react';
import type { DemoLogEvent } from '../types';

export interface UseLiveSseTerminalReturn {
  terminalEndRef: RefObject<HTMLDivElement | null>;
}

export function useLiveSseTerminal(
  logs: DemoLogEvent[]
): UseLiveSseTerminalReturn {
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return {
    terminalEndRef,
  };
}

export default useLiveSseTerminal;
