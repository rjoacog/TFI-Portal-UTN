import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // El puerto es el PORT por defecto de backend/.env.example.
      // Si cambia el PORT de la API, hay que ajustarlo acá.
      '/api': 'http://localhost:3000',
    },
  },
});
