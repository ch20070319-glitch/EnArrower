import { applyMove, isWin, legalMoves, stateKey } from './rules';
import { GameState, LevelDef } from './types';

export interface SolveResult {
  solvable: boolean;
  /** 一条完整解法（箭头 id 序列）；无解时为 null。 */
  solution: string[] | null;
  /** 搜索过的不同状态数，用于记录求解规模。 */
  visited: number;
}

/**
 * 记忆化深度优先搜索。第一版上限 12 支箭头、2 组机关，
 * 状态空间 <= 2^12 * 4，无需更复杂的求解系统。
 */
export function solve(level: LevelDef, start: GameState): SolveResult {
  const dead = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  function dfs(state: GameState): boolean {
    if (isWin(state)) return true;
    const key = stateKey(state);
    visited.add(key);
    if (dead.has(key)) return false;
    for (const id of legalMoves(level, state)) {
      const result = applyMove(level, state, id);
      path.push(id);
      if (dfs(result.state)) return true;
      path.pop();
    }
    dead.add(key);
    return false;
  }

  const solvable = dfs(start);
  return { solvable, solution: solvable ? [...path] : null, visited: visited.size };
}

export type HintResult =
  | { kind: 'move'; arrowId: string }
  | { kind: 'dead-end' }
  | { kind: 'won' };

/** 提示必须保证“执行后仍可通关”，不能把局部可移动当作正确下一步。 */
export function hint(level: LevelDef, state: GameState): HintResult {
  if (isWin(state)) return { kind: 'won' };
  const current = solve(level, state);
  if (!current.solvable || !current.solution) return { kind: 'dead-end' };
  return { kind: 'move', arrowId: current.solution[0] };
}