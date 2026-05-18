import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
//
// Plugins:
//   - @vitejs/plugin-react   → React Fast Refresh + JSX
//   - @tailwindcss/vite      → Tailwind v4 (pipeline propio, no PostCSS)
//
// Proxy: redirigimos al backend FastAPI corriendo en localhost:8000.
// Esto evita CORS en dev y deja que SSE (text/event-stream) pase sin
// buffering raro. Los servicios del frontend usan rutas relativas
// (ej. apiClient.get('/camaras')) y Vite las reescribe al backend.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      // Endpoints REST del backend FastAPI
      '/health':         'http://localhost:8000',
      '/config':         'http://localhost:8000',
      '/camaras':        'http://localhost:8000',
      '/estados':        'http://localhost:8000',
      // /alertas cubre tanto /alertas/* (REST) como /alertas/stream (SSE)
      '/alertas':        { target: 'http://localhost:8000', changeOrigin: true },
      // /detecciones/stream → SSE de bboxes YOLO frame-por-frame
      '/detecciones':    { target: 'http://localhost:8000', changeOrigin: true },
      '/eventos':        'http://localhost:8000',
      '/analisis':       'http://localhost:8000',
      '/notificaciones': 'http://localhost:8000',
      // /sistema/metricas → panel "Sistema" con KPIs agregados (camaras
      // online, latencias YOLO/LLaVA promedio, servicios).
      '/sistema':        'http://localhost:8000',
      // /snapshots → galería de capturas en Playback
      '/snapshots':      'http://localhost:8000',
      // /grabaciones → upload + listado + streaming de grabaciones manuales
      '/grabaciones':    { target: 'http://localhost:8000', changeOrigin: true },
      // /auth → login / profile / logout
      '/auth':           'http://localhost:8000',
      // /usuarios → CRUD de usuarios (admin only)
      '/usuarios':       'http://localhost:8000',
    },
  },
})
