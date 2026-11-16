export type Dir = 'up' | 'down' | 'left' | 'right';
export type GroupId = 'diamond' | 'circle';

export interface Cell {
  x: number;
  y: number;
}

export interface ArrowDef {
  id: string;
  head: Cell;
  dir: Dir;
  len: 1 | 2 | 3;
  group?: GroupId;
}

export interface MechanismDef {
  group: GroupId;
  initialOpen: boolean;
  gates: Cell[];
}

export interface LevelDef {
  id: string;
  index: number;
  name: string;
  goal: string;
  width: number;
  height: number;
  arrows: ArrowDef[];
  mechanisms: MechanismDef[];
}

/** 稳定游戏状态：只含规则事实，不含动画坐标、输入锁或回调。 */
export interface GameState {
  levelId: string;
  remaining: string[];
  open: Partial<Record<GroupId, boolean>>;
}

export type Blocker =
  | { kind: 'arrow'; arrowId: string; cell: Cell }
  | { kind: 'gate'; group: GroupId; cell: Cell };

export interface MoveCheck {
  ok: boolean;
  blocker?: Blocker;
}

export interface MoveResult {
  ok: boolean;
  blocker?: Blocker;
  state: GameState;
  toggledGroup?: GroupId;
}

export const DIR_VEC: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const GROUP_SYMBOL: Record<GroupId, string> = {
  diamond: '◇',
  circle: '○',
};