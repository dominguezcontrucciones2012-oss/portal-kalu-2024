import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { mockDbPlugin } from './vite-mock-db';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), mockDbPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: true,
      open: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: ['**/db_mock/**']
      }
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            // Núcleo de React
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            // Firebase separado para caching largo
            'vendor-firebase': [
              'firebase/app',
              'firebase/auth',
              'firebase/firestore',
              'firebase/storage'
            ],
            // Gráficas (pesadas, raramente cambian)
            'vendor-charts': ['recharts'],
            // Íconos
            'vendor-lucide': ['lucide-react'],
            // Animaciones
            'vendor-motion': ['motion/react'],
          }
        }
      }
    }
  };
});
