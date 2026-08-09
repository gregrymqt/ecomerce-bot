import { useEffect, useRef, type RefObject } from 'react';
import type { DemoLogEvent } from '@/features/live-demo';

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
