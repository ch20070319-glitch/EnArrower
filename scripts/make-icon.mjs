/**
 * 由 public/favicon.svg 渲染 256×256 透明 PNG，供 electron-builder 生成 exe 图标。
 * 运行：npm run make:icon（需已 install chromium）。
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg', 'utf8');
mkdirSync('build', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
await page.setContent(
  `<body style="margin:0;background:transparent">${svg.replace('<svg ', '<svg width="256" height="256" ')}</body>`,
);
await page.screenshot({ path: 'build/icon.png', omitBackground: true });
await browser.close();
console.log('build/icon.png written');