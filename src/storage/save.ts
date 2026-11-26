import { cloneState } from '../core/rules';
import { GameState, GroupId, LevelDef } from '../core/types';
import { DISPLAY_ORDER, LEVELS, TUTORIAL_LEVEL, levelById, nextLevelId } from '../levels/levels';

export const SAVE_KEY = 'enarrower.save';
export const SCHEMA_VERSION = 1;

export interface CurrentSave {
  levelId: string;
  state: GameState;
  history: GameState[];
}

export interface SaveData {
  schemaVersion: number;
  completed: string[];
  unlocked: string[];
  current: CurrentSave | null;
  /** 可选字段（schemaVersion 保持 1）：教学是否完成/跳过；曾全亮通关的关卡。 */
  tutorialDone?: boolean;
  lampBest?: string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultSave(): SaveData {
  return {
    schemaVersion: SCHEMA_VERSION,
    completed: [],
    unlocked: [LEVELS[0].id],
    current: null,
    tutorialDone: false,
    lampBest: [],
  };
}

/** 存档里 current 可指向教学关；正式进度列表只认 27 关。 */
function levelForSave(id: string): LevelDef | undefined {
  return id === TUTORIAL_LEVEL.id ? TUTORIAL_LEVEL : levelById(id);
}

function validState(v: unknown, level: LevelDef): v is GameState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  if (s.levelId !== level.id) return false;
  if (!Array.isArray(s.remaining)) return false;
  const ids = new Set(level.arrows.map((a) => a.id));
  const seen = new Set<string>();
  for (const id of s.remaining) {
    if (typeof id !== 'string' || !ids.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  if (typeof s.open !== 'object' || s.open === null) return false;
  const open = s.open as Record<string, unknown>;
  const groups = new Set(level.mechanisms.map((m) => m.group as string));
  for (const key of Object.keys(open)) {
    if (!groups.has(key) || typeof open[key] !== 'boolean') return false;
  }
  for (const g of groups) {
    if (typeof open[g] !== 'boolean') return false;
  }
  // 本轮新增字段：旧存档无 turned/lit 视为 []；存在时必须是合法子集。
  if (s.turned !== undefined) {
    if (!Array.isArray(s.turned)) return false;
    const reversible = new Set(level.arrows.filter((a) => a.reversible).map((a) => a.id));
    const seenTurned = new Set<string>();
    for (const id of s.turned) {
      if (typeof id !== 'string' || !reversible.has(id) || !seen.has(id) || seenTurned.has(id)) {
        return false;
      }
      seenTurned.add(id);
    }
  }
  if (s.lit !== undefined) {
    if (!Array.isArray(s.lit)) return false;
    const lampKeys = new Set((level.lamps ?? []).map((c) => `${c.x},${c.y}`));
    const seenLit = new Set<string>();
    for (const key of s.lit) {
      if (typeof key !== 'string' || !lampKeys.has(key) || seenLit.has(key)) return false;
      seenLit.add(key);
    }
  }
  return true;
}

function validIdList(v: unknown): v is string[] {
  return (
    Array.isArray(v) &&
    v.every((id) => typeof id === 'string' && levelById(id) !== undefined) &&
    new Set(v).size === v.length
  );
}

export interface LoadResult {
  data: SaveData;
  notice: string | null;
}

/** 读取并严格校验存档；任何异常都安全回退到默认进度，不抛错、不白屏。 */
export function loadSave(storage: StorageLike | null): LoadResult {
  if (!storage) {
    return { data: defaultSave(), notice: '浏览器存储不可用，进度仅在本次会话内有效。' };
  }
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { data: defaultSave(), notice: '无法读取本地存档，进度仅在本次会话内有效。' };
  }
  if (raw === null) return { data: defaultSave(), notice: null };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      return { data: defaultSave(), notice: '存档版本不匹配，已重新开始。' };
    }
    if (!validIdList(parsed.completed) || !validIdList(parsed.unlocked)) {
      return { data: defaultSave(), notice: '存档数据损坏，已重新开始。' };
    }
    const data: SaveData = {
      schemaVersion: SCHEMA_VERSION,
      completed: parsed.completed,
      unlocked: parsed.unlocked,
      current: null,
      tutorialDone: parsed.tutorialDone === true,
      lampBest: [],
    };
    if (parsed.lampBest !== undefined) {
      if (!validIdList(parsed.lampBest)) {
        return { data: defaultSave(), notice: '存档数据损坏，已重新开始。' };
      }
      data.lampBest = parsed.lampBest;
    }
    if (!data.unlocked.includes(LEVELS[0].id)) data.unlocked.push(LEVELS[0].id);
    for (const id of data.completed) {
      if (!data.unlocked.includes(id)) data.unlocked.push(id);
    }
    // 显示顺序重排后补齐解锁缺口：旧存档解锁到第 N 位，则前 N 位全部可玩（只增不减）。
    const maxPos = Math.max(...data.unlocked.map((id) => DISPLAY_ORDER.indexOf(id)));
    for (const id of DISPLAY_ORDER.slice(0, maxPos + 1)) {
      if (!data.unlocked.includes(id)) data.unlocked.push(id);
    }
    if (parsed.current !== null && parsed.current !== undefined) {
      const cur = parsed.current as Record<string, unknown>;
      const level = typeof cur.levelId === 'string' ? levelForSave(cur.levelId) : undefined;
      if (
        !level ||
        !validState(cur.state, level) ||
        !Array.isArray(cur.history) ||
        !cur.history.every((h) => validState(h, level))
      ) {
        return { data, notice: '进行中的存档与关卡不匹配，已保留解锁进度并重置当前关卡。' };
      }
      data.current = {
        levelId: level.id,
        state: cloneState(cur.state as GameState),
        history: (cur.history as GameState[]).map(cloneState),
      };
      if (level.id !== TUTORIAL_LEVEL.id && !data.unlocked.includes(level.id)) {
        data.unlocked.push(level.id);
      }
    }
    return { data, notice: null };
  } catch {
    return { data: defaultSave(), notice: '存档数据损坏，已重新开始。' };
  }
}

export interface WriteResult {
  ok: boolean;
  notice: string | null;
}

export function writeSave(storage: StorageLike | null, data: SaveData): WriteResult {
  if (!storage) {
    return { ok: false, notice: '浏览器存储不可用，本次进度可能无法保存。' };
  }
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return { ok: true, notice: null };
  } catch {
    return { ok: false, notice: '存档写入失败，游戏可继续，但本次进度可能无法保存。' };
  }
}

/** 通关后更新完成与解锁记录（按显示顺序解锁下一关）。教学关只记 tutorialDone。 */
export function recordCompletion(data: SaveData, levelId: string): void {
  if (levelId === TUTORIAL_LEVEL.id) {
    data.tutorialDone = true;
    return;
  }
  if (!data.completed.includes(levelId)) data.completed.push(levelId);
  if (!data.unlocked.includes(levelId)) data.unlocked.push(levelId);
  const next = nextLevelId(levelId);
  if (next && !data.unlocked.includes(next)) data.unlocked.push(next);
}

/** 全亮通关记入最佳成绩；之后的漏灯重玩不覆盖。 */
export function recordLampBest(data: SaveData, levelId: string): void {
  const best = data.lampBest ?? (data.lampBest = []);
  if (!best.includes(levelId)) best.push(levelId);
}

export function groupOpen(state: GameState, group: GroupId): boolean {
  return !!state.open[group];
}