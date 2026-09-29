import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  // Isolated until Home and Orders migration is verified.
  base: '/',
  build: { outDir: 'dist', emptyOutDir: true },
});
