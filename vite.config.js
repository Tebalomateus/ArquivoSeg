import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': { target: 'http://localhost:8080', changeOrigin: true },
            '/health': { target: 'http://localhost:8080', changeOrigin: true },
            '/s': { target: 'http://localhost:8080', changeOrigin: true },
        },
    },
})
