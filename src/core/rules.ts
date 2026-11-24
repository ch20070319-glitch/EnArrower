import {
  ArrowDef,
  Cell,
  Dir,
  DIR_VEC,
  GameState,
  GroupId,
  LevelDef,
  MoveCheck,
  MoveResult,
} from './types';

/** 箭身坐标串统一尾→头；直箭头由 head/dir/len 反推，折线直接采用 path。 */
export function cellsOf(arrow: ArrowDef): Cell[] {
  if (arrow.path) return arrow.path.map((c) => ({ ...c }));
  const v = DIR_VEC[arrow.dir];
  const cells: Cell[] = [];
  for (let i = arrow.len - 1; i >= 0; i--) {
    cells.push({ x: arrow.head.x - v.x * i, y: arrow.head.y - v.y * i });
  }
  return cells;
}

/** 出口朝向 = 箭身最后一段的方向；直箭头即 def.dir。 */
export function headDirOf(arrow: ArrowDef): Dir {
  if (!arrow.path || arrow.path.length < 2) return arrow.dir;
  const a = arrow.path[arrow.path.length - 2];
  const b = arrow.path[arrow.path.length - 1];
  if (b.x > a.x) return 'right';
  if (b.x < a.x) return 'left';
  if (b.y > a.y) return 'down';
  return 'up';
}

/**
 * 绳随离场所经过的全部格：自身箭身 + 头部出口射线（棋盘内部分）。
 * 折线箭身依次沿前一段路线跟出，新占格恰为出口射线，故碰撞/预览/动画共用此路线。
 */
export function sweptCells(level: LevelDef, arrow: ArrowDef): Cell[] {
  const cells = cellsOf(arrow);
  const head = cells[cells.length - 1];
  const v = DIR_VEC[headDirOf(arrow)];
  const out: Cell[] = [...cells];
  let c = { x: head.x + v.x, y: head.y + v.y };
  while (inBoard(level, c)) {
    out.push({ ...c });
    c = { x: c.x + v.x, y: c.y + v.y };
  }
  return out;
}

export function cellKey(c: Cell): string {
  return `${c.x},${c.y}`;
}

export function inBoard(level: LevelDef, c: Cell): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < level.width && c.y < level.height;
}

export function arrowById(level: LevelDef, id: string): ArrowDef {
  const a = level.arrows.find((x) => x.id === id);
  if (!a) throw new Error(`arrow ${id} not in level ${level.id}`);
  return a;
}

export function initialState(level: LevelDef): GameState {
  const open: Partial<Record<GroupId, boolean>> = {};
  for (const m of level.mechanisms) open[m.group] = m.initialOpen;
  return {
    levelId: level.id,
    remaining: level.arrows.map((a) => a.id),
    open,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    levelId: state.levelId,
    remaining: [...state.remaining],
    open: { ...state.open },
  };
}

export function gateMap(level: LevelDef): Map<string, GroupId> {
  const map = new Map<string, GroupId>();
  for (const m of level.mechanisms) {
    for (const g of m.gates) map.set(cellKey(g), m.group);
  }
  return map;
}

/**
 * 箭头共线平移，只需检查头部前沿到棋盘边缘的射线。
 * 自身原占用格天然不在射线上；开启闸门可通过，关闭闸门与其他箭头阻挡。
 */
export function checkMove(level: LevelDef, state: GameState, arrowId: string): MoveCheck {
  const arrow = arrowById(level, arrowId);
  const cells = cellsOf(arrow);
  const head = cells[cells.length - 1];
  const v = DIR_VEC[headDirOf(arrow)];
  const occupied = new Map<string, string>();
  for (const id of state.remaining) {
    if (id === arrowId) continue;
    for (const c of cellsOf(arrowById(level, id))) occupied.set(cellKey(c), id);
  }
  const gates = gateMap(level);
  let c: Cell = { x: head.x + v.x, y: head.y + v.y };
  while (inBoard(level, c)) {
    const key = cellKey(c);
    const blockerArrow = occupied.get(key);
    if (blockerArrow) {
      return { ok: false, blocker: { kind: 'arrow', arrowId: blockerArrow, cell: { ...c } } };
    }
    const group = gates.get(key);
    if (group && !state.open[group]) {
      return { ok: false, blocker: { kind: 'gate', group, cell: { ...c } } };
    }
    c = { x: c.x + v.x, y: c.y + v.y };
  }
  return { ok: true };
}

/** 先按移动前门状态校验；成功离场后才切换机关，一次性返回新状态。 */
export function applyMove(level: LevelDef, state: GameState, arrowId: string): MoveResult {
  const check = checkMove(level, state, arrowId);
  if (!check.ok) {
    return { ok: false, blocker: check.blocker, state };
  }
  const next = cloneState(state);
  next.remaining = next.remaining.filter((id) => id !== arrowId);
  const arrow = arrowById(level, arrowId);
  let toggledGroup: GroupId | undefined;
  if (arrow.group) {
    next.open[arrow.group] = !next.open[arrow.group];
    toggledGroup = arrow.group;
  }
  return { ok: true, state: next, toggledGroup };
}

export function isWin(state: GameState): boolean {
  return state.remaining.length === 0;
}

export function legalMoves(level: LevelDef, state: GameState): string[] {
  return state.remaining.filter((id) => checkMove(level, state, id).ok);
}

/** 尾部完全出界所需的绳随路线格数，供动画使用（规则无关，仅几何）。 */
export function exitDistance(level: LevelDef, arrow: ArrowDef): number {
  const cells = cellsOf(arrow);
  const head = cells[cells.length - 1];
  const dir = headDirOf(arrow);
  const ray =
    dir === 'right'
      ? level.width - head.x
      : dir === 'left'
        ? head.x + 1
        : dir === 'down'
          ? level.height - head.y
          : head.y + 1;
  return ray + (cells.length - 1);
}

export function stateKey(state: GameState): string {
  const groups = Object.keys(state.open).sort() as GroupId[];
  const flags = groups.map((g) => (state.open[g] ? '1' : '0')).join('');
  return `${[...state.remaining].sort().join('.')}|${flags}`;
}