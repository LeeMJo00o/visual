import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'


// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:2030'

  return {
    plugins: [vue(), vueDevTools()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // 开发时，请在本地新建文件 .env.local , 并指定连接的后端， 如：
      // VITE_PROXY_TARGET=http://10.3.19.24:2030
      // 为方便仓库管理，不要直接修改此文件的代理配置

      proxy: {
        // 代理配置
        '/api': {
          target: proxyTarget,
          changeOrigin: true, // 允许跨域
          secure: false,
          ws: true,
          // rewrite: (path) => path.replace(/^\/api/, '')  // 替换路径
        },
        // 代理图片路径
        '/map': {
          target: proxyTarget,
          changeOrigin: true, // 允许跨域
          secure: false,
        },
        '/replay': {
          target: proxyTarget,
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
  }
})
