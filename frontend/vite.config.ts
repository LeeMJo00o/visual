import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // 代理配置
      '/api': {
        target: 'http://127.0.0.1:2030', // 目标服务器地址
        changeOrigin: true, // 允许跨域
        secure: false,
        ws: true,
        // rewrite: (path) => path.replace(/^\/api/, '')  // 替换路径
      },
    },
    cors: false,
  },
  preview: {
    proxy: {
      // 代理配置
      '/api': {
        target: 'http://127.0.0.1:2030', // 目标服务器地址
        changeOrigin: true, // 允许跨域
        secure: false,
        ws: true,
        // rewrite: (path) => path.replace(/^\/api/, '')  // 替换路径
      },
    },
    cors: false,
  },
})
