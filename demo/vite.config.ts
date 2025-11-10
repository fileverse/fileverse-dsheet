import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {

  const env = loadEnv(mode, process.cwd())
  return {
    preview: {
      allowedHosts: ['4d8167243e8b.ngrok-free.app'],
    },
    plugins: [react()],
    define: {
      'process.env': {
        NEXT_PUBLIC_PROXY_BASE_URL: JSON.stringify(env.NEXT_PUBLIC_PROXY_BASE_URL)
      }
    }
  }
})
