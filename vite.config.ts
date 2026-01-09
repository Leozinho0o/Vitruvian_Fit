
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Essencial para que os assets carreguem corretamente no Android/iOS (file://)
  build: {
    outDir: 'dist',
  },
});
