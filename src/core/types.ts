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
  /** 折线箭身：尾→头的相邻不重复坐标串（第一轮最多一个直角弯）。缺省时按 head/dir/len 推导直箭身。 */
  path?: Cell[];
  /** ⇄ 可调头箭头：第一轮仅直箭头；调头沿原轴翻转 180°，占格不变。 */
  reversible?: boolean;
}

export interface MechanismDef {
  group: GroupId;
  initialOpen: boolean;
  gates: Cell[];
}

/** 接力对：点击领头 A 依次送出 A、B；跟随箭 B 不可单独移动。 */
export interface RelayDef {
  leader: string;
  follower: string;
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
  relays?: RelayDef[];
  /** 护送目标：★ 箭头完全离场即通关，其余箭头可留在棋盘。缺省为清空棋盘。 */
  escort?: string;
  /** 可选点灯：箭头实际经过（绳随路线）即点亮；全亮给额外反馈，不影响通关。 */
  lamps?: Cell[];
}

/** 稳定游戏状态：只含规则事实，不含动画坐标、输入锁或回调。 */
export interface GameState {
  levelId: string;
  remaining: string[];
  open: Partial<Record<GroupId, boolean>>;
  /** 已调头（相对初始朝向翻转）的 ⇄ 箭头 id；旧存档缺省视为 []。 */
  turned: string[];
  /** 已点亮灯的坐标键 "x,y"；旧存档缺省视为 []。 */
  lit: string[];
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