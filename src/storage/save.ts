import { cloneState } from '../core/rules';
import { GameState, GroupId, LevelDef } from '../core/types';
import { LEVELS, levelById } from '../levels/levels';

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
  };
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
    };
    if (!data.unlocked.includes(LEVELS[0].id)) data.unlocked.push(LEVELS[0].id);
    for (const id of data.completed) {
      if (!data.unlocked.includes(id)) data.unlocked.push(id);
    }
    if (parsed.current !== null && parsed.current !== undefined) {
      const cur = parsed.current as Record<string, unknown>;
      const level = typeof cur.levelId === 'string' ? levelById(cur.levelId) : undefined;
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
      if (!data.unlocked.includes(level.id)) data.unlocked.push(level.id);
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

/** 通关后更新完成与解锁记录（解锁下一关）。 */
export function recordCompletion(data: SaveData, levelId: string): void {
  if (!data.completed.includes(levelId)) data.completed.push(levelId);
  if (!data.unlocked.includes(levelId)) data.unlocked.push(levelId);
  const level = levelById(levelId);
  if (level) {
    const next = LEVELS.find((l) => l.index === level.index + 1);
    if (next && !data.unlocked.includes(next.id)) data.unlocked.push(next.id);
  }
}

export function groupOpen(state: GameState, group: GroupId): boolean {
  return !!state.open[group];
}