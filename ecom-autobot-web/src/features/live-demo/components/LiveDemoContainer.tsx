import React from 'react';
import { useDemoStream } from '../hooks/useDemoStream';
import { DemoUrlForm } from './DemoUrlForm';
import { DemoStreamViewer } from './DemoStreamViewer';
import { Alert } from '@/components/ui/feedback/Alert';
import type { LiveDemoContainerProps } from '..';

export const LiveDemoContainer: React.FC<LiveDemoContainerProps> = ({ className }) => {
  const { logs, progress, isStreaming, error, startDemo, stopDemo, resetDemo } = useDemoStream();

  const hasStarted = isStreaming || logs.length > 0;

  return (
    <div className={`w-full max-w-4xl mx-auto flex flex-col gap-6 ${className || ''}`}>
      {!hasStarted && error && (
        <Alert variant="error" title="Erro ao iniciar demonstração" onClose={resetDemo}>
          {error}
        </Alert>
      )}

      {!hasStarted ? (
        <DemoUrlForm onSubmit={startDemo} isLoading={isStreaming} />
      ) : (
        <DemoStreamViewer
          logs={logs}
          progress={progress}
          isStreaming={isStreaming}
          error={error}
          onStop={stopDemo}
          onReset={resetDemo}
        />
      )}
    </div>
  );
};
