import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [react()],
    define: {
      'process.env': {
        NEXT_PUBLIC_PROXY_BASE_URL: JSON.stringify(env.NEXT_PUBLIC_PROXY_BASE_URL)
      }
    }
  }
})
