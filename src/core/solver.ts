import { applyMove, applyTurn, isWin, legalMoves, stateKey } from './rules';
import { GameState, LevelDef } from './types';

export type SolverOp = { kind: 'exit' | 'turn'; arrowId: string };

export interface SolveResult {
  solvable: boolean;
  /** 一条完整解法（离场 / 调头操作序列）；无解时为 null。 */
  solution: SolverOp[] | null;
  /** 搜索过的不同状态数，用于记录求解规模。 */
  visited: number;
}

/**
 * 记忆化深度优先搜索。状态键含 remaining+闸门+调头朝向，
 * 调头可反复执行但重复状态会被 dead/visited 集合剪掉，不会死循环。
 */
export function solve(level: LevelDef, start: GameState): SolveResult {
  const dead = new Set<string>();
  const visited = new Set<string>();
  const path: SolverOp[] = [];
  const reversibleIds = level.arrows.filter((a) => a.reversible).map((a) => a.id);

  function dfs(state: GameState): boolean {
    if (isWin(state)) return true;
    const key = stateKey(state);
    visited.add(key);
    if (dead.has(key)) return false;
    for (const id of legalMoves(level, state)) {
      const result = applyMove(level, state, id);
      path.push({ kind: 'exit', arrowId: id });
      if (dfs(result.state)) return true;
      path.pop();
    }
    for (const id of reversibleIds) {
      if (!state.remaining.includes(id)) continue;
      const result = applyTurn(level, state, id);
      path.push({ kind: 'turn', arrowId: id });
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
  | { kind: 'turn'; arrowId: string }
  | { kind: 'dead-end' }
  | { kind: 'won' };

/** 提示必须保证“执行后仍可通关”，不能把局部可移动当作正确下一步。 */
export function hint(level: LevelDef, state: GameState): HintResult {
  if (isWin(state)) return { kind: 'won' };
  const current = solve(level, state);
  if (!current.solvable || !current.solution) return { kind: 'dead-end' };
  const first = current.solution[0];
  return first.kind === 'turn'
    ? { kind: 'turn', arrowId: first.arrowId }
    : { kind: 'move', arrowId: first.arrowId };
}