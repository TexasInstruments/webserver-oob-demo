import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

const BACKEND = 'http://localhost:3000'
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

const DEVICE = process.env.VITE_DEVICE || 'am62dxx'

// Files under devices/<id>/ui/ sit outside the Vite root (frontend/).
// Rollup won't find frontend/node_modules from there, so this plugin
// intercepts those bare-specifier imports and re-resolves them using
// src/main.js as anchor, which honours the package exports map correctly.
const FRONTEND_ROOT = fileURLToPath(new URL('.', import.meta.url)).replace(/\\/g, '/')
function resolveExternalPlugin() {
  return {
    name: 'resolve-external-imports',
    enforce: 'pre',
    async resolveId(id, importer) {
      if (!importer || id.startsWith('.') || id.startsWith('/') || id.startsWith('\0')) return null
      if (importer.replace(/\\/g, '/').startsWith(FRONTEND_ROOT)) return null
      const anchor = fileURLToPath(new URL('./src/main.js', import.meta.url))
      return this.resolve(id, anchor, { skipSelf: true })
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__:  JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    resolveExternalPlugin(),
    vue({ template: { transformAssetUrls } }),
    vuetify({ autoImport: false }),
  ],
  resolve: {
    alias: {
      '@':       fileURLToPath(new URL('./src', import.meta.url)),
      '@device': fileURLToPath(new URL(`../devices/${DEVICE}/ui`, import.meta.url)),
    },
    dedupe: ['vue', 'vuetify'],
  },
  base: '/vue-dist/',
  build: {
    outDir: `../devices/${DEVICE}/app/vue-dist`,
    emptyOutDir: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/vuetify/'))  return 'vuetify'
          if (id.includes('/node_modules/vue')   ||
              id.includes('/node_modules/@vue/')) return 'vue'
          if (id.includes('/node_modules/'))          return 'vendor'
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/speech-enhancement':              BACKEND,
      '/start-speech-enhancement':        BACKEND,
      '/stop-speech-enhancement':         BACKEND,
      '/upload-speech-enhancement-file':  BACKEND,
      '/speech-devices':                  BACKEND,
      '/speech-output-devices':           BACKEND,
      '/audio-devices':                   BACKEND,
      '/start-audio-classification':      BACKEND,
      '/stop-audio-classification':       BACKEND,
      '/tvm-inference':                   BACKEND,
      '/tvm-daemon':                      BACKEND,
      '/gst':    { target: 'ws://localhost:3000', ws: true },
      '/cpu-stats':                       BACKEND,
      '/version':                         BACKEND,
      '/system/':                         BACKEND,
      '/ws':     { target: 'ws://localhost:3000', ws: true },
      '/speech': { target: 'ws://localhost:3000', ws: true },
      '/audio':  { target: 'ws://localhost:3000', ws: true },
    },
  },
})
