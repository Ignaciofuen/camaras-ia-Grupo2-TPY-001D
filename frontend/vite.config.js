import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/health': 'http://localhost:8000',
      '/config': 'http://localhost:8000',
      '/camaras': 'http://localhost:8000',
      '/estados': 'http://localhost:8000',
      '/alertas': { target: 'http://localhost:8000', changeOrigin: true },
      '/detecciones': { target: 'http://localhost:8000', changeOrigin: true },
      '/eventos': 'http://localhost:8000',
      '/analisis': 'http://localhost:8000',
      '/notificaciones': 'http://localhost:8000',
      '/sistema': 'http://localhost:8000',
      '/snapshots': 'http://localhost:8000',
      '/grabaciones': { target: 'http://localhost:8000', changeOrigin: true },
      '/usuarios': 'http://localhost:8000',
    },
  },
});
