import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 相对 base：同一份 dist 既供 http 预览，也供 Electron file:// 加载
  base: './',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});