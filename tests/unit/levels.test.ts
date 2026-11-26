import { describe, expect, it } from 'vitest';
import {
  allLampsLit,
  applyMove,
  applyRelay,
  applyTurn,
  cellKey,
  cellsOf,
  checkMove,
  checkRelay,
  exitDistance,
  headDirOf,
  initialState,
  isWin,
  legalMoves,
  sweptCells,
} from '../../src/core/rules';
import { solve } from '../../src/core/solver';
import type { GameState, LevelDef } from '../../src/core/types';
import { LEVELS, DISPLAY_ORDER, TUTORIAL_LEVEL, displayNumber, orderedLevels } from '../../src/levels/levels';
import { validateLevel } from '../../src/levels/validate';

/** 从当前状态用求解器清空剩余箭头（加密后关卡含填充箭，部分清空不等于通关）。 */
function finish(level: LevelDef, from: GameState): GameState {
  const result = solve(level, from);
  expect(result.solvable).toBe(true);
  let state = from;
  for (const op of result.solution!) {
    state =
      op.kind === 'turn'
        ? applyTurn(level, state, op.arrowId).state
        : op.kind === 'relay'
          ? applyRelay(level, state, op.arrowId).state
          : applyMove(level, state, op.arrowId).state;
  }
  return state;
}

describe('27 个正式关卡', () => {
  it('数量与编号连续（显示顺序与 id 解耦）', () => {
    expect(LEVELS).toHaveLength(27);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(27);
    expect(DISPLAY_ORDER).toHaveLength(27);
    expect([...DISPLAY_ORDER].sort()).toEqual(LEVELS.map((l) => l.id).sort());
    expect(orderedLevels().map((l) => displayNumber(l))).toEqual(
      Array.from({ length: 27 }, (_, i) => i + 1),
    );
    expect(LEVELS.map((l) => l.id)).not.toContain(TUTORIAL_LEVEL.id);
  });

  for (const level of orderedLevels()) {
    describe(`第 ${displayNumber(level)} 关 ${level.name}`, () => {
      it('数据校验通过（坐标/长度/方向/重叠/机关引用）', () => {
        expect(validateLevel(level)).toEqual([]);
      });

      it('有解且解法可用规则引擎逐步重放清空', () => {
        const result = solve(level, initialState(level));
        expect(result.solvable).toBe(true);
        expect(result.solution).not.toBeNull();
        let state = initialState(level);
        for (const op of result.solution!) {
          if (op.kind === 'turn') {
            const turned = applyTurn(level, state, op.arrowId);
            expect(turned.ok).toBe(true);
            state = turned.state;
          } else if (op.kind === 'relay') {
            const moved = applyRelay(level, state, op.arrowId);
            expect(moved.ok).toBe(true);
            state = moved.state;
          } else {
            expect(checkMove(level, state, op.arrowId).ok).toBe(true);
            state = applyMove(level, state, op.arrowId).state;
          }
        }
        expect(isWin(level, state)).toBe(true);
      });

      it('每支箭头的提示首步执行后仍可通关', () => {
        const result = solve(level, initialState(level));
        const first = result.solution![0];
        const next =
          first.kind === 'turn'
            ? applyTurn(level, initialState(level), first.arrowId).state
            : first.kind === 'relay'
              ? applyRelay(level, initialState(level), first.arrowId).state
              : applyMove(level, initialState(level), first.arrowId).state;
        expect(solve(level, next).solvable).toBe(true);
      });
    });
  }

  it('三章节与显示顺序：基础疏通含折线/调头教学，闸门进阶 l04-l18，特殊箭头收尾', () => {
    const idsOf = (chapter: string) =>
      orderedLevels().filter((l) => l.chapter === chapter).map((l) => l.id);
    expect(idsOf('basic')).toEqual(['l01', 'l02', 'l19', 'l21', 'l03']);
    expect(idsOf('gate')).toEqual([
      'l04', 'l05', 'l06', 'l07', 'l08', 'l09', 'l10', 'l11', 'l12', 'l13', 'l14', 'l15', 'l16', 'l17', 'l18',
    ]);
    expect(idsOf('special')).toEqual(['l20', 'l22', 'l23', 'l24', 'l25', 'l26', 'l27']);
    // 折线教学在第 3 位、调头教学在第 4 位（早期特殊箭头体验）；章末挑战不叫"终局/毕业"。
    expect(displayNumber(LEVELS[18])).toBe(3);
    expect(displayNumber(LEVELS[20])).toBe(4);
    expect(displayNumber(LEVELS[2])).toBe(5);
    expect(LEVELS[2].name).toBe('疏通章末挑战');
    expect(LEVELS[17].name).toBe('闸门章末挑战');
    expect(LEVELS[11].name).toBe('双钥汇流');
    // 机关数量规划不变（LEVELS 原始顺序）：1-3 无机关，4-9 一组，10-12 两组，13-15 一组，16-18 两组。
    for (const l of LEVELS.slice(0, 3)) expect(l.mechanisms).toHaveLength(0);
    for (const l of LEVELS.slice(3, 9)) expect(l.mechanisms).toHaveLength(1);
    for (const l of LEVELS.slice(9, 12)) expect(l.mechanisms).toHaveLength(2);
    for (const l of LEVELS.slice(12, 15)) expect(l.mechanisms).toHaveLength(1);
    for (const l of LEVELS.slice(15, 18)) expect(l.mechanisms).toHaveLength(2);
    expect(LEVELS[18].mechanisms).toHaveLength(0);
    expect(LEVELS[19].mechanisms).toHaveLength(1);
    expect(LEVELS[20].mechanisms).toHaveLength(1);
    expect(LEVELS[21].mechanisms).toHaveLength(2);
    expect(LEVELS[22].mechanisms).toHaveLength(1);
    expect(LEVELS[23].mechanisms).toHaveLength(2);
    expect(LEVELS[24].mechanisms).toHaveLength(1);
    expect(LEVELS[25].mechanisms).toHaveLength(0);
    expect(LEVELS[26].mechanisms).toHaveLength(1);
    expect(LEVELS[24].escort).toBe('e');
    expect(LEVELS[25].lamps).toHaveLength(1);
    expect(LEVELS[26].lamps).toHaveLength(2);
  });

  it('目标栏只写目标，不透露完整操作顺序；点灯关目标不含"必须点灯"', () => {
    for (const level of LEVELS) {
      expect(level.goal.length).toBeGreaterThan(0);
      expect(level.goal).not.toMatch(/先.*再.*最后/);
    }
    expect(LEVELS[22].goal).toContain('虚线连接的两支箭头一起离场');
    expect(LEVELS[24].goal).toContain('★');
    for (const i of [25, 26]) {
      expect(LEVELS[i].goal).not.toContain('灯');
      expect(LEVELS[i].intro).toContain('可选');
    }
  });

  it('大棋盘面积约为旧同类关两倍（7×7=49 → 8×12=96）', () => {
    const l20 = LEVELS[19];
    expect(l20.width * l20.height).toBeGreaterThanOrEqual(2 * 49 - 2);
    expect(l20.arrows.length).toBeGreaterThanOrEqual(9);
  });
});

describe('折线箭头规则（绳随路线）', () => {
  const l19 = LEVELS[18];
  const l20 = LEVELS[19];

  it('折线箭身按尾→头坐标串占用，出口朝向取末段', () => {
    const k = l19.arrows.find((a) => a.id === 'k')!;
    expect(cellsOf(k)).toEqual(k.path);
    expect(headDirOf(k)).toBe('up');
  });

  it('自身弯折格不算障碍：出口射线畅通即可离场', () => {
    expect(checkMove(l19, initialState(l19), 'k').ok).toBe(true);
  });

  it('折线箭身挡路：d 的射线撞 k 的弯折身', () => {
    const check = checkMove(l19, initialState(l19), 'd');
    expect(check.ok).toBe(false);
    expect(check.blocker).toMatchObject({ kind: 'arrow', arrowId: 'k' });
  });

  it('绳随路线 = 自身格 + 出口射线，与碰撞判定共用', () => {
    // 第三轮铺满后 l19 的 k 头部贴边：出口射线为空，swept 即自身格
    const k = l19.arrows.find((a) => a.id === 'k')!;
    expect(sweptCells(l19, k).map(cellKey)).toEqual(k.path!.map(cellKey));
    expect(exitDistance(l19, k)).toBe(1 + (k.path!.length - 1));
    // 头部不贴边的折线（l03 d）：swept = 自身 9 格 + 射线 (6,1),(6,0)
    const l03 = LEVELS[2];
    const d = l03.arrows.find((a) => a.id === 'd')!;
    expect(sweptCells(l03, d).map(cellKey)).toEqual([...d.path!.map(cellKey), '6,1', '6,0']);
    expect(exitDistance(l03, d)).toBe(3 + (d.path!.length - 1));
  });

  it('大棋盘折线湾口挡钥匙：k1 离场后 s 才可动', () => {
    const s0 = initialState(l20);
    expect(checkMove(l20, s0, 's').blocker).toMatchObject({ kind: 'arrow', arrowId: 'k1' });
    const s1 = applyMove(l20, s0, 'k1').state;
    expect(checkMove(l20, s1, 's').ok).toBe(true);
    const s2 = applyMove(l20, s1, 's').state;
    expect(checkMove(l20, s2, 'a').ok).toBe(true);
  });
});

describe('可调头箭头（⇄）', () => {
  const l21 = LEVELS[20];
  const l22 = LEVELS[21];

  it('l21 初始向右被关闭闸门挡住，调头后向左畅通', () => {
    const s0 = initialState(l21);
    expect(checkMove(l21, s0, 'r').blocker).toEqual({
      kind: 'gate',
      group: 'diamond',
      cell: { x: 5, y: 3 },
    });
    const turned = applyTurn(l21, s0, 'r');
    expect(turned.ok).toBe(true);
    expect(turned.state.turned).toEqual(['r']);
    expect(turned.state.remaining).toEqual(s0.remaining);
    expect(turned.state.open).toEqual(s0.open);
    expect(checkMove(l21, turned.state, 'r').ok).toBe(true);
  });

  it('调头占格不变、头尾互换；再调一次回到初始朝向', () => {
    const s0 = initialState(l21);
    const r = l21.arrows.find((a) => a.id === 'r')!;
    const s1 = applyTurn(l21, s0, 'r').state;
    const eff = { ...r, head: { x: 2, y: 3 }, dir: 'left' as const };
    expect(cellsOf(eff).map(cellKey).sort()).toEqual(cellsOf(r).map(cellKey).sort());
    const s2 = applyTurn(l21, s1, 'r').state;
    expect(s2.turned).toEqual([]);
    expect(checkMove(l21, s2, 'r').ok).toBe(false);
  });

  it('l21 不调头永远无解：开关被 ⇄ 自己挡着', () => {
    const s0 = initialState(l21);
    expect(checkMove(l21, s0, 's').blocker).toMatchObject({ kind: 'arrow', arrowId: 'r' });
    const result = solve(l21, s0);
    expect(result.solvable).toBe(true);
    expect(result.solution!.some((op) => op.kind === 'turn' && op.arrowId === 'r')).toBe(true);
  });

  it('l22 右路永远打不开，必须先疏通左路再调头', () => {
    let state = initialState(l22);
    state = applyMove(l22, state, 't').state;
    state = applyMove(l22, state, 'c').state;
    expect(checkMove(l22, state, 'r').blocker).toMatchObject({ kind: 'gate', group: 'diamond' });
    expect(checkMove(l22, state, 's').blocker).toMatchObject({ kind: 'arrow', arrowId: 'r' });
    state = applyTurn(l22, state, 'r').state;
    expect(checkMove(l22, state, 'r').ok).toBe(true);
    state = applyMove(l22, state, 'r').state;
    expect(checkMove(l22, state, 's').ok).toBe(true);
  });

  it('调头是可撤销的一步：撤销恢复朝向', () => {
    const s0 = initialState(l21);
    const s1 = applyTurn(l21, s0, 'r').state;
    expect(s1.turned).toEqual(['r']);
    // 会话层快照撤销在 solver-session 测试中覆盖；这里验证状态可逆
    const back = applyTurn(l21, s1, 'r').state;
    expect(back).toEqual(s0);
  });
});

describe('接力箭头（A 带 B）', () => {
  const l23 = LEVELS[22];
  const l24 = LEVELS[23];

  it('l23 初始接力被 B 前的闸门挡住，指出具体阻挡物', () => {
    const s0 = initialState(l23);
    const check = checkRelay(l23, s0, 'A');
    expect(check.ok).toBe(false);
    expect(check.failedId).toBe('B');
    expect(check.blocker).toEqual({ kind: 'gate', group: 'diamond', cell: { x: 4, y: 3 } });
  });

  it('接力失败状态完全不变：A、B 都留在原地', () => {
    const s0 = initialState(l23);
    const result = applyRelay(l23, s0, 'A');
    expect(result.ok).toBe(false);
    expect(result.state).toBe(s0);
    expect(result.state.remaining).toEqual(initialState(l23).remaining);
    expect(result.state.open.diamond).toBe(false);
  });

  it('跟随箭不可单独移动：legalMoves 不含 B', () => {
    const s0 = initialState(l23);
    expect(legalMoves(l23, s0)).not.toContain('B');
    expect(legalMoves(l23, s0)).toContain('C');
  });

  it('开关 C 离场后接力成功：A、B 一次全部离场', () => {
    let state = applyMove(l23, initialState(l23), 'C').state;
    expect(state.open.diamond).toBe(true);
    const result = applyRelay(l23, state, 'A');
    expect(result.ok).toBe(true);
    state = result.state;
    expect(state.remaining).toEqual(
      initialState(l23).remaining.filter((id) => !['A', 'B', 'C'].includes(id)),
    );
    state = finish(l23, state);
    expect(isWin(l23, state)).toBe(true);
  });

  it('l24 长链：s → 接力A/B → t → 接力C/D', () => {
    let state = initialState(l24);
    expect(checkRelay(l24, state, 'A').ok).toBe(false);
    expect(checkMove(l24, state, 't').blocker).toMatchObject({ kind: 'arrow', arrowId: 'B' });
    state = applyMove(l24, state, 's').state;
    state = applyRelay(l24, state, 'A').state;
    expect(state.remaining).toEqual(
      initialState(l24).remaining.filter((id) => !['s', 'A', 'B'].includes(id)),
    );
    expect(checkMove(l24, state, 't').ok).toBe(true);
    state = applyMove(l24, state, 't').state;
    expect(checkRelay(l24, state, 'C').ok).toBe(true);
    state = applyRelay(l24, state, 'C').state;
    state = finish(l24, state);
    expect(isWin(l24, state)).toBe(true);
  });

  it('l24 接力 C/D 在 ○ 门关闭时失败且状态不变', () => {
    let state = initialState(l24);
    state = applyMove(l24, state, 's').state;
    state = applyRelay(l24, state, 'A').state;
    const before = state;
    const check = checkRelay(l24, state, 'C');
    expect(check.ok).toBe(false);
    expect(check.failedId).toBe('D');
    expect(check.blocker).toMatchObject({ kind: 'gate', group: 'circle' });
    const result = applyRelay(l24, state, 'C');
    expect(result.ok).toBe(false);
    expect(result.state).toBe(before);
  });
});

describe('护送与点灯', () => {
  const l25 = LEVELS[24];
  const l26 = LEVELS[25];
  const l27 = LEVELS[26];

  it('l25 送出 ★ 即通关，其他箭头可留在棋盘', () => {
    let state = initialState(l25);
    state = applyMove(l25, state, 's').state;
    state = applyMove(l25, state, 'b').state;
    expect(isWin(l25, state)).toBe(false);
    state = applyMove(l25, state, 'e').state;
    expect(state.remaining).toEqual(
      initialState(l25).remaining.filter((id) => !['s', 'b', 'e'].includes(id)),
    );
    expect(isWin(l25, state)).toBe(true);
  });

  it('l25 求解器按护送目标判定：解法不必清空全部箭头', () => {
    const result = solve(l25, initialState(l25));
    expect(result.solvable).toBe(true);
    let state = initialState(l25);
    for (const op of result.solution!) {
      state = applyMove(l25, state, op.arrowId).state;
    }
    expect(isWin(l25, state)).toBe(true);
    expect(state.remaining).not.toContain('e');
  });

  it('l26 向右直接发射可通关但灯不亮', () => {
    let state = applyMove(l26, initialState(l26), 'r').state;
    expect(state.lit).toEqual([]);
    state = applyMove(l26, state, 'c').state;
    state = applyMove(l26, state, 'a').state;
    state = finish(l26, state);
    expect(isWin(l26, state)).toBe(true);
    expect(allLampsLit(l26, state)).toBe(false);
  });

  it('l26 先放 c 再调头向左：经过灯即点亮，通关时全亮', () => {
    let state = applyMove(l26, initialState(l26), 'c').state;
    state = applyTurn(l26, state, 'r').state;
    state = applyMove(l26, state, 'r').state;
    expect(state.lit).toEqual(['0,3']);
    expect(state.remaining).toEqual(
      initialState(l26).remaining.filter((id) => !['c', 'r'].includes(id)),
    );
    expect(isWin(l26, state)).toBe(false);
    state = applyMove(l26, state, 'a').state;
    state = finish(l26, state);
    expect(isWin(l26, state)).toBe(true);
    expect(allLampsLit(l26, state)).toBe(true);
  });

  it('l27 接力经过下方灯、⇄ 向右经过上方灯：两盏全亮', () => {
    let state = initialState(l27);
    state = applyMove(l27, state, 's').state;
    state = applyRelay(l27, state, 'A').state;
    expect(state.lit).toContain('5,6');
    state = applyMove(l27, state, 'r').state;
    expect(state.lit).toContain('6,4');
    state = applyMove(l27, state, 'd').state;
    state = finish(l27, state);
    expect(isWin(l27, state)).toBe(true);
    expect(allLampsLit(l27, state)).toBe(true);
  });

  it('点灯依据绳随路线：sweptCells 覆盖灯格才点亮', () => {
    const r = l26.arrows.find((a) => a.id === 'r')!;
    const rightSwept = sweptCells(l26, r).map(cellKey);
    expect(rightSwept).not.toContain('0,3');
    const turnedState = applyTurn(l26, initialState(l26), 'r').state;
    const eff = { ...r, head: { x: 2, y: 3 }, dir: 'left' as const };
    expect(sweptCells(l26, eff).map(cellKey)).toContain('0,3');
    expect(turnedState.turned).toEqual(['r']);
  });
});

describe('新手教学（不计入 27 关）', () => {
  it('数据合法、小棋盘、三次点击可清空', () => {
    expect(validateLevel(TUTORIAL_LEVEL)).toEqual([]);
    expect(TUTORIAL_LEVEL.width * TUTORIAL_LEVEL.height).toBeLessThanOrEqual(15);
    expect(LEVELS.map((l) => l.id)).not.toContain('tutorial');
    const result = solve(TUTORIAL_LEVEL, initialState(TUTORIAL_LEVEL));
    expect(result.solvable).toBe(true);
    expect(result.solution).toHaveLength(3);
    const order = result.solution!.map((op) => op.arrowId);
    expect([...order].sort()).toEqual(['A', 'B', 'C']);
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('B'));
  });

  it('直观展示"一支箭头挡住另一支"：B 被 C 挡，移走 C 后 B 畅通', () => {
    const s0 = initialState(TUTORIAL_LEVEL);
    expect(checkMove(TUTORIAL_LEVEL, s0, 'B').blocker).toMatchObject({ kind: 'arrow', arrowId: 'C' });
    expect(checkMove(TUTORIAL_LEVEL, s0, 'A').ok).toBe(true);
    const s1 = applyMove(TUTORIAL_LEVEL, s0, 'C').state;
    expect(checkMove(TUTORIAL_LEVEL, s1, 'B').ok).toBe(true);
    const s2 = applyMove(TUTORIAL_LEVEL, s1, 'B').state;
    const s3 = applyMove(TUTORIAL_LEVEL, s2, 'A').state;
    expect(isWin(TUTORIAL_LEVEL, s3)).toBe(true);
  });
});