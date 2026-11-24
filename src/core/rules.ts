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

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/**
 * ⇄ 箭头调头后的等效定义：沿原轴翻转 180°，头尾互换、占格不变。
 * 第一轮可调头箭头均为直箭头，等效定义仍是直箭头。
 */
export function effectiveArrow(arrow: ArrowDef, state: GameState): ArrowDef {
  if (!arrow.reversible || !(state.turned ?? []).includes(arrow.id)) return arrow;
  const cells = cellsOf(arrow);
  return { ...arrow, head: { ...cells[0] }, dir: OPPOSITE[headDirOf(arrow)], path: undefined };
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
    turned: [],
    lit: [],
  };
}

export function cloneState(state: GameState): GameState {
  return {
    levelId: state.levelId,
    remaining: [...state.remaining],
    open: { ...state.open },
    turned: [...(state.turned ?? [])],
    lit: [...(state.lit ?? [])],
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
  const arrow = effectiveArrow(arrowById(level, arrowId), state);
  const cells = cellsOf(arrow);
  const head = cells[cells.length - 1];
  const v = DIR_VEC[headDirOf(arrow)];
  const occupied = new Map<string, string>();
  for (const id of state.remaining) {
    if (id === arrowId) continue;
    for (const c of cellsOf(effectiveArrow(arrowById(level, id), state))) {
      occupied.set(cellKey(c), id);
    }
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
  next.turned = next.turned.filter((id) => id !== arrowId);
  const arrow = arrowById(level, arrowId);
  let toggledGroup: GroupId | undefined;
  if (arrow.group) {
    next.open[arrow.group] = !next.open[arrow.group];
    toggledGroup = arrow.group;
  }
  if (level.lamps?.length) {
    const lamps = new Set(level.lamps.map(cellKey));
    for (const c of sweptCells(level, effectiveArrow(arrow, state))) {
      const key = cellKey(c);
      if (lamps.has(key) && !next.lit.includes(key)) next.lit.push(key);
    }
  }
  return { ok: true, state: next, toggledGroup };
}

/** 调头：仅 ⇄ 箭头、原地翻转，不移动、不离场、不切换机关；永远可执行。 */
export function applyTurn(level: LevelDef, state: GameState, arrowId: string): MoveResult {
  const arrow = arrowById(level, arrowId);
  if (!arrow.reversible || !state.remaining.includes(arrowId)) {
    return { ok: false, state };
  }
  const next = cloneState(state);
  next.turned = next.turned.includes(arrowId)
    ? next.turned.filter((id) => id !== arrowId)
    : [...next.turned, arrowId];
  return { ok: true, state: next };
}

/** 护送关：★ 离场即胜；普通关：清空棋盘。灯不影响胜负。 */
export function isWin(level: LevelDef, state: GameState): boolean {
  if (level.escort) return !state.remaining.includes(level.escort);
  return state.remaining.length === 0;
}

/** 全部灯是否点亮（通关额外反馈用）。 */
export function allLampsLit(level: LevelDef, state: GameState): boolean {
  if (!level.lamps?.length) return false;
  return level.lamps.every((c) => (state.lit ?? []).includes(cellKey(c)));
}

/** 接力对查询：id 作为领头或跟随所在的接力。 */
export function relayOf(level: LevelDef, id: string): { leader: string; follower: string } | undefined {
  return (level.relays ?? []).find((r) => r.leader === id || r.follower === id);
}

export interface RelayCheck extends MoveCheck {
  /** 预演中实际被挡的那支箭（A 或 B）。 */
  failedId?: string;
}

/**
 * 接力预演：A 离场 → 结算 A 的机关 → B 尝试。
 * 任一步被挡则整体失败并指出具体阻挡物；成功时不产生中间状态。
 */
export function checkRelay(level: LevelDef, state: GameState, leaderId: string): RelayCheck {
  const relay = (level.relays ?? []).find((r) => r.leader === leaderId);
  if (!relay) return { ok: false, failedId: leaderId };
  const first = checkMove(level, state, relay.leader);
  if (!first.ok) return { ok: false, blocker: first.blocker, failedId: relay.leader };
  const mid = applyMove(level, state, relay.leader).state;
  const second = checkMove(level, mid, relay.follower);
  if (!second.ok) return { ok: false, blocker: second.blocker, failedId: relay.follower };
  return { ok: true };
}

/** 接力提交：一次操作同时移除 A、B 并结算各自机关；失败时状态完全不变。 */
export function applyRelay(level: LevelDef, state: GameState, leaderId: string): MoveResult {
  const check = checkRelay(level, state, leaderId);
  if (!check.ok) return { ok: false, blocker: check.blocker, state };
  const relay = (level.relays ?? []).find((r) => r.leader === leaderId)!;
  const first = applyMove(level, state, relay.leader);
  const second = applyMove(level, first.state, relay.follower);
  return { ok: true, state: second.state, toggledGroup: first.toggledGroup ?? second.toggledGroup };
}

export function legalMoves(level: LevelDef, state: GameState): string[] {
  const followers = new Set((level.relays ?? []).map((r) => r.follower));
  const leaders = new Set((level.relays ?? []).map((r) => r.leader));
  return state.remaining.filter((id) => {
    if (followers.has(id)) return false;
    if (leaders.has(id)) return checkRelay(level, state, id).ok;
    return checkMove(level, state, id).ok;
  });
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
  const turned = [...(state.turned ?? [])].sort().join('.');
  return `${[...state.remaining].sort().join('.')}|${flags}|${turned}`;
}