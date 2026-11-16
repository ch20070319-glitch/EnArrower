/**
 * 开发期证据采集：用 Playwright 在真实浏览器中截取关键界面。
 * 运行前确保预览服务器在 4173 端口（npm run preview）。
 * 输出到 evidence/screenshots/，供 docs/evidence-index.md 引用。
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'evidence/screenshots';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4173';
const KEY = 'enarrower.save';
const allUnlocked = JSON.stringify({
  schemaVersion: 1,
  completed: ['l01', 'l02', 'l03'],
  unlocked: Array.from({ length: 18 }, (_, i) => `l${String(i + 1).padStart(2, '0')}`),
  current: null,
});

const browser = await chromium.launch();

async function shot(name, { width, height, mobile = false, setup }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate(({ k, v }) => { localStorage.removeItem(k); if (v) localStorage.setItem(k, v); }, { k: KEY, v: setup ?? null });
  await page.reload();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await ctx.close();
  console.log('captured', name);
}

await shot('01-home-desktop', { width: 1280, height: 860 });
await shot('02-home-mobile-360', { width: 360, height: 780, mobile: true });

// 游戏第一关（桌面）
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.reload();
  await page.click('#btn-start');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03-game-l01-desktop.png` });
  await ctx.close();
  console.log('captured 03-game-l01-desktop');
}

// 第12关（两组机关，桌面）
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1080 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: KEY, v: allUnlocked });
  await page.reload();
  await page.click('#btn-levels');
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `${OUT}/04-levels-desktop.png` });
  await page.click('.level-tile:nth-child(12)');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/05-game-l12-desktop.png` });
  // 查看机关模式预览
  await page.click('#btn-inspect');
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('.arrow')].find((a) => a.getAttribute('aria-label')?.includes('◇ 开关'));
    s?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/06-inspect-preview.png` });
  await ctx.close();
  console.log('captured 04/05/06');
}

// 第18关（进阶两组机关，桌面）
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: KEY, v: allUnlocked });
  await page.reload();
  await page.click('#btn-levels');
  await page.click('.level-tile:nth-child(18)');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/09-game-l18-desktop.png` });
  await ctx.close();
  console.log('captured 09-game-l18-desktop');
}

// 通关弹窗（桌面）
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.reload();
  await page.click('#btn-start');
  for (const frag of ['向右，长度 1', '向下，长度 1', '向右，长度 2']) {
    await page.evaluate((f) => {
      const a = [...document.querySelectorAll('.arrow')].find((x) => x.getAttribute('aria-label')?.includes(f));
      a?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, frag);
    await page.waitForTimeout(650);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/07-win-desktop.png` });
  await ctx.close();
  console.log('captured 07-win-desktop');
}

// 手机游戏界面 360
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: KEY, v: allUnlocked });
  await page.reload();
  await page.click('#btn-levels');
  await page.click('.level-tile:nth-child(11)');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/08-game-l11-mobile-360.png` });
  await ctx.close();
  console.log('captured 08-game-l11-mobile-360');
}

await browser.close();
console.log('done');