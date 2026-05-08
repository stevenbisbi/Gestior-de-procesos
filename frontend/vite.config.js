import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En producción Django sirve el build vía WhiteNoise bajo /static/
// (collectstatic copia frontend_build/* → staticfiles/*)
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/static/' : '/',
  server: {
    port: 5173,
    proxy: {
      '/api':    { target: 'http://localhost:8000', changeOrigin: true },
      '/admin':  { target: 'http://localhost:8000', changeOrigin: true },
      '/static': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}))
