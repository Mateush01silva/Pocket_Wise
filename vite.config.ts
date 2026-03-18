import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest allows a custom service worker with push notification handlers.
      // Workbox will inject the precache manifest into public/sw.ts at build time.
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,jpeg,jpg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      includeAssets: ['Logo_PocketWise.jpeg'],
      manifest: {
        name: 'Pocket Wise - Controle Financeiro',
        short_name: 'Pocket Wise',
        description: 'Controle suas finanças com clareza e tome decisões seguras todo dia',
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/app',
        lang: 'pt-BR',
        categories: ['finance', 'productivity'],
        icons: [
          {
            src: 'Logo_PocketWise.jpeg',
            sizes: '192x192',
            type: 'image/jpeg',
            purpose: 'any',
          },
          {
            src: 'Logo_PocketWise.jpeg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any',
          },
          {
            src: 'Logo_PocketWise.jpeg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
