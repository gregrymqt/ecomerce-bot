import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Ocorreu um erro inesperado na interface.',
    };
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Erro não capturado na árvore React:', error, info);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: null });
  };

  private handleGoHome = (): void => {
    this.setState({ hasError: false, errorMessage: null });
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-screen w-full bg-[#090D16] text-slate-100 flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full rounded-2xl bg-[#15121B] border border-red-500/30 p-8 shadow-2xl space-y-6 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle className="h-7 w-7" aria-hidden="true" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white">Algo deu errado ao exibir esta página</h1>
              <p className="text-sm text-slate-400">
                Capturamos uma falha inesperada na renderização para evitar a perda da sua sessão.
              </p>
              {this.state.errorMessage && (
                <p className="text-xs font-mono text-red-300/90 bg-red-950/40 border border-red-500/20 rounded-lg px-3 py-2 break-words">
                  {this.state.errorMessage}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Voltar para o início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
