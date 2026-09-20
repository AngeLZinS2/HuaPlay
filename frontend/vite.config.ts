import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['sakura.png', 'Logo Wei.png'],
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
  ],
  server: {
    host: true
  }
})
