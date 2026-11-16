import { describe, expect, it } from 'vitest';
import { applyMove, checkMove, initialState, isWin } from '../../src/core/rules';
import { solve } from '../../src/core/solver';
import { LEVELS } from '../../src/levels/levels';
import { validateLevel } from '../../src/levels/validate';

describe('12 个正式关卡', () => {
  it('数量与编号连续', () => {
    expect(LEVELS).toHaveLength(12);
    expect(LEVELS.map((l) => l.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(12);
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
        for (const id of result.solution!) {
          expect(checkMove(level, state, id).ok).toBe(true);
          state = applyMove(level, state, id).state;
        }
        expect(isWin(state)).toBe(true);
      });

      it('每支箭头的提示首步执行后仍可通关', () => {
        const result = solve(level, initialState(level));
        const first = result.solution![0];
        const next = applyMove(level, initialState(level), first).state;
        expect(solve(level, next).solvable).toBe(true);
      });
    });
  }

  it('关卡分组符合教学规划（1-3 无机关，4-9 一组，10-12 两组）', () => {
    for (const l of LEVELS.slice(0, 3)) expect(l.mechanisms).toHaveLength(0);
    for (const l of LEVELS.slice(3, 9)) expect(l.mechanisms).toHaveLength(1);
    for (const l of LEVELS.slice(9, 12)) expect(l.mechanisms).toHaveLength(2);
  });
});