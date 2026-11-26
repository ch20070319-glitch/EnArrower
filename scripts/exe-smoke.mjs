/**
 * 1.1.0 portable exe 冒烟实测：启动 exe（--remote-debugging-port=9222），
 * Playwright connectOverCDP 实测首页入口、接力关受阻/成功、灯关可选进度，
 * 截图 + 零外联 + 重启恢复。运行：node scripts/exe-smoke.mjs
 */
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const EXE = 'release/EnArrower-1.1.0-portable.exe';
const PORT = 9222;
const lines = [];
const log = (s) => {
  lines.push(s);
  console.log(s);
};
const shot = async (page, name) => {
  mkdirSync('evidence/screenshots', { recursive: true });
  await page.screenshot({ path: `evidence/screenshots/${name}.png` });
  log(`截图 evidence/screenshots/${name}.png`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.url.startsWith('app://'));
      if (page) return page;
    } catch {}
    await sleep(500);
  }
  throw new Error('CDP target not available in 30s');
}

const child = spawn(EXE, [`--remote-debugging-port=${PORT}`], { detached: true, stdio: 'ignore' });
child.unref();
log(`启动 ${EXE}（pid ${child.pid}，--remote-debugging-port=${PORT}）`);

let browser;
try {
  const target = await waitForTarget();
  log(`CDP page 目标：url=${target.url} title=${target.title}`);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];

  // 1) 首页入口：清空存档 → 全新玩家
  await page.evaluate(() => localStorage.removeItem('enarrower.save'));
  await page.reload();
  await page.waitForSelector('#btn-start');
  const startText = await page.textContent('#btn-start');
  log(`全新玩家首页主按钮：「${startText}」（期望 开始游戏）`);
  if (startText !== '开始游戏') throw new Error('home button mismatch: ' + startText);
  await shot(page, '22-exe-110-home');
  await page.click('#btn-start');
  await page.waitForSelector('#game-title');
  const tutTitle = await page.textContent('#game-title');
  log(`点击开始游戏 → 「${tutTitle}」（期望 新手教学）`);
  if (tutTitle !== '新手教学') throw new Error('tutorial not entered');
  const skipVisible = await page.isVisible('#btn-tutorial-skip');
  log(`跳过教学按钮可见：${skipVisible}`);
  await shot(page, '23-exe-110-tutorial');
  await page.click('#btn-tutorial-skip');
  await page.waitForTimeout(300);
  const l01Title = await page.textContent('#game-title');
  log(`跳过教学 → 「${l01Title}」（期望 第 1 关 · 初次见面）`);
  if (!l01Title.includes('第 1 关')) throw new Error('skip did not reach l01');

  // 2) 接力关 l23：受阻反馈 + 成功一次撤销
  await page.evaluate(() => {
    const ids = Array.from({ length: 27 }, (_, i) => 'l' + String(i + 1).padStart(2, '0'));
    localStorage.setItem(
      'enarrower.save',
      JSON.stringify({ schemaVersion: 1, completed: [], unlocked: ids, current: null, tutorialDone: true }),
    );
  });
  await page.reload();
  await page.click('#btn-levels');
  await page.click('.level-tile[data-level-id="l23"]');
  await page.waitForSelector('.board-svg');
  const goal = await page.textContent('#game-goal');
  log(`l23 目标栏：「${goal}」`);
  if (!goal.includes('虚线连接的两支箭头一起离场')) throw new Error('l23 goal mismatch');
  await page.evaluate(() => {
    document
      .querySelector('.arrow-mover[data-arrow-id="A"] .arrow')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  const blockedStatus = await page.textContent('#status');
  const linkActive = await page.locator('.relay-link.is-active').count();
  log(`点领头 A（B 被闸门挡）：状态「${blockedStatus}」；虚线高亮数=${linkActive}`);
  if (!blockedStatus.includes('接力没启动')) throw new Error('relay blocked feedback missing');
  await page.waitForTimeout(600);
  const gateBlocker = await page.locator('.gate.is-blocker').count();
  log(`挡路闸门高亮数=${gateBlocker}（期望 ≥1）`);
  await shot(page, '24-exe-110-relay-blocked');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('enarrower.save')));
  if (before.current.history.length !== 0) throw new Error('blocked relay changed history');
  await page.evaluate(() => {
    document
      .querySelector('.arrow-mover[data-arrow-id="C"] .arrow')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document
      .querySelector('.arrow-mover[data-arrow-id="A"] .arrow')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1600);
  const relayed = await page.evaluate(() => JSON.parse(localStorage.getItem('enarrower.save')));
  const gone = ['A', 'B', 'C'].every((id) => !relayed.current.state.remaining.includes(id));
  log(`开门后接力：A/B/C 全部离场=${gone}；历史步数=${relayed.current.history.length}（期望 2：C + 一次接力）`);
  if (!gone || relayed.current.history.length !== 2) throw new Error('relay commit mismatch');
  await shot(page, '25-exe-110-relay-done');
  await page.click('#btn-undo');
  await page.waitForTimeout(300);
  const undone = await page.evaluate(() => JSON.parse(localStorage.getItem('enarrower.save')));
  const backAB = ['A', 'B'].every((id) => undone.current.state.remaining.includes(id));
  log(`一次撤销恢复 A/B=${backAB}（C 仍离场）`);
  if (!backAB) throw new Error('relay undo mismatch');

  // 3) 灯关 l26：可选进度即时更新
  await page.click('#btn-game-back');
  await page.click('.level-tile[data-level-id="l26"]');
  await page.waitForSelector('.board-svg');
  const opt0 = await page.textContent('#game-optional');
  log(`l26 可选进度入场：「${opt0}」（期望 可选 · 点亮小屋 0/1）`);
  if (opt0 !== '可选 · 点亮小屋 0/1') throw new Error('lamp optional line mismatch');
  const goal26 = await page.textContent('#game-goal');
  log(`l26 主目标：「${goal26}」（不含"灯"字强制要求）`);
  if (goal26.includes('灯')) throw new Error('l26 goal should not mention lamps');
  await page.evaluate(() => {
    document
      .querySelector('.arrow-mover[data-arrow-id="c"] .arrow')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(800);
  await page.click('.arrow-mover[data-arrow-id="r"] .arrow-turn');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document
      .querySelector('.arrow-mover[data-arrow-id="r"] .arrow')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  await page.click('#btn-fire');
  await page.waitForTimeout(800);
  const opt1 = await page.textContent('#game-optional');
  const litCount = await page.locator('.lamp--lit').count();
  log(`调头向左发射后：「${opt1}」；点亮灯数=${litCount}（期望 1/1 与 1）`);
  if (opt1 !== '可选 · 点亮小屋 1/1' || litCount !== 1) throw new Error('lamp lit mismatch');
  await shot(page, '26-exe-110-lamp');
  await page.click('#btn-undo');
  await page.waitForTimeout(300);
  const optBack = await page.textContent('#game-optional');
  log(`撤销后进度回退：「${optBack}」（期望 0/1）`);
  if (optBack !== '可选 · 点亮小屋 0/1') throw new Error('lamp undo mismatch');

  // 4) 零外联
  const resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((r) => r.name).filter((n) => /^https?:/.test(n)),
  );
  log(`http(s) 资源记录数=${resources.length}（期望 0）`);
  if (resources.length !== 0) throw new Error('external resource detected');

  // 5) 重启恢复：模拟用户关闭窗口（window.close → window-all-closed → app.quit，存储随退出刷盘）后重启。
  // 注：taskkill /F 强杀落在 Chromium localStorage 批量提交窗口内会丢最近写入（首批约 5s、
  // 后续批次实测可达约 60s），属引擎行为；此处按真实用户「关闭再打开」场景验证。
  const saveBefore = await page.evaluate(() => localStorage.getItem('enarrower.save'));
  await page.evaluate(() => window.close());
  await sleep(2500);
  const stillRunning = execSync('tasklist /FI "IMAGENAME eq EnArrower.exe" /NH', { encoding: 'utf8' });
  if (stillRunning.includes('EnArrower.exe')) throw new Error('app did not quit after window.close()');
  log('window.close() 后进程已退出（正常退出路径）');
  const child2 = spawn(EXE, [`--remote-debugging-port=${PORT}`], { detached: true, stdio: 'ignore' });
  child2.unref();
  await waitForTarget();
  const browser2 = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const page2 = browser2.contexts()[0].pages()[0];
  await page2.waitForSelector('#btn-start');
  const resumeText = await page2.textContent('#btn-start');
  const saveAfter = await page2.evaluate(() => localStorage.getItem('enarrower.save'));
  log(`重启后主按钮：「${resumeText}」；存档与重启前一致=${saveBefore === saveAfter}`);
  if (saveBefore !== saveAfter) {
    log('重启前存档：' + saveBefore);
    log('重启后存档：' + saveAfter);
    throw new Error('save not persisted across restart');
  }
  await page2.click('#btn-start');
  await page2.waitForSelector('#game-title');
  const resumeTitle = await page2.textContent('#game-title');
  log(`重启恢复进入：「${resumeTitle}」`);
  await shot(page2, '27-exe-110-resume');
  await browser2.close();
  execSync('taskkill /IM EnArrower.exe /F', { stdio: 'ignore' });
  log('冒烟全部通过；exe 进程已关闭。');
} catch (err) {
  log('冒烟失败：' + (err && err.stack ? err.stack : String(err)));
  try {
    execSync('taskkill /IM EnArrower.exe /F', { stdio: 'ignore' });
  } catch {}
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  mkdirSync('evidence/test-results', { recursive: true });
  writeFileSync(
    'evidence/test-results/exe-smoke-1.1.0.txt',
    `第六轮 1.1.0 portable exe 冒烟实测\n日期：2026-11-26　机器：本机 win32 x64\n\n` + lines.join('\n') + '\n',
  );
}