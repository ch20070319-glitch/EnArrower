import { expect, test, Page } from '@playwright/test';
import { LEVELS } from '../../src/levels/levels';

const SAVE_KEY = 'enarrower.save';

async function fresh(page: Page, unlockAll = false) {
  await page.goto('/');
  await page.evaluate(
    ({ key, unlockAll, ids }) => {
      localStorage.removeItem(key);
      if (unlockAll) {
        localStorage.setItem(
          key,
          JSON.stringify({ schemaVersion: 1, completed: [], unlocked: ids, current: null }),
        );
      }
    },
    { key: SAVE_KEY, unlockAll, ids: LEVELS.map((l) => l.id) },
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

/** 按关卡内箭头 id 点击并等待动画提交完成。 */
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

  test('AC15 键盘聚焦开关箭头预览关联闸门', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 4);
    await page.evaluate(() => {
      const s = [...document.querySelectorAll<SVGGElement>('.arrow')].find((x) =>
        x.getAttribute('aria-label')?.includes('◇ 开关'),
      )!;
      s.focus();
    });
    await expect(page.locator('.gate.is-preview')).toHaveCount(1);
    await expect(page.locator('.gate.is-preview .gate-label')).toHaveText('将开启');
    const before = await readSave(page);
    expect(before.current.state.remaining).toEqual(['s', 'b', 'c']);
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

  test('AC17 动画中改变窗口尺寸不锁死、结果一致', async ({ page }) => {
    await fresh(page);
    await page.click('#btn-start');
    await page.evaluate(() => {
      document.querySelector<SVGGElement>('.arrow')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(80);
    await page.setViewportSize({ width: 500, height: 700 });
    await page.waitForTimeout(120);
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.waitForTimeout(700);
    const save = await readSave(page);
    expect(save.current.state.remaining).toEqual(['b', 'c']);
    expect(save.current.history.length).toBe(1);
    await expect(page.locator('#btn-restart')).toBeEnabled();
  });

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
test.describe('进阶机关关卡（13-18）', () => {
  test('AC21 第13关先清挡路再走开关 → 关门死局被提示识别', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 13);
    await clickArrow(page, 'f');
    await clickArrow(page, 's');
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('无法通关');
    const save = await readSave(page);
    expect(save.current.state.open.diamond).toBe(false);
    expect(save.current.state.remaining).toEqual(['a', 'b', 'c']);
  });

  test('AC22 第17关跨组链条完整通关并解锁第18关', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 17);
    for (const id of ['sc', 'sd', 'e', 'a', 'b', 'd', 'c']) await clickArrow(page, id);
    await expect(page.locator('#win-overlay')).toBeVisible();
    const save = await readSave(page);
    expect(save.completed).toContain('l17');
    expect(save.unlocked).toContain('l18');
  });

  test('AC23 第18关通关后下一关指向折线教学关', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 18);
    for (const id of ['f', 'sd', 'a', 'b', 'sc', 'c', 'g', 'd', 'e']) await clickArrow(page, id);
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#btn-next')).toBeVisible();
    await expect(page.locator('#btn-next')).toContainText('折弯初识');
    const save = await readSave(page);
    expect(save.completed).toContain('l18');
    expect(save.current.state.remaining).toEqual([]);
  });
});

test.describe('大棋盘与折线箭头（19-20）', () => {
  test('AC24 折线离场绳随动画：路径逐帧展开、尾部出界后移除', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 19);
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
    await openLevel(page, 19);
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
    await openLevel(page, 20);
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

  test('AC27 第20关大棋盘完整通关，下一关指向调头教学', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 20);
    for (const id of ['k1', 'k2', 's', 'a', 'b', 'c', 'd', 'e', 'f']) await clickArrow(page, id);
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#btn-next')).toContainText('调头初试');
    const save = await readSave(page);
    expect(save.completed).toContain('l20');
    expect(save.current.state.remaining).toEqual([]);
  });
});

test.describe('可调头箭头（21-22）', () => {
  test('AC28 单击 ⇄ 只选中不移动；发射被挡状态不变；调头后向左离场', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 21);
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

    await clickArrow(page, 'r');
    await page.click('#btn-turn');
    await expect(page.locator('#sel-label')).toContainText('当前向左');
    const turned = await readSave(page);
    expect(turned.current.state.turned).toEqual(['r']);
    expect(turned.current.history.length).toBe(1);
    expect(turned.current.state.open.diamond).toBe(false);

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
    await openLevel(page, 21);
    await clickArrow(page, 'a');
    await clickArrow(page, 'r');
    await page.click('#btn-turn');
    await page.click('#btn-fire');
    await page.waitForTimeout(700);
    await clickArrow(page, 's');
    await expect(page.locator('#win-overlay')).toBeVisible();
    const save = await readSave(page);
    expect(save.completed).toContain('l21');
  });

  test('AC30 调头后刷新页面：继续游戏恢复朝向', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 21);
    await clickArrow(page, 'r');
    await page.click('#btn-turn');
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
    await openLevel(page, 22);
    await clickArrow(page, 't');
    await clickArrow(page, 'c');
    await clickArrow(page, 'r');
    await page.click('#btn-fire');
    await page.waitForTimeout(300);
    await expect(page.locator('#status')).toContainText('被挡住');
    await clickArrow(page, 'r');
    await page.click('#btn-turn');
    await page.click('#btn-fire');
    await page.waitForTimeout(700);
    await clickArrow(page, 's');
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#btn-next')).toContainText('接力过桥');
    const save = await readSave(page);
    expect(save.completed).toContain('l22');
  });

  test('AC32 提示识别调头操作：a 离场后提示先调头', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 21);
    await clickArrow(page, 'a');
    await page.click('#btn-hint');
    await expect(page.locator('#status')).toContainText('调头');
    await expect(page.locator('.arrow-mover[data-arrow-id="r"] .arrow.is-hint')).toHaveCount(1);
  });
});

test.describe('接力箭头（23-24）', () => {
  test('AC33 点 B 只高亮 A；开门前接力失败双方不动；开门后一次撤销全恢复', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 23);
    const before = await readSave(page);
    await expect(page.locator('.relay-link[data-leader="A"]')).toHaveCount(1);

    await clickArrow(page, 'B');
    await expect(page.locator('#status')).toContainText('领头');
    await expect(page.locator('.arrow-mover[data-arrow-id="A"] .arrow.is-hint')).toHaveCount(1);
    const afterB = await readSave(page);
    expect(afterB.current.state.remaining).toEqual(before.current.state.remaining);
    expect(afterB.current.history.length).toBe(0);

    await clickArrow(page, 'A');
    await expect(page.locator('#status')).toContainText('被挡住');
    await expect(page.locator('#status')).toContainText('闸门');
    const blocked = await readSave(page);
    expect(blocked.current.state.remaining).toEqual(['A', 'B', 'C']);
    expect(blocked.current.history.length).toBe(0);
    expect(blocked.current.state.open.diamond).toBe(false);

    await clickArrow(page, 'C');
    await clickArrow(page, 'A');
    await page.waitForTimeout(1200);
    const relayed = await readSave(page);
    expect(relayed.current.state.remaining).toEqual([]);
    expect(relayed.current.history.length).toBe(2);
    await expect(page.locator('#win-overlay')).toBeVisible();

    await page.click('#btn-win-undo');
    const undone = await readSave(page);
    expect(undone.current.state.remaining).toEqual(['A', 'B']);
    expect(undone.current.state.open.diamond).toBe(true);
    await expect(page.locator('.arrow-mover[data-arrow-id="A"]')).toHaveCount(1);
    await expect(page.locator('.arrow-mover[data-arrow-id="B"]')).toHaveCount(1);
  });

  test('AC34 第24关接力长链完整通关，下一关指向护送关', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 24);
    await clickArrow(page, 's');
    await clickArrow(page, 'A');
    await page.waitForTimeout(1200);
    await clickArrow(page, 't');
    await clickArrow(page, 'C');
    await page.waitForTimeout(1200);
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#btn-next')).toBeVisible();
    await expect(page.locator('#btn-next')).toContainText('护送星标');
    const save = await readSave(page);
    expect(save.completed).toContain('l24');
    expect(save.current.state.remaining).toEqual([]);
    expect(save.current.history.length).toBe(4);
  });

  test('AC35 接力顺序动画：A 先出、B 后出，逐帧可证', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 23);
    await clickArrow(page, 'C');
    const { sawLeaderGoneFollowerPresent, bothGone } = await sampleRelay(page, 'A', 'B');
    expect(sawLeaderGoneFollowerPresent).toBe(true);
    expect(bothGone).toBe(true);
    const save = await readSave(page);
    expect(save.current.state.remaining).toEqual([]);
    expect(save.current.history.length).toBe(2);
  });
});

test.describe('护送与点灯（25-27）', () => {
  test('AC36 第25关护送：★ 离场即通关且 a 留在场上，提示指向 ★', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 25);
    await expect(page.locator('.arrow-badge--escort')).toHaveCount(1);
    await clickArrow(page, 's');
    await clickArrow(page, 'b');
    await page.click('#btn-hint');
    await expect(page.locator('.arrow-mover[data-arrow-id="e"] .arrow.is-hint')).toHaveCount(1);
    await clickArrow(page, 'e');
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#status')).toContainText('★');
    await expect(page.locator('.arrow-mover[data-arrow-id="a"]')).toHaveCount(1);
    const save = await readSave(page);
    expect(save.current.state.remaining).toEqual(['a']);
    expect(save.completed).toContain('l25');
    await expect(page.locator('#btn-next')).toContainText('灯与调头');
  });

  test('AC37 第26关向右直接发射：通关但灯不亮，提示还有灯没亮', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 26);
    await expect(page.locator('.lamp')).toHaveCount(1);
    await expect(page.locator('.lamp--lit')).toHaveCount(0);
    await clickArrow(page, 'r');
    await page.click('#btn-fire');
    await page.waitForTimeout(700);
    await expect(page.locator('.lamp--lit')).toHaveCount(0);
    await clickArrow(page, 'c');
    await clickArrow(page, 'a');
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#win-detail')).toContainText('还有 1 盏灯没亮');
  });

  test('AC38 第26关调头向左点灯：撤销熄灭、刷新恢复、全亮通关', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 26);
    await clickArrow(page, 'c');
    await clickArrow(page, 'r');
    await page.click('#btn-turn');
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
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#win-detail')).toContainText('点亮小屋：所有灯都亮了');
  });

  test('AC39 第27关（末关）终局灯屋：接力+向右各点一盏，全亮通关且无下一关', async ({ page }) => {
    await fresh(page, true);
    await openLevel(page, 27);
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
    await expect(page.locator('#win-overlay')).toBeVisible();
    await expect(page.locator('#win-detail')).toContainText('点亮小屋：所有灯都亮了');
    await expect(page.locator('#btn-next')).toBeHidden();
    const save = await readSave(page);
    expect(save.completed).toContain('l27');
    expect(save.current.state.lit).toEqual(['5,6', '6,4']);
    expect(save.current.state.remaining).toEqual([]);
  });
});
