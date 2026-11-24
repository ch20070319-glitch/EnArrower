import { describe, expect, it } from 'vitest';
import { applyMove, checkMove, initialState, isWin, legalMoves, stateKey } from '../../src/core/rules';
import { GameSession } from '../../src/core/session';
import { hint, solve } from '../../src/core/solver';
import { LEVELS, SAMPLE_LEVEL } from '../../src/levels/levels';

describe('固定样例：需求文档预期行为', () => {
  it('初始 B 被 C 阻挡', () => {
    const check = checkMove(SAMPLE_LEVEL, initialState(SAMPLE_LEVEL), 'B');
    expect(check.ok).toBe(false);
    expect(check.blocker).toEqual({ kind: 'arrow', arrowId: 'C', cell: { x: 2, y: 2 } });
  });

  it('C → B → A 可以通关', () => {
    const session = new GameSession(SAMPLE_LEVEL);
    for (const id of ['C', 'B', 'A']) {
      const result = session.commitMove(id);
      expect(result.ok).toBe(true);
    }
    expect(session.won).toBe(true);
  });

  it('先 A 会关门，当前状态不再有完整解法', () => {
    const session = new GameSession(SAMPLE_LEVEL);
    expect(session.commitMove('A').ok).toBe(true);
    expect(session.state.open.diamond).toBe(false);
    const result = solve(SAMPLE_LEVEL, session.state);
    expect(result.solvable).toBe(false);
    expect(result.solution).toBeNull();
  });

  it('A → C 后，B 被关闭的闸门阻挡', () => {
    const session = new GameSession(SAMPLE_LEVEL);
    session.commitMove('A');
    session.commitMove('C');
    const check = checkMove(SAMPLE_LEVEL, session.state, 'B');
    expect(check.ok).toBe(false);
    expect(check.blocker).toEqual({ kind: 'gate', group: 'diamond', cell: { x: 3, y: 2 } });
  });

  it('撤销同时恢复箭头和闸门状态', () => {
    const session = new GameSession(SAMPLE_LEVEL);
    session.commitMove('A');
    expect(session.state.open.diamond).toBe(false);
    expect(session.undo()).toBe(true);
    expect(session.state.remaining).toEqual(['A', 'B', 'C']);
    expect(session.state.open.diamond).toBe(true);
    expect(session.canUndo).toBe(false);
  });

  it('先 A 后提示：即使 C 可移动也识别为无解', () => {
    const session = new GameSession(SAMPLE_LEVEL);
    session.commitMove('A');
    expect(legalMoves(SAMPLE_LEVEL, session.state)).toContain('C');
    expect(hint(SAMPLE_LEVEL, session.state)).toEqual({ kind: 'dead-end' });
  });
});

describe('求解器与提示', () => {
  it('初始样例有解，提示的箭头执行后仍可通关', () => {
    const state = initialState(SAMPLE_LEVEL);
    const h = hint(SAMPLE_LEVEL, state);
    expect(h.kind).toBe('move');
    if (h.kind !== 'move') return;
    expect(checkMove(SAMPLE_LEVEL, state, h.arrowId).ok).toBe(true);
    const next = applyMove(SAMPLE_LEVEL, state, h.arrowId).state;
    expect(solve(SAMPLE_LEVEL, next).solvable).toBe(true);
  });

  it('中途状态提示仍保持可解', () => {
    const session = new GameSession(SAMPLE_LEVEL);
    session.commitMove('C');
    const h = hint(SAMPLE_LEVEL, session.state);
    expect(h.kind).toBe('move');
    if (h.kind !== 'move') return;
    const next = applyMove(SAMPLE_LEVEL, session.state, h.arrowId).state;
    expect(solve(SAMPLE_LEVEL, next).solvable).toBe(true);
  });

  it('通关状态提示返回 won', () => {
    const session = new GameSession(SAMPLE_LEVEL);
    for (const id of ['C', 'B', 'A']) session.commitMove(id);
    expect(hint(SAMPLE_LEVEL, session.state)).toEqual({ kind: 'won' });
  });

  it('记忆化搜索在状态空间内终止（双开关关卡）', () => {
    const level = {
      ...SAMPLE_LEVEL,
      id: 'double',
      arrows: [
        ...SAMPLE_LEVEL.arrows,
        { id: 'D', head: { x: 4, y: 0 }, dir: 'down' as const, len: 1 as const, group: 'diamond' as const },
      ],
    };
    const result = solve(level, initialState(level));
    expect(result.visited).toBeLessThan(200);
    expect(typeof result.solvable).toBe('boolean');
  });
});

describe('会话：撤销 / 重开', () => {
  it('无限撤销逐步恢复完整状态', () => {
    const session = new GameSession(SAMPLE_LEVEL);
    session.commitMove('C');
    session.commitMove('B');
    session.commitMove('A');
    expect(session.won).toBe(true);
    expect(session.undo()).toBe(true);
    expect(session.state.remaining).toEqual(['A']);
    expect(session.state.open.diamond).toBe(true);
    expect(session.undo()).toBe(true);
    expect(session.state.remaining).toEqual(['A', 'B']);
    expect(session.undo()).toBe(true);
    expect(session.state.remaining).toEqual(['A', 'B', 'C']);
    expect(session.canUndo).toBe(false);
    expect(session.undo()).toBe(false);
  });

  it('被阻挡的操作不进入历史', () => {
    const session = new GameSession(SAMPLE_LEVEL);
    const result = session.commitMove('B');
    expect(result.ok).toBe(false);
    expect(session.canUndo).toBe(false);
  });

  it('重开恢复初始布局与门状态并清空历史', () => {
    const session = new GameSession(SAMPLE_LEVEL);
    session.commitMove('A');
    session.commitMove('C');
    session.restart();
    expect(session.state).toEqual(initialState(SAMPLE_LEVEL));
    expect(session.history).toEqual([]);
  });

  it('通关后可撤销最后一步', () => {
    const session = new GameSession(SAMPLE_LEVEL);
    for (const id of ['C', 'B', 'A']) session.commitMove(id);
    expect(isWin(SAMPLE_LEVEL, session.state)).toBe(true);
    session.undo();
    expect(session.won).toBe(false);
    expect(session.state.remaining).toEqual(['A']);
  });

  it('调头占一步历史，撤销恢复朝向且不触碰闸门', () => {
    const level = {
      ...SAMPLE_LEVEL,
      id: 'turn-session',
      arrows: [
        ...SAMPLE_LEVEL.arrows,
        { id: 'R', head: { x: 4, y: 4 }, dir: 'right' as const, len: 1 as const, reversible: true },
      ],
    };
    const session = new GameSession(level);
    const before = session.state;
    expect(session.commitTurn('R').ok).toBe(true);
    expect(session.state.turned).toEqual(['R']);
    expect(session.state.open).toEqual(before.open);
    expect(session.canUndo).toBe(true);
    session.undo();
    expect(session.state.turned).toEqual([]);
    expect(session.state.remaining).toEqual(before.remaining);
  });

  it('普通箭头不能调头，不进入历史', () => {
    const session = new GameSession(SAMPLE_LEVEL);
    expect(session.commitTurn('A').ok).toBe(false);
    expect(session.canUndo).toBe(false);
  });

  it('反复调头不会让求解器死循环（状态键含朝向）', () => {
    const level = {
      ...SAMPLE_LEVEL,
      id: 'turn-cycle',
      arrows: [
        { id: 'R', head: { x: 2, y: 2 }, dir: 'right' as const, len: 1 as const, reversible: true },
      ],
      mechanisms: [],
    };
    const result = solve(level, initialState(level));
    expect(result.solvable).toBe(true);
    expect(result.visited).toBeLessThan(20);
  });

  it('接力一次撤销完整恢复 A、B 与闸门', () => {
    const level = {
      ...SAMPLE_LEVEL,
      id: 'relay-session',
      arrows: [
        { id: 'A', head: { x: 0, y: 0 }, dir: 'right' as const, len: 1 as const, group: 'diamond' as const },
        { id: 'B', head: { x: 0, y: 1 }, dir: 'right' as const, len: 1 as const },
      ],
      mechanisms: [{ group: 'diamond' as const, initialOpen: false, gates: [{ x: 3, y: 1 }] }],
      relays: [{ leader: 'A', follower: 'B' }],
    };
    const session = new GameSession(level);
    // A 是 ◇ 开关：A 离场开门后 B 才能过 → 接力成功并切换机关
    const result = session.commitRelay('A');
    expect(result.ok).toBe(true);
    expect(session.state.remaining).toEqual([]);
    expect(session.state.open.diamond).toBe(true);
    expect(session.history).toHaveLength(1);
    session.undo();
    expect(session.state.remaining).toEqual(['A', 'B']);
    expect(session.state.open.diamond).toBe(false);
    expect(session.canUndo).toBe(false);
  });

  it('接力失败不进入历史', () => {
    const level = {
      ...SAMPLE_LEVEL,
      id: 'relay-fail',
      arrows: [
        { id: 'A', head: { x: 0, y: 0 }, dir: 'right' as const, len: 1 as const },
        { id: 'B', head: { x: 0, y: 1 }, dir: 'right' as const, len: 1 as const },
      ],
      mechanisms: [{ group: 'diamond' as const, initialOpen: false, gates: [{ x: 3, y: 1 }] }],
      relays: [{ leader: 'A', follower: 'B' }],
    };
    const session = new GameSession(level);
    const result = session.commitRelay('A');
    expect(result.ok).toBe(false);
    expect(session.canUndo).toBe(false);
    expect(session.state.remaining).toEqual(['A', 'B']);
  });

  it('点灯随撤销恢复：撤销发射后灯熄灭，再撤销恢复朝向', () => {
    const l26 = LEVELS[25];
    const session = new GameSession(l26);
    session.commitMove('c');
    session.commitTurn('r');
    expect(session.commitMove('r').ok).toBe(true);
    expect(session.state.lit).toEqual(['0,3']);
    session.undo();
    expect(session.state.lit).toEqual([]);
    expect(session.state.turned).toEqual(['r']);
    session.undo();
    expect(session.state.turned).toEqual([]);
  });

  it('护送关会话：★ 离场即 won，剩余箭头不影响', () => {
    const l25 = LEVELS[24];
    const session = new GameSession(l25);
    session.commitMove('s');
    session.commitMove('b');
    expect(session.won).toBe(false);
    expect(session.commitMove('e').ok).toBe(true);
    expect(session.won).toBe(true);
    expect(session.state.remaining).toEqual(['a']);
    session.undo();
    expect(session.won).toBe(false);
  });
});

describe('求解规模与状态键（新棋盘尺度）', () => {
  it('最大关卡 l20（8×12，9 箭含两条折线）搜索状态数受控', () => {
    const l20 = LEVELS[19];
    const result = solve(l20, initialState(l20));
    expect(result.solvable).toBe(true);
    expect(result.visited).toBeLessThan(500);
  });

  it('终局灯屋 l27（接力+调头+两盏灯）搜索状态数受控', () => {
    const l27 = LEVELS[26];
    const result = solve(l27, initialState(l27));
    expect(result.solvable).toBe(true);
    expect(result.visited).toBeLessThan(200);
  });

  it('灯状态不参与状态键：点灯不改变移动可能性', () => {
    const l26 = LEVELS[25];
    const s0 = initialState(l26);
    expect(stateKey({ ...s0, lit: ['0,3'] })).toBe(stateKey(s0));
  });

  it('27 关全量求解本机实测总耗时低于 1s（回归阈值，非承诺上限）', () => {
    const t0 = performance.now();
    for (const level of LEVELS) {
      expect(solve(level, initialState(level)).solvable).toBe(true);
    }
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});