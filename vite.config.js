import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 部署时需设置 base 为仓库名
// 本地开发时为 '/'
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? './' : '/',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
}));
