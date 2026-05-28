import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "node",
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
  server: {
    proxy: {
      "/api": {
        target: "https://khedma1-api-dsc0fbbxd9drhkhd.uaenorth-01.azurewebsites.net",
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
