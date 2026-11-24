import { applyMove, applyTurn, checkMove, cloneState, initialState, isWin } from './rules';
import { GameState, LevelDef, MoveResult } from './types';

/**
 * 一局游戏的规则会话：状态 + 撤销历史。纯数据，无 DOM。
 * 动画由界面层负责；这里只在动作确认成功时提交。
 */
export class GameSession {
  readonly level: LevelDef;
  state: GameState;
  history: GameState[] = [];

  constructor(level: LevelDef, state?: GameState, history?: GameState[]) {
    this.level = level;
    this.state = state ? cloneState(state) : initialState(level);
    if (history) this.history = history.map(cloneState);
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  get won(): boolean {
    return isWin(this.state);
  }

  /** 提交一次成功移动：先存快照，再一次性移除箭头并切换机关。 */
  commitMove(arrowId: string): MoveResult {
    const snapshot = cloneState(this.state);
    const result = applyMove(this.level, this.state, arrowId);
    if (result.ok) {
      this.history.push(snapshot);
      this.state = result.state;
    }
    return result;
  }

  /** 提交一次调头：与离场一样占一步撤销历史。 */
  commitTurn(arrowId: string): MoveResult {
    const snapshot = cloneState(this.state);
    const result = applyTurn(this.level, this.state, arrowId);
    if (result.ok) {
      this.history.push(snapshot);
      this.state = result.state;
    }
    return result;
  }

  check(arrowId: string) {
    return checkMove(this.level, this.state, arrowId);
  }

  undo(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.state = prev;
    return true;
  }

  restart(): void {
    this.state = initialState(this.level);
    this.history = [];
  }
}