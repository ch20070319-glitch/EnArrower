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
  unlocked: Array.from({ length: 27 }, (_, i) => `l${String(i + 1).padStart(2, '0')}`),
  current: null,
});

const browser = await chromium.launch();

async function clickArrow(page, id, wait = 700) {
  await page.evaluate((arrowId) => {
    document
      .querySelector(`.arrow-mover[data-arrow-id="${arrowId}"] .arrow`)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, id);
  await page.waitForTimeout(wait);
}

async function openLevel(page, n) {
  await page.click('#btn-levels');
  await page.click(`.level-tile:nth-child(${n})`);
  await page.waitForTimeout(500);
}

async function unlockedPage(width, height, mobile = false) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: KEY, v: allUnlocked });
  await page.reload();
  return { ctx, page };
}

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

// 折线教学关 l19（桌面）
{
  const { ctx, page } = await unlockedPage(1280, 900);
  await openLevel(page, 19);
  await page.screenshot({ path: `${OUT}/10-game-l19-poly-desktop.png` });
  await ctx.close();
  console.log('captured 10-game-l19-poly-desktop');
}

// 大棋盘 l20（360 手机，格子≥44px，整页截图）
{
  const { ctx, page } = await unlockedPage(360, 780, true);
  await openLevel(page, 20);
  await page.screenshot({ path: `${OUT}/11-game-l20-mobile-360.png`, fullPage: true });
  await ctx.close();
  console.log('captured 11-game-l20-mobile-360');
}

// 可调头选中态 l21（桌面，选中条可见）
{
  const { ctx, page } = await unlockedPage(1280, 900);
  await openLevel(page, 21);
  await clickArrow(page, 'r', 300);
  await page.screenshot({ path: `${OUT}/12-game-l21-turn-selected.png` });
  await ctx.close();
  console.log('captured 12-game-l21-turn-selected');
}

// 接力虚线连接 l23（桌面）
{
  const { ctx, page } = await unlockedPage(1280, 900);
  await openLevel(page, 23);
  await page.screenshot({ path: `${OUT}/13-game-l23-relay-link.png` });
  // 接力中途：A 已离场、B 仍在场（顺序动画证据）
  await clickArrow(page, 'C');
  await page.evaluate(() => {
    document
      .querySelector('.arrow-mover[data-arrow-id="A"] .arrow')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForFunction(
    () =>
      !document.querySelector('.arrow-mover[data-arrow-id="A"]') &&
      document.querySelector('.arrow-mover[data-arrow-id="B"]'),
  );
  await page.screenshot({ path: `${OUT}/14-relay-mid-animation.png` });
  await ctx.close();
  console.log('captured 13/14 relay');
}

// 护送 ★ l25（桌面）
{
  const { ctx, page } = await unlockedPage(1280, 900);
  await openLevel(page, 25);
  await page.screenshot({ path: `${OUT}/15-game-l25-escort.png` });
  await ctx.close();
  console.log('captured 15-game-l25-escort');
}

// 点灯 l26：调头向左经过灯后点亮（桌面）
{
  const { ctx, page } = await unlockedPage(1280, 900);
  await openLevel(page, 26);
  await clickArrow(page, 'c');
  await clickArrow(page, 'r', 300);
  await page.click('#btn-turn');
  await page.click('#btn-fire');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/16-game-l26-lamp-lit.png` });
  await ctx.close();
  console.log('captured 16-game-l26-lamp-lit');
}

// 终局灯屋 l27 全亮通关弹窗（桌面）
{
  const { ctx, page } = await unlockedPage(1280, 900);
  await openLevel(page, 27);
  await clickArrow(page, 's');
  await clickArrow(page, 'A', 1300);
  await clickArrow(page, 'r', 300);
  await page.click('#btn-fire');
  await page.waitForTimeout(800);
  await clickArrow(page, 'd');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/17-win-l27-all-lamps.png` });
  await ctx.close();
  console.log('captured 17-win-l27-all-lamps');
}

await browser.close();
console.log('done');