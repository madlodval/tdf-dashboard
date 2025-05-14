// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap'

// https://astro.build/config
export default defineConfig({

  site: 'https://tradingdifferent.com',
  vite: {
    resolve: {
      alias: {
        "Scripts": "/src/assets/js"
      }
    },
    css: {
      transformer: 'lightningcss'
    },
    build: {
      cssMinify: 'lightningcss',
      rollupOptions: {
        output: {
          manualChunks: id => {
            if (id.includes('node_modules/echarts')) {
              return 'echarts'; // Chunk para ECharts
            }
            if (id.includes('node_modules/lightweight-charts')) {
               // Chunk para Lightweight Charts. Lightweight Charts a menudo tiene archivos en subcarpetas como 'dist' o 'es'.
               // id.includes('node_modules/lightweight-charts') cubrirá cualquiera de ellas.
              return 'lightweight-charts';
            }
            // Opcional: Crear un chunk 'vendor' para otras dependencias grandes de node_modules
            // Esto ayuda a separar el código de tus librerías de terceros más comunes
            if (id.includes('node_modules') && !id.includes('node_modules/alpinejs')) {
              return 'vendor';
            }
            // Si no coincide con ninguna regla, Rollup maneja el chunking por defecto
            // (probablemente en el chunk principal del script o en chunks compartidos generados automáticamente)
          }
        }
      }
    },
    plugins: [tailwindcss()]
  },

  compressHTML: true,
  trailingSlash: 'never',
  integrations: [
    sitemap()
  ],
  build: {
    format: 'file',
    assets: 'assets'
  },
  redirects: {
    '/': '/dashboard/future-market-stats'
  }
});