import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [react()],
    server: {
      fs: {
        allow: ['..'],
      },
    },
    resolve: {
      alias: {
        '@sheet-engine/core': path.resolve(__dirname, '../src/sheet-engine/core'),
        '@sheet-engine/react': path.resolve(__dirname, '../src/sheet-engine/react'),
        '@sheet-engine/formula-parser': path.resolve(__dirname, '../src/sheet-engine/formula-parser'),
      },
    },
    define: {
      'process.env': {
        NEXT_PUBLIC_PROXY_BASE_URL: JSON.stringify(env.NEXT_PUBLIC_PROXY_BASE_URL)
      }
    }
  }
})
