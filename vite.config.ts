import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

export default defineConfig({
  mode: process.env.NODE_ENV,
  resolve: {
    alias: {
      '@sheet-engine/core': path.resolve(__dirname, 'src/sheet-engine/core'),
      '@sheet-engine/react': path.resolve(__dirname, 'src/sheet-engine/react'),
      '@sheet-engine/formula-parser': path.resolve(
        __dirname,
        'src/sheet-engine/formula-parser'
      ),
    },
  },
  build: {
    lib: {
      name: 'dsheet',
      entry: path.resolve(__dirname, './src/index.ts'),
      formats: ['es'],
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      external: [
        'react',
        'react-dom',
        'yjs',
        'y-indexeddb',
        'y-protocols',
        'y-webrtc',
        'y-websocket',
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
        '@fileverse-dev/formulajs',
        '@fileverse-dev/dsheets-templates',
        '@tippyjs/react',
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
