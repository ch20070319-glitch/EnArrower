import { expect, test, Page } from '@playwright/test';

const SAVE_KEY = 'enarrower.save';

async function fresh(page: Page, unlockAll = false) {
  await page.goto('/');
  await page.evaluate(
    ({ key, unlockAll }) => {
      localStorage.removeItem(key);
      if (unlockAll) {
        const ids = Array.from({ length: 12 }, (_, i) => `l${String(i + 1).padStart(2, '0')}`);
        localStorage.setItem(
          key,
          JSON.stringify({ schemaVersion: 1, completed: [], unlocked: ids, current: null }),
        );
      }
    },
    { key: SAVE_KEY, unlockAll },
  );
  await page.reload();
}

async function openLevel(page: Page, index: number) {
  await page.click('#btn-levels');
  await page.click(`.level-tile:nth-child(${index})`);
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
    const { samples, removed, max, distinct } = await sampleExit(page, '向右，长度 1');
    expect(removed).toBe(true);
    expect(max).toBeGreaterThan(300);
    expect(distinct).toBeGreaterThan(5);
    const mid = samples.filter((s) => s > 20 && s < max - 20);
    expect(mid.length).toBeGreaterThan(3);
  });

  test('AC02 向下多格箭头连续位移', async ({ page }) => {
    await fresh(page);
    await page.click('#btn-start');
    const { removed, distinct, max } = await sampleExit(page, '向下，长度 1');
    expect(removed).toBe(true);
    expect(distinct).toBeGreaterThan(5);
    expect(max).toBeGreaterThan(200);
  });

  test('AC06 动画期间快速连点只提交一次', async ({ page }) => {
    await fresh(page);
    await page.click('#btn-start');
    const result = await page.evaluate(async () => {
      const arrow = document.querySelector<SVGGElement>('.arrow')!;
      for (let i = 0; i < 8; i++) {
        arrow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 20));
      }
      await new Promise((r) => setTimeout(r, 800));
      const save = JSON.parse(localStorage.getItem('enarrower.save')!);
      return {
        remaining: save.current.state.remaining,
        historyLen: save.current.history.length,
        arrowsInDom: document.querySelectorAll('.arrow').length,
      };
    });
    expect(result.remaining).toEqual(['b', 'c']);
    expect(result.historyLen).toBe(1);
    expect(result.arrowsInDom).toBe(2);
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
    await openLevel(page, 2);
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
    await openLevel(page, 11);
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

  test('AC15 查看机关模式点击只预览不移动', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 4);
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
    await openLevel(page, 4);
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
    expect(after.current.state.remaining).toEqual(['s', 'b', 'c']);
    await expect(page.locator('#btn-undo')).toBeDisabled();
  });

  test('AC09 重开恢复初始布局并清空历史', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 4);
    await page.evaluate(() => {
      document.querySelector<SVGGElement>('.arrow')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(800);
    await page.click('#btn-restart');
    const after = await readSave(page);
    expect(after.current.state.remaining).toEqual(['s', 'b', 'c']);
    expect(after.current.state.open.diamond).toBe(false);
    expect(after.current.history.length).toBe(0);
  });

  test('AC11 先关门后提示识别无解（第7关先走开关）', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 7);
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

  test('AC10 可解状态提示高亮一支箭头且不自动移动', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 7);
    const before = await readSave(page);
    await page.click('#btn-hint');
    await expect(page.locator('.arrow.is-hint')).toHaveCount(1);
    const after = await readSave(page);
    expect(after.current.state.remaining).toEqual(before.current.state.remaining);
  });
});

test.describe('通关与存档', () => {
  test('AC07 最后一支离场后通关并解锁下一关', async ({ page }) => {
    await fresh(page);
    await page.click('#btn-start');
    for (const frag of ['向右，长度 1', '向下，长度 1', '向右，长度 2']) {
      await page.evaluate((f) => {
        const a = [...document.querySelectorAll<SVGGElement>('.arrow')].find((x) =>
          x.getAttribute('aria-label')?.includes(f),
        )!;
        a.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, frag);
      await page.waitForTimeout(700);
    }
    await expect(page.locator('#win-overlay')).toBeVisible();
    const save = await readSave(page);
    expect(save.completed).toContain('l01');
    expect(save.unlocked).toContain('l02');
  });

  test('AC13 刷新恢复进行中状态与历史', async ({ page }) => {
    await fresh(page);
    await page.click('#btn-start');
    await page.evaluate(() => {
      document.querySelector<SVGGElement>('.arrow')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(700);
    await page.reload();
    await page.click('#btn-start');
    const save = await readSave(page);
    expect(save.current.state.remaining).toEqual(['b', 'c']);
    expect(save.current.history.length).toBe(1);
    await expect(page.locator('#game-count')).toHaveText('2 支');
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
    await page.evaluate(() => {
      document.querySelector<SVGGElement>('.arrow')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(60);
    await page.reload();
    await page.click('#btn-start');
    const save = await readSave(page);
    expect(save.current.state.remaining).toEqual(['a', 'b', 'c']);
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

  test('AC17 减少动态效果下规则结果一致', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fresh(page);
    await page.click('#btn-start');
    await page.evaluate(() => {
      document.querySelector<SVGGElement>('.arrow')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(200);
    const save = await readSave(page);
    expect(save.current.state.remaining).toEqual(['b', 'c']);
    expect(save.current.history.length).toBe(1);
  });
});