import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

// GitHub Pages 部署时需设置 base 为仓库名
// 本地开发时为 '/'
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'copy-404-for-spa',
      closeBundle() {
        // 仅在构建时执行
        const distIndex = join(process.cwd(), 'dist', 'index.html');
        const dist404 = join(process.cwd(), 'dist', '404.html');
        if (existsSync(distIndex)) {
          copyFileSync(distIndex, dist404);
          console.log('✅ 已复制 index.html → 404.html（SPA 路由支持）');
        }
      },
    },
  ],
  base: mode === 'production' ? '/friend-v4/' : '/',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
}));
