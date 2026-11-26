import { expect, test, Page } from '@playwright/test';
import { DISPLAY_ORDER, LEVELS, TUTORIAL_LEVEL, levelById } from '../../src/levels/levels';
import { solve, type SolverOp } from '../../src/core/solver';
import { initialState } from '../../src/core/rules';
import type { LevelDef } from '../../src/core/types';

const SAVE_KEY = 'enarrower.save';

function levelOf(id: string): LevelDef {
  return id === TUTORIAL_LEVEL.id ? TUTORIAL_LEVEL : levelById(id)!;
}

/** 默认模拟"已看过教学的老玩家"，主按钮直达正式第 1 关；全新玩家用 freshNewPlayer。 */
async function fresh(page: Page, unlockAll = false) {
  await page.goto('/');
  await page.evaluate(
    ({ key, unlockAll, ids }) => {
      localStorage.removeItem(key);
      localStorage.setItem(
        key,
        JSON.stringify({
          schemaVersion: 1,
          completed: [],
          unlocked: unlockAll ? ids : ['l01'],
          current: null,
          tutorialDone: true,
        }),
      );
    },
    { key: SAVE_KEY, unlockAll, ids: LEVELS.map((l) => l.id) },
  );
  await page.reload();
}

async function freshNewPlayer(page: Page) {
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
  await page.reload();
}

async function seedSave(page: Page, data: Record<string, unknown>) {
  await page.goto('/');
  await page.evaluate(
    ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: SAVE_KEY, data },
  );
  await page.reload();
}

async function openLevel(page: Page, levelId: string) {
  await page.click('#btn-levels');
  await page.click(`.level-tile[data-level-id="${levelId}"]`);
  await expect(page.locator('#screen-game')).toBeVisible();
}

function readSave(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), SAVE_KEY);
}

/** 在页面内点击箭头并用 rAF 采样 mover 位移，证明连续运动而非瞬移。 */
async function sampleExit(page: Page, ariaFragment: string) {
  return page.evaluate(async (frag) => {
    const arrow = [...document.querySelectorAll<SVGGElement>('.arrow')].find((a) =>
      a.getAttribute('aria-label')?.includes(frag),
    );
    if (!arrow) throw new Error('arrow not found: ' + frag);
    const mover = arrow.closest('.arrow-mover') as SVGGElement;
    const samples: number[] = [];
    let removed = false;
    const parse = () => {
      const t = mover.getAttribute('transform') || '';
      const m = t.match(/translate\(([-\d.]+)[ ,]([-\d.]+)\)/);
      return m ? Math.hypot(parseFloat(m[1]), parseFloat(m[2])) : 0;
    };
    arrow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (!mover.isConnected) {
          removed = true;
          resolve();
          return;
        }
        samples.push(parse());
        if (performance.now() - start > 1500) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return { samples, removed, max: Math.max(...samples), distinct: new Set(samples.map((s) => Math.round(s))).size };
  }, ariaFragment);
}

/** 按关卡内箭头 id 点击并等待动画提交完成。 */
async function clickTurnBadge(page: Page, id: string) {
  await page.click(`.arrow-mover[data-arrow-id="${id}"] .arrow-turn`);
  await page.waitForTimeout(150);
}

/** 第三轮：铺满棋盘后通关步数变多，用例改为重放求解器解法（断言强度不变）。 */
async function replayOps(page: Page, levelId: string, ops: SolverOp[]) {
  const level = levelOf(levelId);
  for (const op of ops) {
    if (op.kind === 'turn') {
      await clickTurnBadge(page, op.arrowId);
    } else if (op.kind === 'relay') {
      await clickArrow(page, op.arrowId);
      await page.waitForTimeout(1200);
    } else {
      const def = level.arrows.find((a) => a.id === op.arrowId)!;
      await clickArrow(page, op.arrowId);
      if (def.reversible) await page.click('#btn-fire');
      await page.waitForTimeout(700);
    }
  }
}

async function playSolution(page: Page, levelId: string) {
  const level = levelOf(levelId);
  const result = solve(level, initialState(level));
  if (!result.solvable || !result.solution) throw new Error('level unsolvable: ' + level.id);
  await replayOps(page, levelId, result.solution);
}

/** 从当前存档状态清空剩余箭头（教学锚点步之后补完填充箭）。 */
async function finishLevel(page: Page, levelId: string) {
  const level = levelOf(levelId);
  const save = await readSave(page);
  const result = solve(level, save.current.state);
  if (!result.solvable || !result.solution) throw new Error('level unsolvable from current: ' + level.id);
  await replayOps(page, levelId, result.solution);
}

/** 反复执行求解器首步，直到场上只剩指定箭头（保留教学锚点局面）。 */
async function clearUntil(page: Page, levelId: string, keep: string[]) {
  const level = levelOf(levelId);
  for (;;) {
    const save = await readSave(page);
    if (save.current.state.remaining.every((id: string) => keep.includes(id))) return;
    const result = solve(level, save.current.state);
    if (!result.solvable || !result.solution) throw new Error('level unsolvable: ' + level.id);
    await replayOps(page, levelId, [result.solution[0]]);
  }
}

async function clickArrow(page: Page, id: string) {
  await page.evaluate((arrowId) => {
    const node = document.querySelector<SVGGElement>(`.arrow-mover[data-arrow-id="${arrowId}"] .arrow`);
    if (!node) throw new Error('arrow not found: ' + arrowId);
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, id);
  await page.waitForTimeout(700);
}

/** 折线离场采样：逐帧记录箭身路径 d，证明弯折逐渐展开而非整支瞬移。 */
async function samplePolyExit(page: Page, id: string) {
  return page.evaluate(async (arrowId) => {
    const mover = document.querySelector<SVGGElement>(`.arrow-mover[data-arrow-id="${arrowId}"]`);
    if (!mover) throw new Error('arrow not found: ' + arrowId);
    const body = mover.querySelector<SVGPathElement>('.arrow-body-poly')!;
    const ds: string[] = [];
    let removed = false;
    mover.querySelector('.arrow')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (!mover.isConnected) {
          removed = true;
          resolve();
          return;
        }
        ds.push(body.getAttribute('d') || '');
        if (performance.now() - start > 1500) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const pointCount = (d: string) => d.split('L').length;
    return {
      removed,
      distinct: new Set(ds).size,
      firstPoints: pointCount(ds[0] || ''),
      midBent: ds.some((d) => {
        const pts = d.split(/[ML] /).slice(1).map((p) => p.split(' ').map(Number));
        if (pts.length < 3) return false;
        const [a, b, c] = pts;
        return (b[0] - a[0]) * (c[1] - b[1]) !== (b[1] - a[1]) * (c[0] - b[0]);
      }),
    };
  }, id);
}

/** 接力动画采样：证明 A 先离场、B 后离场的顺序动画，而非同时瞬移。 */
async function sampleRelay(page: Page, leader: string, follower: string) {
  return page.evaluate(
    async ({ leaderId, followerId }) => {
      const moverOf = (id: string) =>
        document.querySelector<SVGGElement>(`.arrow-mover[data-arrow-id="${id}"]`);
      const leaderMover = moverOf(leaderId);
      if (!leaderMover) throw new Error('leader not found: ' + leaderId);
      let sawLeaderGoneFollowerPresent = false;
      let bothGone = false;
      leaderMover.querySelector('.arrow')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          const lg = !moverOf(leaderId)?.isConnected;
          const fg = !moverOf(followerId)?.isConnected;
          if (lg && !fg) sawLeaderGoneFollowerPresent = true;
          if (lg && fg) {
            bothGone = true;
            resolve();
            return;
          }
          if (performance.now() - start > 2500) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      return { sawLeaderGoneFollowerPresent, bothGone };
    },
    { leaderId: leader, followerId: follower },
  );
}

test.describe('入口与构建', () => {
  test('AC01 打开首页，无控制台错误', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await fresh(page);
    await expect(page.locator('.home-title')).toHaveText('EnArrower');
    await expect(page.locator('#btn-start')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('离场动画', () => {
  test('AC02 向右箭头连续位移，尾部出界后才移除', async ({ page }) => {
    await fresh(page);
    await page.click('#btn-start');
    const { samples, removed, max, distinct } = await sampleExit(page, '向右，长度 3');
    expect(removed).toBe(true);
    expect(max).toBeGreaterThan(300);
    expect(distinct).toBeGreaterThan(5);
    const mid = samples.filter((s) => s > 20 && s < max - 20);
    expect(mid.length).toBeGreaterThan(3);
  });

  test('AC02 向下多格箭头连续位移', async ({ page }) => {
    await fresh(page);
    await page.click('#btn-start');
    const { removed, distinct, max } = await sampleExit(page, '向下，长度 5');
    expect(removed).toBe(true);
    expect(distinct).toBeGreaterThan(5);
    expect(max).toBeGreaterThan(200);
  });

  test('AC06 动画期间快速连点只提交一次', async ({ page }) => {
    await fresh(page);
    await page.click('#btn-start');
    const result = await page.evaluate(async () => {
      const initial = JSON.parse(localStorage.getItem('enarrower.save')!).current.state.remaining;
      const arrow = document.querySelector<SVGGElement>('.arrow')!;
      for (let i = 0; i < 8; i++) {
        arrow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 20));
      }
      await new Promise((r) => setTimeout(r, 800));
      const save = JSON.parse(localStorage.getItem('enarrower.save')!);
      return {
        initial,
        remaining: save.current.state.remaining,
        historyLen: save.current.history.length,
        arrowsInDom: document.querySelectorAll('.arrow').length,
      };
    });
    expect(result.remaining).toEqual(result.initial.slice(1));
    expect(result.historyLen).toBe(1);
    expect(result.arrowsInDom).toBe(result.initial.length - 1);
  });

  test('AC06 动画期间撤销/重开/提示被禁用', async ({ page }) => {
    await fresh(page);
    await page.click('#btn-start');
    const locked = await page.evaluate(async () => {
      const arrow = document.querySelector<SVGGElement>('.arrow')!;
      arrow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 30));
      return {
        undo: (document.getElementById('btn-undo') as HTMLButtonElement).disabled,
        restart: (document.getElementById('btn-restart') as HTMLButtonElement).disabled,
        hint: (document.getElementById('btn-hint') as HTMLButtonElement).disabled,
        back: (document.getElementById('btn-game-back') as HTMLButtonElement).disabled,
      };
    });
    expect(locked).toEqual({ undo: true, restart: true, hint: true, back: true });
  });
});

test.describe('阻挡与机关', () => {
  test('AC03 被阻挡保持原位，不进历史', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l02');
    const before = await readSave(page);
    await page.evaluate(() => {
      const a = [...document.querySelectorAll<SVGGElement>('.arrow')].find((x) =>
        x.getAttribute('aria-label')?.includes('向右，长度 1，头部在第 1 列第 2 行'),
      )!;
      a.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    const after = await readSave(page);
    expect(after.current.state.remaining).toEqual(before.current.state.remaining);
    expect(after.current.history.length).toBe(0);
    await expect(page.locator('#status')).toContainText('被挡住');
  });

  test('AC04 开关离场切换本组一次，另一组不变', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l11');
    const before = await readSave(page);
    expect(before.current.state.open).toEqual({ diamond: false, circle: false });
    await page.evaluate(() => {
      const sc = [...document.querySelectorAll<SVGGElement>('.arrow')].find((x) =>
        x.getAttribute('aria-label')?.includes('○ 开关'),
      )!;
      sc.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(800);
    const after = await readSave(page);
    expect(after.current.state.open.circle).toBe(true);
    expect(after.current.state.open.diamond).toBe(false);
    expect(after.current.state.remaining).not.toContain('sc');
  });

  test('AC15 键盘聚焦开关箭头预览关联闸门', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l04');
    await page.evaluate(() => {
      const s = [...document.querySelectorAll<SVGGElement>('.arrow')].find((x) =>
        x.getAttribute('aria-label')?.includes('◇ 开关'),
      )!;
      s.focus();
    });
    await expect(page.locator('.gate.is-preview')).toHaveCount(1);
    await expect(page.locator('.gate.is-preview .gate-label')).toHaveText('将开启');
    const before = await readSave(page);
    expect(before.current.state.remaining).toEqual(initialState(LEVELS[3]).remaining);
  });

  test('AC15 查看机关模式点击只预览不移动', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l04');
    await page.click('#btn-inspect');
    await expect(page.locator('#btn-inspect')).toHaveAttribute('aria-pressed', 'true');
    const before = await readSave(page);
    await page.evaluate(() => {
      const s = [...document.querySelectorAll<SVGGElement>('.arrow')].find((x) =>
        x.getAttribute('aria-label')?.includes('◇ 开关'),
      )!;
      s.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    const after = await readSave(page);
    expect(after.current.state.remaining).toEqual(before.current.state.remaining);
    await expect(page.locator('#status')).toContainText('预览不会移动');
    await expect(page.locator('.gate.is-preview')).toHaveCount(1);
  });
});

test.describe('撤销 / 重开 / 提示', () => {
  test('AC08 撤销恢复箭头与闸门', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l04');
    await page.evaluate(() => {
      const s = [...document.querySelectorAll<SVGGElement>('.arrow')].find((x) =>
        x.getAttribute('aria-label')?.includes('◇ 开关'),
      )!;
      s.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(800);
    expect((await readSave(page)).current.state.open.diamond).toBe(true);
    await page.click('#btn-undo');
    const after = await readSave(page);
    expect(after.current.state.open.diamond).toBe(false);
    expect(after.current.state.remaining).toEqual(initialState(LEVELS[3]).remaining);
    await expect(page.locator('#btn-undo')).toBeDisabled();
  });

  test('AC09 重开恢复初始布局并清空历史', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l04');
    await page.evaluate(() => {
      document.querySelector<SVGGElement>('.arrow')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(800);
    await page.click('#btn-restart');
    const after = await readSave(page);
    expect(after.current.state.remaining).toEqual(initialState(LEVELS[3]).remaining);
    expect(after.current.state.open.diamond).toBe(false);
    expect(after.current.history.length).toBe(0);
  });

  test('AC11 先关门后提示识别无解（第7关先走开关）', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l07');
    await page.evaluate(() => {
      const s = [...document.querySelectorAll<SVGGElement>('.arrow')].find((x) =>
        x.getAttribute('aria-label')?.includes('◇ 开关'),
      )!;
      s.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(800);
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('无法通关');
  });

  test('AC10 可解状态提示高亮一支箭头且不自动移动（第二次点击才给具体操作）', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l07');
    const before = await readSave(page);
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('观察');
    await expect(page.locator('.arrow.is-hint')).toHaveCount(0);
    await page.click('#btn-hint');
    await expect(page.locator('.arrow.is-hint')).toHaveCount(1);
    const after = await readSave(page);
    expect(after.current.state.remaining).toEqual(before.current.state.remaining);
  });

  test('AC40 提示文案具体化：开关点名、接力点名、护送点名（均需第二次点击）', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l04');
    await page.click('#btn-hint');
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('开关 s');
    await expect(page.locator('#status')).toContainText('◇');

    await page.click('#btn-game-back');
    await page.click('.level-tile[data-level-id="l23"]');
    await page.click('#btn-hint');
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('开关 C');
    await clickArrow(page, 'C');
    await page.click('#btn-hint');
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('启动接力 A');

    await page.click('#btn-game-back');
    await page.click('.level-tile[data-level-id="l25"]');
    await clickArrow(page, 's');
    await clickArrow(page, 'b');
    await page.click('#btn-hint');
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('护送 ★ 箭头 e');
  });
});

test.describe('通关与存档', () => {
  test('AC07 最后一支离场后通关并解锁下一关', async ({ page }) => {
    await fresh(page);
    await page.click('#btn-start');
    await playSolution(page, 'l01');
    await expect(page.locator('#win-overlay')).toBeVisible();
    const save = await readSave(page);
    expect(save.completed).toContain('l01');
    expect(save.unlocked).toContain('l02');
  });

  test('AC13 刷新恢复进行中状态与历史', async ({ page }) => {
    await fresh(page);
    await page.click('#btn-start');
    const initial = (await readSave(page)).current.state.remaining as string[];
    await page.evaluate(() => {
      document.querySelector<SVGGElement>('.arrow')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(700);
    await page.reload();
    await page.click('#btn-start');
    const save = await readSave(page);
    expect(save.current.state.remaining).toEqual(initial.slice(1));
    expect(save.current.history.length).toBe(1);
    await expect(page.locator('#game-count')).toHaveText(`${initial.length - 1} 支`);
    await expect(page.locator('#btn-undo')).toBeEnabled();
  });

  test('AC14 坏存档安全回退不白屏', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem(key, '{bad json'), SAVE_KEY);
    await page.reload();
    await expect(page.locator('.home-title')).toHaveText('EnArrower');
    await expect(page.locator('#toast')).toContainText('损坏');
    await page.click('#btn-start');
    await expect(page.locator('#screen-game')).toBeVisible();
  });

  test('AC14 动画中刷新恢复上一个稳定状态', async ({ page }) => {
    await fresh(page);
    await page.click('#btn-start');
    const initial = (await readSave(page)).current.state.remaining as string[];
    await page.evaluate(() => {
      document.querySelector<SVGGElement>('.arrow')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(60);
    await page.reload();
    await page.click('#btn-start');
    const save = await readSave(page);
    expect(save.current.state.remaining).toEqual(initial);
    expect(save.current.history.length).toBe(0);
  });
});

test.describe('响应式与减少动态', () => {
  for (const width of [360, 390, 1280]) {
    test(`AC16 ${width}px 无横向溢出，控件可点`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await fresh(page);
      await page.click('#btn-start');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      const box = await page.locator('#btn-undo').boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      const board = await page.locator('.board-svg').boundingBox();
      expect(board!.width).toBeGreaterThan(200);
      expect(board!.x).toBeGreaterThanOrEqual(0);
    });
  }

  test('AC17 动画中改变窗口尺寸不锁死、结果一致', async ({ page }) => {
    await fresh(page);
    await page.click('#btn-start');
    const initial = (await readSave(page)).current.state.remaining as string[];
    await page.evaluate(() => {
      document.querySelector<SVGGElement>('.arrow')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(80);
    await page.setViewportSize({ width: 500, height: 700 });
    await page.waitForTimeout(120);
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.waitForTimeout(700);
    const save = await readSave(page);
    expect(save.current.state.remaining).toEqual(initial.slice(1));
    expect(save.current.history.length).toBe(1);
    await expect(page.locator('#btn-restart')).toBeEnabled();
  });

  test('AC17 减少动态效果下规则结果一致', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fresh(page);
    await page.click('#btn-start');
    const initial = (await readSave(page)).current.state.remaining as string[];
    await page.evaluate(() => {
      document.querySelector<SVGGElement>('.arrow')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(200);
    const save = await readSave(page);
    expect(save.current.state.remaining).toEqual(initial.slice(1));
    expect(save.current.history.length).toBe(1);
  });
});

test.describe('进阶机关关卡（13-18）', () => {
  test('AC21 第13关先清挡路再走开关 → 关门死局被提示识别', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l13');
    await clickArrow(page, 'f');
    await clickArrow(page, 's');
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('无法通关');
    const save = await readSave(page);
    expect(save.current.state.open.diamond).toBe(false);
    expect(save.current.state.remaining).toEqual(
      initialState(LEVELS[12]).remaining.filter((id) => !['f', 's'].includes(id)),
    );
  });

  test('AC22 第17关跨组链条完整通关并解锁第18关', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l17');
    await playSolution(page, 'l17');
    await expect(page.locator('#win-overlay')).toBeVisible();
    const save = await readSave(page);
    expect(save.completed).toContain('l17');
    expect(save.unlocked).toContain('l18');
  });

  test('AC23 闸门章末挑战（l18）通关后下一关指向大棋盘折线进阶', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l18');
    await playSolution(page, 'l18');
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#btn-next')).toBeVisible();
    await expect(page.locator('#btn-next')).toContainText('长湾疏流');
    const save = await readSave(page);
    expect(save.completed).toContain('l18');
    expect(save.current.state.remaining).toEqual([]);
  });
});

test.describe('大棋盘与折线箭头（19-20）', () => {
  test('AC24 折线离场绳随动画：路径逐帧展开、尾部出界后移除', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l19');
    const { removed, distinct, firstPoints, midBent } = await samplePolyExit(page, 'k');
    expect(removed).toBe(true);
    expect(distinct).toBeGreaterThan(5);
    expect(firstPoints).toBe(5);
    expect(midBent).toBe(true);
    const save = await readSave(page);
    expect(save.current.state.remaining).not.toContain('k');
    expect(save.current.history.length).toBe(1);
  });

  test('AC25 折线箭身挡路：d 被 k 阻挡且状态不变', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l19');
    const before = await readSave(page);
    await page.evaluate(() => {
      const node = document.querySelector<SVGGElement>('.arrow-mover[data-arrow-id="d"] .arrow')!;
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    const after = await readSave(page);
    expect(after.current.state.remaining).toEqual(before.current.state.remaining);
    expect(after.current.history.length).toBe(0);
    await expect(page.locator('#status')).toContainText('被挡住');
    await expect(page.locator('.arrow-mover[data-arrow-id="k"] .arrow.is-blocker')).toHaveCount(1);
  });

  test('AC26 大棋盘 360px 竖屏：格子≥44px、无横溢、可实际操作', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await fresh(page, true);
    await openLevel(page, 'l20');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    const board = await page.locator('.board-svg').boundingBox();
    expect(board!.width / 8).toBeGreaterThanOrEqual(44);
    await clickArrow(page, 'k1');
    await clickArrow(page, 's');
    const save = await readSave(page);
    expect(save.current.state.remaining).not.toContain('k1');
    expect(save.current.state.remaining).not.toContain('s');
    expect(save.current.state.open.diamond).toBe(true);
  });

  test('AC27 第20关大棋盘完整通关，下一关指向双向抉择', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l20');
    await playSolution(page, 'l20');
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#btn-next')).toContainText('双向抉择');
    const save = await readSave(page);
    expect(save.completed).toContain('l20');
    expect(save.current.state.remaining).toEqual([]);
  });
});

test.describe('可调头箭头（21-22）', () => {
  test('AC28 单击 ⇄ 只选中不移动；发射被挡状态不变；调头后向左离场', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l21');
    const before = await readSave(page);
    await clickArrow(page, 'r');
    await expect(page.locator('#sel-bar')).toBeVisible();
    await expect(page.locator('#sel-label')).toContainText('当前向右');
    const selected = await readSave(page);
    expect(selected.current.state.remaining).toEqual(before.current.state.remaining);
    expect(selected.current.history.length).toBe(0);

    await page.click('#btn-fire');
    await page.waitForTimeout(300);
    await expect(page.locator('#status')).toContainText('被挡住');
    const blocked = await readSave(page);
    expect(blocked.current.state.remaining).toEqual(before.current.state.remaining);
    expect(blocked.current.history.length).toBe(0);

    // 第三轮：⇄ 徽记直接调头，无需先选中；底部不再有调头按钮
    await expect(page.locator('#btn-turn')).toHaveCount(0);
    await clickTurnBadge(page, 'r');
    const turned = await readSave(page);
    expect(turned.current.state.turned).toEqual(['r']);
    expect(turned.current.history.length).toBe(1);
    expect(turned.current.state.open.diamond).toBe(false);
    await expect(page.locator('#sel-bar')).toBeHidden();
    await clickArrow(page, 'r');
    await expect(page.locator('#sel-label')).toContainText('当前向左');

    await page.click('#btn-fire');
    await page.waitForTimeout(700);
    const fired = await readSave(page);
    expect(fired.current.state.remaining).not.toContain('r');
    expect(fired.current.history.length).toBe(2);

    await page.click('#btn-undo');
    const undone = await readSave(page);
    expect(undone.current.state.remaining).toContain('r');
    expect(undone.current.state.turned).toEqual(['r']);
    await page.click('#btn-undo');
    const undone2 = await readSave(page);
    expect(undone2.current.state.turned).toEqual([]);
  });

  test('AC29 第21关完整通关：a → 调头 r → 发射 r → s', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l21');
    await clickArrow(page, 'a');
    await clickTurnBadge(page, 'r');
    await clickArrow(page, 'r');
    await page.click('#btn-fire');
    await page.waitForTimeout(700);
    await clickArrow(page, 's');
    await finishLevel(page, 'l21');
    await expect(page.locator('#win-overlay')).toBeVisible();
    const save = await readSave(page);
    expect(save.completed).toContain('l21');
  });

  test('AC30 调头后刷新页面：继续游戏恢复朝向', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l21');
    await clickTurnBadge(page, 'r');
    await page.reload();
    await page.click('#btn-start');
    await expect(page.locator('#screen-game')).toBeVisible();
    const save = await readSave(page);
    expect(save.current.state.turned).toEqual(['r']);
    await expect(page.locator('.arrow-mover[data-arrow-id="r"] .arrow')).toHaveAttribute(
      'aria-label',
      /当前向左/,
    );
  });

  test('AC31 第22关双向抉择：疏通左路后调头通关', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l22');
    await clickArrow(page, 't');
    await clickArrow(page, 'c');
    await clickArrow(page, 'r');
    await page.click('#btn-fire');
    await page.waitForTimeout(300);
    await expect(page.locator('#status')).toContainText('被挡住');
    await clickTurnBadge(page, 'r');
    await clickArrow(page, 'r');
    await page.click('#btn-fire');
    await page.waitForTimeout(700);
    await clickArrow(page, 's');
    await finishLevel(page, 'l22');
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#btn-next')).toContainText('接力过桥');
    const save = await readSave(page);
    expect(save.completed).toContain('l22');
  });

  test('AC32 提示识别调头操作：a 离场后第二次提示点名调头', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l21');
    await clearUntil(page, 'l21', ['r', 's', 'u6', 'u8']);
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('观察');
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('调头');
    await expect(page.locator('.arrow-mover[data-arrow-id="r"] .arrow.is-hint')).toHaveCount(1);
  });
});

test.describe('接力箭头（23-24）', () => {
  test('AC33 点 B 只高亮 A；开门前接力失败双方不动；开门后一次撤销全恢复', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l23');
    const before = await readSave(page);
    await expect(page.locator('.relay-link[data-leader="A"]')).toHaveCount(1);

    await clickArrow(page, 'B');
    await expect(page.locator('#status')).toContainText('领头');
    await expect(page.locator('.arrow-mover[data-arrow-id="A"] .arrow.is-hint')).toHaveCount(1);
    const afterB = await readSave(page);
    expect(afterB.current.state.remaining).toEqual(before.current.state.remaining);
    expect(afterB.current.history.length).toBe(0);

    await clickArrow(page, 'A');
    await expect(page.locator('#status')).toContainText('接力没启动');
    await expect(page.locator('#status')).toContainText('闸门');
    const blocked = await readSave(page);
    expect(blocked.current.state.remaining).toEqual(initialState(LEVELS[22]).remaining);
    expect(blocked.current.history.length).toBe(0);
    expect(blocked.current.state.open.diamond).toBe(false);

    await clickArrow(page, 'C');
    await clickArrow(page, 'A');
    await page.waitForTimeout(1200);
    const relayed = await readSave(page);
    expect(relayed.current.state.remaining).toEqual(
      initialState(LEVELS[22]).remaining.filter((id) => !['A', 'B', 'C'].includes(id)),
    );
    expect(relayed.current.history.length).toBe(2);
    await finishLevel(page, 'l23');
    await expect(page.locator('#win-overlay')).toBeVisible();

    await page.click('#btn-win-undo');
    // 加密后通关前还有填充箭步：撤销回接力刚完成的那一刻（历史 = C + 接力 两步），再撤销接力本身
    while ((await readSave(page)).current.history.length > 2) {
      await page.click('#btn-undo');
    }
    await page.click('#btn-undo');
    const undone = await readSave(page);
    expect(undone.current.state.remaining).toEqual(
      initialState(LEVELS[22]).remaining.filter((id) => id !== 'C'),
    );
    expect(undone.current.state.open.diamond).toBe(true);
    await expect(page.locator('.arrow-mover[data-arrow-id="A"]')).toHaveCount(1);
    await expect(page.locator('.arrow-mover[data-arrow-id="B"]')).toHaveCount(1);
  });

  test('AC34 第24关接力长链完整通关，下一关指向护送关', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l24');
    await clickArrow(page, 's');
    await clickArrow(page, 'A');
    await page.waitForTimeout(1200);
    await clickArrow(page, 't');
    await clickArrow(page, 'C');
    await page.waitForTimeout(1200);
    await finishLevel(page, 'l24');
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#btn-next')).toBeVisible();
    await expect(page.locator('#btn-next')).toContainText('护送星标');
    const save = await readSave(page);
    expect(save.completed).toContain('l24');
    expect(save.current.state.remaining).toEqual([]);
    expect(save.current.history.length).toBeGreaterThanOrEqual(4);
  });

  test('AC35 接力顺序动画：A 先出、B 后出，逐帧可证', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l23');
    await clickArrow(page, 'C');
    const { sawLeaderGoneFollowerPresent, bothGone } = await sampleRelay(page, 'A', 'B');
    expect(sawLeaderGoneFollowerPresent).toBe(true);
    expect(bothGone).toBe(true);
    const save = await readSave(page);
    expect(save.current.state.remaining).toEqual(
      initialState(LEVELS[22]).remaining.filter((id) => !['A', 'B', 'C'].includes(id)),
    );
    expect(save.current.history.length).toBe(2);
  });
});

test.describe('护送与点灯（25-27）', () => {
  test('AC36 第25关护送：★ 离场即通关且 a 留在场上，提示指向 ★', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l25');
    await expect(page.locator('.arrow-badge--escort')).toHaveCount(1);
    await clickArrow(page, 's');
    await clickArrow(page, 'b');
    await page.click('#btn-hint');
    await page.click('#btn-hint');
    await expect(page.locator('.arrow-mover[data-arrow-id="e"] .arrow.is-hint')).toHaveCount(1);
    await clickArrow(page, 'e');
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#status')).toContainText('★');
    await expect(page.locator('.arrow-mover[data-arrow-id="a"]')).toHaveCount(1);
    const save = await readSave(page);
    expect(save.current.state.remaining).toEqual(
      initialState(LEVELS[24]).remaining.filter((id) => !['s', 'b', 'e'].includes(id)),
    );
    expect(save.completed).toContain('l25');
    await expect(page.locator('#btn-next')).toContainText('灯与调头');
  });

  test('AC37 第26关向右直接发射：漏灯照样通关解锁，提示还有灯没亮', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l26');
    await expect(page.locator('.lamp')).toHaveCount(1);
    await expect(page.locator('.lamp--lit')).toHaveCount(0);
    await clickArrow(page, 'r');
    await page.click('#btn-fire');
    await page.waitForTimeout(700);
    await expect(page.locator('.lamp--lit')).toHaveCount(0);
    await clickArrow(page, 'c');
    await clickArrow(page, 'a');
    await finishLevel(page, 'l26');
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#win-detail')).toContainText('还有 1 盏灯没亮');
    const save = await readSave(page);
    expect(save.completed).toContain('l26');
    expect(save.unlocked).toContain('l27');
    expect(save.lampBest ?? []).not.toContain('l26');
  });

  test('AC38 第26关调头向左点灯：撤销熄灭、刷新恢复、全亮通关', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l26');
    await clickArrow(page, 'c');
    await clickTurnBadge(page, 'r');
    await clickArrow(page, 'r');
    await page.click('#btn-fire');
    await page.waitForTimeout(700);
    await expect(page.locator('.lamp--lit')).toHaveCount(1);
    let save = await readSave(page);
    expect(save.current.state.lit).toEqual(['0,3']);

    await page.click('#btn-undo');
    await expect(page.locator('.lamp--lit')).toHaveCount(0);
    save = await readSave(page);
    expect(save.current.state.lit).toEqual([]);
    expect(save.current.state.turned).toEqual(['r']);

    await clickArrow(page, 'r');
    await page.click('#btn-fire');
    await page.waitForTimeout(700);
    await page.reload();
    await page.click('#btn-start');
    await expect(page.locator('#screen-game')).toBeVisible();
    await expect(page.locator('.lamp--lit')).toHaveCount(1);
    await expect(page.locator('.lamp')).toHaveAttribute('aria-label', /已点亮/);
    await clickArrow(page, 'a');
    await finishLevel(page, 'l26');
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#win-detail')).toContainText('小屋全部点亮');
    expect((await readSave(page)).lampBest).toContain('l26');
  });

  test('AC39 第27关（末关）终局灯屋：接力+向右各点一盏，全亮通关且无下一关', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l27');
    await expect(page.locator('.lamp')).toHaveCount(2);
    await clickArrow(page, 's');
    await clickArrow(page, 'A');
    await page.waitForTimeout(1200);
    await expect(page.locator('.lamp--lit')).toHaveCount(1);
    await clickArrow(page, 'r');
    await page.click('#btn-fire');
    await page.waitForTimeout(700);
    await expect(page.locator('.lamp--lit')).toHaveCount(2);
    await clickArrow(page, 'd');
    await finishLevel(page, 'l27');
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#win-detail')).toContainText('小屋全部点亮');
    await expect(page.locator('#btn-next')).toBeHidden();
    const save = await readSave(page);
    expect(save.completed).toContain('l27');
    expect(save.current.state.lit).toEqual(['5,6', '6,4']);
    expect(save.current.state.remaining).toEqual([]);
    expect(save.lampBest).toContain('l27');
  });
});

test.describe('第六轮：新手教学与首次游玩', () => {
  test('AC45 全新玩家：开始游戏 → 小棋盘教学三步通关 → 进入正式第 1 关，不计完成数', async ({ page }) => {
    await freshNewPlayer(page);
    await expect(page.locator('#btn-start')).toHaveText('开始游戏');
    await page.click('#btn-start');
    await expect(page.locator('#game-title')).toHaveText('新手教学');
    await expect(page.locator('#btn-tutorial-skip')).toBeVisible();
    await expect(page.locator('#game-intro')).toContainText('B 被 C 挡住');
    const board = await page.locator('.board-svg').boundingBox();
    expect(board!.width).toBeGreaterThan(200);
    await playSolution(page, 'tutorial');
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#btn-next')).toContainText('初次见面');
    let save = await readSave(page);
    expect(save.tutorialDone).toBe(true);
    expect(save.completed).toEqual([]);
    expect(save.current).toBeNull();
    await page.click('#btn-next');
    await expect(page.locator('#game-title')).toContainText('第 1 关');
    await page.click('#btn-game-back');
    await page.click('#btn-levels-back');
    await expect(page.locator('#home-progress')).toContainText('27 个原创关卡');
    save = await readSave(page);
    expect(save.completed).toEqual([]);
  });

  test('AC46 跳过教学：直达正式第 1 关，刷新后不再弹教学', async ({ page }) => {
    await freshNewPlayer(page);
    await page.click('#btn-start');
    await page.click('#btn-tutorial-skip');
    await expect(page.locator('#game-title')).toContainText('第 1 关');
    await expect(page.locator('#btn-tutorial-skip')).toBeHidden();
    const save = await readSave(page);
    expect(save.tutorialDone).toBe(true);
    expect(save.current.levelId).toBe('l01');
    await page.reload();
    await expect(page.locator('#btn-start')).toHaveText('继续第 1 关');
    await page.click('#btn-start');
    await expect(page.locator('#game-title')).toContainText('第 1 关');
  });

  test('AC47 有进度的老玩家：主按钮直达显示顺序的下一关（第 3 关折弯初识）', async ({ page }) => {
    await seedSave(page, {
      schemaVersion: 1,
      completed: ['l01', 'l02'],
      unlocked: ['l01', 'l02', 'l19'],
      current: null,
    });
    await expect(page.locator('#btn-start')).toHaveText('进入第 3 关');
    await page.click('#btn-start');
    await expect(page.locator('#game-title')).toHaveText('第 3 关 · 折弯初识');
  });

  test('AC55 重排前旧存档：完成到 l06 则前移的 l19/l21 已解锁，进度不丢', async ({ page }) => {
    await seedSave(page, {
      schemaVersion: 1,
      completed: ['l01', 'l02', 'l03', 'l04', 'l05', 'l06'],
      unlocked: ['l01', 'l02', 'l03', 'l04', 'l05', 'l06', 'l07'],
      current: null,
    });
    await expect(page.locator('#home-progress')).toHaveText('已完成 6 / 27 关');
    // 前移的 l19/l21 已解锁但未完成：按显示顺序，下一个未完成是第 3 关（折弯初识）。
    await expect(page.locator('#btn-start')).toHaveText('进入第 3 关');
    await page.click('#btn-levels');
    await expect(page.locator('.level-tile[data-level-id="l19"]')).toBeEnabled();
    await expect(page.locator('.level-tile[data-level-id="l21"]')).toBeEnabled();
    await expect(page.locator('.level-tile[data-level-id="l07"]')).toBeEnabled();
    await expect(page.locator('.level-tile[data-level-id="l08"]')).toBeDisabled();
    await page.click('.level-tile[data-level-id="l19"]');
    await expect(page.locator('#game-title')).toHaveText('第 3 关 · 折弯初识');
    const save = await readSave(page);
    expect(save.completed).toEqual(['l01', 'l02', 'l03', 'l04', 'l05', 'l06']);
  });
});

test.describe('第六轮：首页主按钮五态', () => {
  test('AC48a 进行中：继续第 8 关（l06），点击恢复棋盘', async ({ page }) => {
    const l06 = levelOf('l06');
    await seedSave(page, {
      schemaVersion: 1,
      completed: [],
      unlocked: LEVELS.map((l) => l.id),
      current: { levelId: 'l06', state: initialState(l06), history: [] },
      tutorialDone: true,
    });
    await expect(page.locator('#btn-start')).toHaveText('继续第 8 关');
    await page.click('#btn-start');
    await expect(page.locator('#game-title')).toHaveText('第 8 关 · 长箭出门');
    const save = await readSave(page);
    expect(save.current.state.remaining).toEqual(initialState(l06).remaining);
  });

  test('AC48b 刚通关且下一关未开始：进入第 9 关（l07）', async ({ page }) => {
    await seedSave(page, {
      schemaVersion: 1,
      completed: DISPLAY_ORDER.slice(0, 8),
      unlocked: LEVELS.map((l) => l.id),
      current: null,
      tutorialDone: true,
    });
    await expect(page.locator('#btn-start')).toHaveText('进入第 9 关');
    await page.click('#btn-start');
    await expect(page.locator('#game-title')).toContainText('先走后关');
  });

  test('AC48c 重玩已完成关卡中途退出：继续重玩第 6 关（l04）', async ({ page }) => {
    const l04 = levelOf('l04');
    const init = initialState(l04);
    await seedSave(page, {
      schemaVersion: 1,
      completed: ['l04'],
      unlocked: LEVELS.map((l) => l.id),
      current: {
        levelId: 'l04',
        state: { ...init, remaining: init.remaining.filter((id) => id !== 's'), open: { diamond: true } },
        history: [init],
      },
      tutorialDone: true,
    });
    await expect(page.locator('#btn-start')).toHaveText('继续重玩第 6 关');
    await page.click('#btn-start');
    const save = await readSave(page);
    expect(save.current.state.remaining).not.toContain('s');
    await expect(page.locator('#btn-undo')).toBeEnabled();
  });

  test('AC48d 全部通关且无进行中：回顾关卡 → 选关页', async ({ page }) => {
    await seedSave(page, {
      schemaVersion: 1,
      completed: LEVELS.map((l) => l.id),
      unlocked: LEVELS.map((l) => l.id),
      current: null,
      tutorialDone: true,
    });
    await expect(page.locator('#btn-start')).toHaveText('回顾关卡');
    await expect(page.locator('#home-progress')).toHaveText('已完成 27 / 27 关');
    await page.click('#btn-start');
    await expect(page.locator('#screen-levels')).toBeVisible();
  });

  test('AC49 完成计数只算不同正式关：教学与重复通关不增加', async ({ page }) => {
    await seedSave(page, {
      schemaVersion: 1,
      completed: ['l01'],
      unlocked: ['l01', 'l02'],
      current: null,
      tutorialDone: true,
    });
    await expect(page.locator('#home-progress')).toHaveText('已完成 1 / 27 关');
    await openLevel(page, 'l01');
    await playSolution(page, 'l01');
    await expect(page.locator('#win-overlay')).toBeVisible();
    const save = await readSave(page);
    expect(save.completed).toEqual(['l01']);
    await page.click('#btn-win-levels');
    await page.click('#btn-levels-back');
    await expect(page.locator('#home-progress')).toHaveText('已完成 1 / 27 关');
  });
});

test.describe('第六轮：分级提示与接力反馈', () => {
  test('AC50 分级提示：第一次观察线索不点名，第二次才点名；移动/重开后重置', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l23');
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('观察');
    await expect(page.locator('#status')).not.toContainText('开关 C');
    await expect(page.locator('.arrow.is-hint')).toHaveCount(0);
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('开关 C');
    await clickArrow(page, 'C');
    // C 离场后局面变化：重新从观察线索开始，且绝不提示已离场的 C
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('观察');
    await expect(page.locator('#status')).not.toContainText('开关 C');
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('启动接力 A');
    await page.click('#btn-restart');
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('观察');
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('开关 C');
  });

  test('AC51 接力受阻：先亮虚线再高亮挡路闸门，整队不动，文字说明原因', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l23');
    const before = await readSave(page);
    await page.evaluate(() => {
      const node = document.querySelector<SVGGElement>('.arrow-mover[data-arrow-id="A"] .arrow')!;
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await expect(page.locator('.relay-link.is-active')).toHaveCount(1);
    await expect(page.locator('#status')).toContainText('接力没启动');
    await expect(page.locator('#status')).toContainText('B');
    await page.waitForTimeout(700);
    await expect(page.locator('.gate.is-blocker')).toHaveCount(1);
    const after = await readSave(page);
    expect(after.current.state.remaining).toEqual(before.current.state.remaining);
    expect(after.current.history.length).toBe(0);
  });

  test('AC52 接力成功：虚线在 A/B 离场动画期间保持可见，结束后清除', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l23');
    await clickArrow(page, 'C');
    await page.evaluate(() => {
      const node = document.querySelector<SVGGElement>('.arrow-mover[data-arrow-id="A"] .arrow')!;
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(150);
    expect(await page.locator('.relay-link.is-active').count()).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(1500);
    await expect(page.locator('.relay-link')).toHaveCount(0);
    const save = await readSave(page);
    expect(save.current.state.remaining).toEqual(
      initialState(LEVELS[22]).remaining.filter((id) => !['A', 'B', 'C'].includes(id)),
    );
    expect(save.current.history.length).toBe(2);
  });

  test('AC57 入场文案分工：目标栏只写目标，状态栏留空，玩法说明独立', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l23');
    await expect(page.locator('#game-goal')).toContainText('虚线连接的两支箭头一起离场');
    await expect(page.locator('#game-intro')).toContainText('领头');
    await expect(page.locator('#status')).toHaveText('');
    const goal = await page.locator('#game-goal').textContent();
    const intro = await page.locator('#game-intro').textContent();
    expect(goal).not.toEqual(intro);
  });
});

test.describe('第六轮：点灯可选挑战与最佳成绩', () => {
  test('AC53 点灯进度即时更新：入场 0/1，点亮 1/1，撤销回 0/1；目标不含"必须点灯"', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l26');
    await expect(page.locator('#game-optional')).toHaveText('可选 · 点亮小屋 0/1');
    await expect(page.locator('#game-goal')).not.toContainText('灯');
    await clickArrow(page, 'c');
    await clickTurnBadge(page, 'r');
    await clickArrow(page, 'r');
    await page.click('#btn-fire');
    await page.waitForTimeout(700);
    await expect(page.locator('#game-optional')).toHaveText('可选 · 点亮小屋 1/1');
    await page.click('#btn-undo');
    await expect(page.locator('#game-optional')).toHaveText('可选 · 点亮小屋 0/1');
  });

  test('AC54 全亮标记持久：全亮通关后选关有标记，漏灯重玩不覆盖', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 'l26');
    await clickArrow(page, 'c');
    await clickTurnBadge(page, 'r');
    await clickArrow(page, 'r');
    await page.click('#btn-fire');
    await page.waitForTimeout(700);
    await clickArrow(page, 'a');
    await finishLevel(page, 'l26');
    await expect(page.locator('#win-overlay')).toBeVisible();
    expect((await readSave(page)).lampBest).toEqual(['l26']);
    await page.click('#btn-win-levels');
    await expect(page.locator('.level-tile[data-level-id="l26"] .level-best')).toHaveText('小屋全亮');
    // 漏灯重玩：向右直接发射通关，最佳成绩保留
    await page.click('.level-tile[data-level-id="l26"]');
    await clickArrow(page, 'r');
    await page.click('#btn-fire');
    await page.waitForTimeout(700);
    await clickArrow(page, 'c');
    await clickArrow(page, 'a');
    await finishLevel(page, 'l26');
    await expect(page.locator('#win-detail')).toContainText('还有 1 盏灯没亮');
    const save = await readSave(page);
    expect(save.lampBest).toEqual(['l26']);
    await page.reload();
    await page.click('#btn-levels');
    await expect(page.locator('.level-tile[data-level-id="l26"] .level-best')).toHaveText('小屋全亮');
  });
});

test.describe('第六轮：选关章节与布局', () => {
  test('AC56 三章节分组与编号：基础疏通 5 关、闸门进阶 15 关、特殊箭头 7 关', async ({ page }) => {
    await fresh(page, true);
    await page.click('#btn-levels');
    await expect(page.locator('.chapter')).toHaveCount(3);
    await expect(page.locator('.chapter[data-chapter="basic"] .chapter-title')).toHaveText('基础疏通');
    await expect(page.locator('.chapter[data-chapter="gate"] .chapter-title')).toHaveText('闸门进阶');
    await expect(page.locator('.chapter[data-chapter="special"] .chapter-title')).toHaveText('特殊箭头');
    await expect(page.locator('.chapter[data-chapter="basic"] .level-tile')).toHaveCount(5);
    await expect(page.locator('.chapter[data-chapter="gate"] .level-tile')).toHaveCount(15);
    await expect(page.locator('.chapter[data-chapter="special"] .level-tile')).toHaveCount(7);
    await expect(page.locator('.chapter[data-chapter="basic"] .level-tile').first()).toContainText('01');
    await expect(page.locator('.level-tile[data-level-id="l19"] .level-num')).toHaveText('03');
    await expect(page.locator('.level-tile[data-level-id="l21"] .level-num')).toHaveText('04');
    await expect(page.locator('.level-tile[data-level-id="l27"] .level-num')).toHaveText('27');
    await expect(page.locator('#levels-progress')).toHaveText('0 / 27');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  for (const width of [360, 1280]) {
    test(`AC56 ${width}px 选关页无横溢、章节卡片可点`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await fresh(page, true);
      await page.click('#btn-levels');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      const tile = page.locator('.level-tile[data-level-id="l01"]');
      const box = await tile.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await tile.click();
      await expect(page.locator('#screen-game')).toBeVisible();
    });
  }
});