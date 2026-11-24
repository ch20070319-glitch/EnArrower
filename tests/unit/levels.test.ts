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
import { LEVELS } from '../../src/levels/levels';
import { validateLevel } from '../../src/levels/validate';

describe('27 个正式关卡', () => {
  it('数量与编号连续', () => {
    expect(LEVELS).toHaveLength(27);
    expect(LEVELS.map((l) => l.index)).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(27);
  });

  for (const level of LEVELS) {
    describe(`第 ${level.index} 关 ${level.name}`, () => {
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

  it('关卡分组符合教学规划（1-3 无机关，4-9 一组，10-12 两组，13-15 一组进阶，16-18 两组进阶，19 折线教学，20 大折线，21 调头教学，22 双向抉择，23 接力教学，24 接力长链，25 护送，26 灯与调头，27 终局灯屋）', () => {
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
    const k = l19.arrows.find((a) => a.id === 'k')!;
    const swept = sweptCells(l19, k).map(cellKey);
    expect(swept).toEqual([...k.path!.map(cellKey), '2,1', '2,0']);
    // 出口射线步数 = head.y+1 = 3（含头部出界那一步），绳随总长 = 3 + (5-1)
    expect(exitDistance(l19, k)).toBe(3 + (k.path!.length - 1));
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
    expect(result.state.remaining).toEqual(['A', 'B', 'C']);
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
    expect(state.remaining).toEqual([]);
    expect(isWin(l23, state)).toBe(true);
  });

  it('l24 长链：s → 接力A/B → t → 接力C/D', () => {
    let state = initialState(l24);
    expect(checkRelay(l24, state, 'A').ok).toBe(false);
    expect(checkMove(l24, state, 't').blocker).toMatchObject({ kind: 'arrow', arrowId: 'B' });
    state = applyMove(l24, state, 's').state;
    state = applyRelay(l24, state, 'A').state;
    expect(state.remaining).toEqual(['C', 'D', 't']);
    expect(checkMove(l24, state, 't').ok).toBe(true);
    state = applyMove(l24, state, 't').state;
    expect(checkRelay(l24, state, 'C').ok).toBe(true);
    state = applyRelay(l24, state, 'C').state;
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
    expect(state.remaining).toEqual(['a']);
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
    expect(isWin(l26, state)).toBe(true);
    expect(allLampsLit(l26, state)).toBe(false);
  });

  it('l26 先放 c 再调头向左：经过灯即点亮，通关时全亮', () => {
    let state = applyMove(l26, initialState(l26), 'c').state;
    state = applyTurn(l26, state, 'r').state;
    state = applyMove(l26, state, 'r').state;
    expect(state.lit).toEqual(['0,3']);
    expect(state.remaining).toEqual(['a']);
    expect(isWin(l26, state)).toBe(false);
    state = applyMove(l26, state, 'a').state;
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