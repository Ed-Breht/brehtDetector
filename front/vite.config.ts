import {VitePWA} from 'vite-plugin-pwa';
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    preview: {
        port: 4173,
        allowedHosts: true, // Разрешить все хосты
        strictPort: true,
        host: '0.0.0.0',
    },
    server: {
        port: 4173,
        host: '0.0.0.0',
        allowedHosts: true // Разрешить все хосты
    },
    plugins: [react(), VitePWA({
        registerType: 'prompt',
        injectRegister: false,

        pwaAssets: {
            disabled: false,
            config: true,
        },

        manifest: {
            name: 'brehtDetector',
            short_name: 'brehtDetector',
            description: 'App for YOLO recoginze',
            theme_color: '#ffffff',
        },

        workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
            cleanupOutdatedCaches: true,
            clientsClaim: true,
        },

        devOptions: {
            enabled: false,
            navigateFallback: 'index.html',
            suppressWarnings: true,
            type: 'module',
        },
    })],
})