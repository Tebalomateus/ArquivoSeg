import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
    plugins: [react()],
    server: {
        host: '127.0.0.1',
        proxy: {
            '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true },
            '/health': { target: 'http://127.0.0.1:8080', changeOrigin: true },
            // Anchor share-link prefix with regex so it doesn't swallow /src/* etc.
            '^/s/.+': { target: 'http://127.0.0.1:8080', changeOrigin: true },
        },
    },
})
