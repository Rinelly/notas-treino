import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Carimbo de quando o build foi feito, em horário de Maceió.
 * Aparece lá embaixo na tela Hoje — serve pra comparar computador
 * e celular e saber na hora se um dos dois ficou pra trás.
 */
const versao = new Date().toLocaleString('pt-BR', {
  timeZone: 'America/Maceio',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

// https://vite.dev/config/
export default defineConfig({
  define: {
    __VERSAO__: JSON.stringify(versao),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // o registro é feito à mão em src/lib/atualizacao.ts
      injectRegister: null,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Foco & Treino',
        lang: 'pt-BR',
        short_name: 'Foco',
        description: 'Horas de foco e registro de treinos, num lugar só',
        theme_color: '#0a0a0b',
        background_color: '#0a0a0b',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
