import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Load environment variables from .env file if it exists
try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    (process as any).loadEnvFile(envPath);
  }
} catch (e) {
  // Ignore
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: process.env.FRONTEND_PORT ? parseInt(process.env.FRONTEND_PORT, 10) : (process.env.PORT ? parseInt(process.env.PORT, 10) : 28003),
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 29003}`,
        changeOrigin: true
      }
    }
  }
})
