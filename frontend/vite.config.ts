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
        target: 'http://10.3.19.18:2030', // 目标服务器地址
        changeOrigin: true, // 允许跨域
        secure: false,
        ws: true,
        // rewrite: (path) => path.replace(/^\/api/, '')  // 替换路径
      },
      // 代理图片路径
      '/map': {
        target: 'http://10.3.19.18:2030', // 目标服务器地址
        changeOrigin: true, // 允许跨域
        secure: false,
      },
      '/replay': {
        target: 'http://10.3.19.18:2040', // 目标服务器地址
        changeOrigin: true, // 允许跨域
        secure: false,
        rewrite: (path) => path.replace(/^\/replay/, ''), // 替换路径,需要去替代当前头部代码
      },
    },
    cors: false,
  },
  preview: {
    proxy: {
      // 代理配置
      '/api': {
        target: 'http://10.3.19.18:2030', // 目标服务器地址
        changeOrigin: true, // 允许跨域
        secure: false,
        ws: true,
        // rewrite: (path) => path.replace(/^\/api/, '')  // 替换路径
      },
      // 代理图片路径
      '/map': {
        target: 'http://10.3.19.18:2030', // 目标服务器地址
        changeOrigin: true, // 允许跨域
        secure: false,
      },
    },
    cors: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-pixi': ['pixi.js'],
          'vendor-element': ['element-plus'],
        },
      },
    },
    // 提高chunk大小警告阈值到1MB
    chunkSizeWarningLimit: 2000,
  },
})
