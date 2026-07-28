import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  Sparkles,
  Bot,
  Activity,
  RotateCcw,
  Cpu,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { useLiveDemoSSE } from '../hooks/useLiveDemoSSE';
import { DemoHeroInput } from '../components/DemoHeroInput';
import { LiveSseTerminal } from '../components/LiveSseTerminal';
import { ResultPreviewCard } from '../components/ResultPreviewCard';
import { BottomCtaBanner } from '../components/BottomCtaBanner';

export const LiveDemoPage: React.FC = () => {
  const navigate = useNavigate();
  const { status, logs, progress, result, targetUrl, startExtraction, resetDemo } =
    useLiveDemoSSE();

  const isWorking = status === 'connecting' || status === 'simulating';

  return (
    <div className="min-h-screen bg-[#090D16] text-white flex flex-col selection:bg-purple-500 selection:text-white pb-32">
      {/* Header Público */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Marca */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/30">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                E-Commerce Bot
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-500/30 uppercase">
                  DEMO SSE
                </span>
              </span>
            </div>
          </div>

          {/* Status do Servidor & Botões de Ação */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Pub/Sub Engine Online</span>
            </div>

            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="min-h-[44px] h-11 px-4 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800 transition-all flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              <span>Entrar</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="min-h-[44px] h-11 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-600/30 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>Criar Conta</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 space-y-12 flex-1 w-full">
        {/* Hero Section */}
        <section className="text-center space-y-4 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-purple-950/60 text-purple-300 border border-purple-500/30 shadow-lg backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
            <span>ENGENHO DE AUTOMAÇÃO EM TEMPO REAL</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-purple-300 tracking-tight leading-tight">
            Veja a IA Extraindo e Enriquecendo Produtos em Tempo Real
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Transforme URLs brutas da Shopify, Nuvemshop ou Mercado Livre em títulos magnéticos de alta conversão, descrições persuasivas e SEO impecável em segundos.
          </p>

          <div className="pt-4">
            <DemoHeroInput onSubmit={startExtraction} isLoading={isWorking} />
          </div>
        </section>

        {/* Workspace de 2 Colunas (Terminal SSE + Preview Card) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold text-white">Workspace de Transmissão</h2>
              {targetUrl && (
                <span className="text-xs font-mono text-slate-400 truncate max-w-md hidden sm:inline-block">
                  — {targetUrl}
                </span>
              )}
            </div>

            {status !== 'idle' && (
              <button
                type="button"
                onClick={resetDemo}
                className="min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Resetar Demo</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Terminal SSE à Esquerda */}
            <div className="lg:col-span-6">
              <LiveSseTerminal
                status={status}
                logs={logs}
                progress={progress}
              />
            </div>

            {/* Resultado Enriquecido à Direita */}
            <div className="lg:col-span-6">
              {result ? (
                <ResultPreviewCard result={result} />
              ) : (
                <div className="w-full rounded-2xl bg-slate-950/60 border border-slate-800/80 p-8 flex flex-col items-center justify-center text-center min-h-[360px] gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-center shadow-inner">
                    <Cpu className="w-7 h-7 text-purple-400 animate-pulse" />
                  </div>
                  <div className="space-y-1.5 max-w-md">
                    <h3 className="text-base font-bold text-white">
                      {isWorking
                        ? 'Processando com LLM...'
                        : 'Aguardando Ingestão de Produto'}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {isWorking
                        ? 'O robô está extraindo o JSON-LD e aplicando os algoritmos de copywriting magnético. Os resultados aparecerão aqui em instantes.'
                        : 'Escolha uma das URLs de teste acima ou cole um link de e-commerce para visualizar o catálogo enriquecido em tempo real.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Banner CTA Flutuante no Rodapé */}
      <BottomCtaBanner
        onStartFreeTrial={() => navigate('/auth')}
        onViewDocs={() => window.open('https://github.com', '_blank')}
      />
    </div>
  );
};

export default LiveDemoPage;
