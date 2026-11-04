import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Solo en `npm run build`: añade a index.html la directiva que obliga al navegador a pedir por
// HTTPS cualquier recurso que apunte a http://. No se aplica en `npm run dev`, para no afectar a localhost.
const forzarHttps = () => ({
  name: 'forzar-https',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: 'upgrade-insecure-requests' },
      injectTo: 'head-prepend',
    },
  ],
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), forzarHttps()],
})
