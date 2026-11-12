import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  // Lê o arquivo .env mestre a partir da raiz do monorepo
  envDir: path.resolve(__dirname, '../'),
  plugins: [react(), tailwindcss(), basicSsl()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Alvo de compilação ES moderno para melhor performance e menor tamanho de bundle
    target: 'esnext',
    // Não expõe código-fonte original no navegador em produção
    sourcemap: false,
    // Utiliza minificador nativo Oxc do Vite 8 sem conflito com esbuild
    minify: 'oxc',
    // Limpa a pasta dist antes da build
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            return 'vendor-libs';
          }
        },
      },
    },
  },
});