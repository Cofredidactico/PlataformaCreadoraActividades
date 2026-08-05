import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' => rutas relativas. Asi el build funciona igual en GitHub Pages
// (aunque este en un subdirectorio), Vercel, Netlify o abriendo dist/ localmente.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
});
