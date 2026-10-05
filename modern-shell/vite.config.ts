import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Isolated React + Motion islands for Eatswada. Each island is a single
// self-contained IIFE emitted into ../islands/ and referenced by the
// existing HTML behind a feature flag. No SPA shell, no iframe, no dev
// tooling shipped. Select the island with ISLAND=orders|nav|shell.
const island =
  process.env.ISLAND === 'nav' ? 'nav' : process.env.ISLAND === 'shell' ? 'shell' : 'orders';

const entries = {
  orders: { file: 'orders-island.tsx', name: 'EatswadaOrdersIsland', out: 'orders-island' },
  nav: { file: 'nav-island.tsx', name: 'EatswadaNavIsland', out: 'nav-island' },
  shell: { file: 'app-shell.tsx', name: 'EatswadaAppShell', out: 'app-shell' },
} as const;

const entry = fileURLToPath(new URL(`./src/${entries[island].file}`, import.meta.url));
const outDir = fileURLToPath(new URL('../islands', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir,
    // The two islands share ../islands/; the clean script runs once first.
    emptyOutDir: false,
    cssCodeSplit: false,
    sourcemap: false,
    target: 'es2020',
    lib: {
      entry,
      name: entries[island].name,
      formats: ['iife'],
      fileName: () => `${entries[island].out}.js`,
    },
    rollupOptions: {
      output: {
        assetFileNames: `${entries[island].out}[extname]`,
        inlineDynamicImports: true,
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
