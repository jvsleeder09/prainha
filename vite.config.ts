import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Encaminha as chamadas do assistente para o backend local de IA (npm run server).
    // A chave da API fica apenas nesse servidor; o navegador nunca a recebe.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.AI_SERVER_PORT ?? 8787}`,
        changeOrigin: false,
      },
    },
  },
  preview: {
    proxy: {
      '/api': `http://127.0.0.1:${process.env.AI_SERVER_PORT ?? 8787}`,
    },
  },
})
