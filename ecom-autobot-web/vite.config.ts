import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Não expõe código-fonte original no navegador em produção
    sourcemap: false,
    // Garante minificação agressiva
    minify: 'esbuild',
    // Limpa a pasta dist antes da build
    emptyOutDir: true,
  },
});