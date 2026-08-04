import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

export default defineConfig({
  mode: process.env.NODE_ENV,
  resolve: {
    dedupe: ['yjs'],
    alias: {
      '@sheet-engine/core': path.resolve(__dirname, 'src/sheet-engine/core'),
      '@sheet-engine/react': path.resolve(__dirname, 'src/sheet-engine/react'),
      '@sheet-engine/formula-parser': path.resolve(
        __dirname,
        'src/sheet-engine/formula-parser',
      ),
    },
  },
  // The dsheet worker builds as a separate self-contained graph: iife output
  // inlines its dynamic imports AND ignores the library externals below, so
  // exceljs/luckyexcel are bundled into the worker blob (a blob worker cannot
  // resolve bare imports).
  worker: {
    format: 'iife',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  build: {
    lib: {
      name: 'dsheet',
      entry: {
        index: path.resolve(__dirname, './src/index.ts'),
        constants: path.resolve(__dirname, './src/constants.ts'),
        formula: path.resolve(__dirname, './src/formula.ts'),
        persistence: path.resolve(__dirname, './src/persistence.ts'),
      },
      formats: ['es'],
      fileName: (format, entryName) =>
        entryName === 'index' ? `index.${format}.js` : `${entryName}.js`,
    },
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      external: [
        'react',
        'react-dom',
        'yjs',
        /^yjs\//,
        'y-indexeddb',
        'y-protocols',
        'exceljs',
        'xlsx',
        'xlsx-js-style',
        'katex',
        'lodash',
        'papaparse',
        'luckyexcel',
        'immer',
        'dayjs',
        '@fileverse/ui',
        '@fileverse/ens',
        '@fileverse-dev/formulajs',
        '@fileverse-dev/dsheets-templates',
        '@tippyjs/react',
        'viem',
        'viem/chains',
        'viem/ens',
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        chunkFileNames: '[name]-[hash].js',
      },
    },
    sourcemap: false,
    emptyOutDir: true,
  },
  plugins: [
    react(),
    dts({
      tsconfigPath: './tsconfig.json',
    }),
  ],
  define: {
    'process:env.NODE_ENV': JSON.stringify('production'),
  },
});
