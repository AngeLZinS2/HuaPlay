import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'mobile'
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'script-defer',
            includeAssets: ['sakura.png', 'logo-wei.webp'],
            manifest: {
              name: 'HuaPlay',
              short_name: 'HuaPlay',
              description: 'Assista seus dramas favoritos no HuaPlay',
              theme_color: '#000000',
              background_color: '#000000',
              display: 'standalone',
              orientation: 'portrait',
              start_url: '/',
              icons: [
                {
                  src: 'sakura.png',
                  sizes: '192x192',
                  type: 'image/png'
                },
                {
                  src: 'sakura.png',
                  sizes: '512x512',
                  type: 'image/png'
                }
              ]
            },
            devOptions: {
              enabled: true
            }
          })
        ])
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('firebase/firestore') || id.includes('@firebase/firestore')) {
            return 'firebase-firestore'
          }
          if (id.includes('firebase/') || id.includes('@firebase/')) {
            return 'firebase-auth'
          }
          if (id.includes('framer-motion')) {
            return 'framer-motion'
          }
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) {
            return 'react-vendor'
          }
        }
      }
    }
  },
  server: {
    host: true
  }
}))
