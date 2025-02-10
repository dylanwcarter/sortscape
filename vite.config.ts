import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/', // base public path
  build: {
    outDir: 'dist', // output directory for production build
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        main: resolve(__dirname, 'main.html'),
      },
    },
  },
});
