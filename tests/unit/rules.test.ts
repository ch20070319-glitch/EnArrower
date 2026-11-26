import { describe, expect, it } from 'vitest';
import {
  applyMove,
  cellsOf,
  checkMove,
  exitDistance,
  initialState,
  isWin,
  legalMoves,
} from '../../src/core/rules';
import { ArrowDef, Dir, LevelDef } from '../../src/core/types';

function miniLevel(arrows: ArrowDef[], mechanisms: LevelDef['mechanisms'] = [], w = 6, h = 4): LevelDef {
  return { id: 'test', chapter: 'basic', name: 'test', goal: '', width: w, height: h, arrows, mechanisms };
}

describe('占用格推导', () => {
  it('箭身坐标串统一尾→头，直箭头从头部沿朝向反方向延伸', () => {
    expect(cellsOf({ id: 'x', head: { x: 3, y: 1 }, dir: 'right', len: 3 })).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);
    expect(cellsOf({ id: 'x', head: { x: 1, y: 1 }, dir: 'up', len: 2 })).toEqual([
      { x: 1, y: 2 },
      { x: 1, y: 1 },
    ]);
    expect(cellsOf({ id: 'x', head: { x: 1, y: 1 }, dir: 'left', len: 2 })).toEqual([
      { x: 2, y: 1 },
      { x: 1, y: 1 },
    ]);
    expect(cellsOf({ id: 'x', head: { x: 1, y: 1 }, dir: 'down', len: 2 })).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
  });
});

describe('四向移动与不同长度', () => {
  const dirs: Array<{ dir: Dir; head: { x: number; y: number }; len: 1 | 2 | 3 }> = [
    { dir: 'right', head: { x: 2, y: 1 }, len: 1 },
    { dir: 'right', head: { x: 2, y: 1 }, len: 3 },
    { dir: 'left', head: { x: 3, y: 1 }, len: 2 },
    { dir: 'up', head: { x: 1, y: 2 }, len: 3 },
    { dir: 'down', head: { x: 1, y: 1 }, len: 2 },
  ];
  for (const { dir, head, len } of dirs) {
    it(`${dir} 长度 ${len} 无遮挡时可离场`, () => {
      const level = miniLevel([{ id: 'a', head, dir, len }]);
      const state = initialState(level);
      expect(checkMove(level, state, 'a').ok).toBe(true);
      const result = applyMove(level, state, 'a');
      expect(result.ok).toBe(true);
      expect(isWin(level, result.state)).toBe(true);
    });
  }

  it('自身原占用格不误判为阻挡（长度 3 紧贴边界）', () => {
    const level = miniLevel([{ id: 'a', head: { x: 2, y: 0 }, dir: 'right', len: 3 }]);
    expect(checkMove(level, initialState(level), 'a').ok).toBe(true);
  });

  it('边缘朝向界外的箭头立即可走', () => {
    const level = miniLevel([{ id: 'a', head: { x: 0, y: 1 }, dir: 'left', len: 1 }]);
    expect(checkMove(level, initialState(level), 'a').ok).toBe(true);
  });
});

describe('阻挡判定', () => {
  it('被其他箭头阻挡并指出实际阻挡物', () => {
    const level = miniLevel([
      { id: 'a', head: { x: 0, y: 1 }, dir: 'right', len: 1 },
      { id: 'b', head: { x: 3, y: 1 }, dir: 'up', len: 1 },
    ]);
    const check = checkMove(level, initialState(level), 'a');
    expect(check.ok).toBe(false);
    expect(check.blocker).toEqual({ kind: 'arrow', arrowId: 'b', cell: { x: 3, y: 1 } });
  });

  it('多格箭身的任意一格都构成阻挡', () => {
    const level = miniLevel([
      { id: 'a', head: { x: 0, y: 1 }, dir: 'right', len: 1 },
      { id: 'b', head: { x: 4, y: 2 }, dir: 'down', len: 3 },
    ]);
    const check = checkMove(level, initialState(level), 'a');
    expect(check.ok).toBe(false);
    expect(check.blocker?.kind).toBe('arrow');
  });

  it('被阻挡时状态不变、不切换机关', () => {
    const level = miniLevel(
      [
        { id: 'a', head: { x: 0, y: 1 }, dir: 'right', len: 1, group: 'diamond' },
        { id: 'b', head: { x: 3, y: 1 }, dir: 'up', len: 1 },
      ],
      [{ group: 'diamond', initialOpen: true, gates: [{ x: 5, y: 3 }] }],
    );
    const state = initialState(level);
    const result = applyMove(level, state, 'a');
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.state.open.diamond).toBe(true);
    expect(result.state.remaining).toEqual(['a', 'b']);
  });
});

describe('闸门碰撞', () => {
  const gateLevel = (initialOpen: boolean) =>
    miniLevel(
      [
        { id: 'a', head: { x: 0, y: 1 }, dir: 'right', len: 2 },
        { id: 's', head: { x: 0, y: 0 }, dir: 'right', len: 1, group: 'diamond' },
      ],
      [{ group: 'diamond', initialOpen, gates: [{ x: 3, y: 1 }] }],
    );

  it('关闭闸门阻挡，开启闸门可通过', () => {
    const closed = gateLevel(false);
    const check = checkMove(closed, initialState(closed), 'a');
    expect(check.ok).toBe(false);
    expect(check.blocker).toEqual({ kind: 'gate', group: 'diamond', cell: { x: 3, y: 1 } });
    const open = gateLevel(true);
    expect(checkMove(open, initialState(open), 'a').ok).toBe(true);
  });

  it('开关不能先开自己控制的门再穿过去', () => {
    const level = miniLevel(
      [{ id: 's', head: { x: 0, y: 1 }, dir: 'right', len: 1, group: 'diamond' }],
      [{ group: 'diamond', initialOpen: false, gates: [{ x: 3, y: 1 }] }],
    );
    const result = applyMove(level, initialState(level), 's');
    expect(result.ok).toBe(false);
    expect(result.state.open.diamond).toBe(false);
  });

  it('成功离场只切换一次且只影响本组', () => {
    const level = miniLevel(
      [
        { id: 's', head: { x: 0, y: 0 }, dir: 'right', len: 1, group: 'diamond' },
        { id: 't', head: { x: 0, y: 3 }, dir: 'right', len: 1, group: 'circle' },
      ],
      [
        { group: 'diamond', initialOpen: false, gates: [{ x: 3, y: 1 }, { x: 4, y: 2 }] },
        { group: 'circle', initialOpen: true, gates: [{ x: 5, y: 3 }] },
      ],
    );
    const result = applyMove(level, initialState(level), 's');
    expect(result.ok).toBe(true);
    expect(result.toggledGroup).toBe('diamond');
    expect(result.state.open.diamond).toBe(true);
    expect(result.state.open.circle).toBe(true);
  });

  it('普通箭头离场不改变闸门', () => {
    const level = miniLevel(
      [{ id: 'a', head: { x: 0, y: 0 }, dir: 'right', len: 1 }],
      [{ group: 'diamond', initialOpen: false, gates: [{ x: 3, y: 2 }] }],
    );
    const result = applyMove(level, initialState(level), 'a');
    expect(result.ok).toBe(true);
    expect(result.toggledGroup).toBeUndefined();
    expect(result.state.open.diamond).toBe(false);
  });

  it('最后一支箭头离场后即使关门也通关', () => {
    const level = miniLevel(
      [{ id: 's', head: { x: 0, y: 0 }, dir: 'right', len: 1, group: 'diamond' }],
      [{ group: 'diamond', initialOpen: true, gates: [{ x: 3, y: 2 }] }],
    );
    const result = applyMove(level, initialState(level), 's');
    expect(result.ok).toBe(true);
    expect(result.state.open.diamond).toBe(false);
    expect(isWin(level, result.state)).toBe(true);
  });
});

describe('离场几何', () => {
  it('exitDistance 等于尾部完全出界的格数', () => {
    const level = miniLevel([], [], 5, 3);
    expect(exitDistance(level, { id: 'x', head: { x: 0, y: 0 }, dir: 'right', len: 1 })).toBe(5);
    expect(exitDistance(level, { id: 'x', head: { x: 2, y: 0 }, dir: 'right', len: 3 })).toBe(5);
    expect(exitDistance(level, { id: 'x', head: { x: 3, y: 0 }, dir: 'left', len: 2 })).toBe(5);
    expect(exitDistance(level, { id: 'x', head: { x: 0, y: 2 }, dir: 'up', len: 1 })).toBe(3);
    expect(exitDistance(level, { id: 'x', head: { x: 0, y: 1 }, dir: 'down', len: 2 })).toBe(3);
  });
});

describe('合法动作枚举', () => {
  it('legalMoves 只包含当前可离场箭头', () => {
    const level = miniLevel([
      { id: 'a', head: { x: 0, y: 1 }, dir: 'right', len: 1 },
      { id: 'b', head: { x: 3, y: 1 }, dir: 'up', len: 1 },
    ]);
    expect(legalMoves(level, initialState(level))).toEqual(['b']);
  });
});