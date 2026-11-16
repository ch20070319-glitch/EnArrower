import { describe, expect, it } from 'vitest';
import { initialState } from '../../src/core/rules';
import { GameSession } from '../../src/core/session';
import { LEVELS } from '../../src/levels/levels';
import {
  SAVE_KEY,
  SCHEMA_VERSION,
  StorageLike,
  defaultSave,
  loadSave,
  recordCompletion,
  writeSave,
} from '../../src/storage/save';

function memoryStorage(seed?: string): StorageLike & { dump: Map<string, string> } {
  const dump = new Map<string, string>();
  if (seed !== undefined) dump.set(SAVE_KEY, seed);
  return {
    dump,
    getItem: (k) => dump.get(k) ?? null,
    setItem: (k, v) => void dump.set(k, v),
    removeItem: (k) => void dump.delete(k),
  };
}

describe('存档读写', () => {
  it('空存储返回默认进度且无提示', () => {
    const result = loadSave(memoryStorage());
    expect(result.data).toEqual(defaultSave());
    expect(result.notice).toBeNull();
  });

  it('完整往返：进度、当前状态与撤销历史', () => {
    const storage = memoryStorage();
    const level = LEVELS[3];
    const session = new GameSession(level);
    session.commitMove('s');
    const data = defaultSave();
    data.current = {
      levelId: level.id,
      state: session.state,
      history: session.history,
    };
    recordCompletion(data, 'l01');
    expect(writeSave(storage, data).ok).toBe(true);
    const loaded = loadSave(storage);
    expect(loaded.notice).toBeNull();
    expect(loaded.data.completed).toEqual(['l01']);
    expect(loaded.data.unlocked).toContain('l02');
    expect(loaded.data.current?.state.remaining).toEqual(['b', 'c']);
    expect(loaded.data.current?.history).toHaveLength(1);
    const restored = new GameSession(
      level,
      loaded.data.current!.state,
      loaded.data.current!.history,
    );
    expect(restored.canUndo).toBe(true);
    restored.undo();
    expect(restored.state.remaining).toEqual(['s', 'b', 'c']);
  });

  it('损坏 JSON 安全回退并提示', () => {
    const result = loadSave(memoryStorage('{broken json'));
    expect(result.data).toEqual(defaultSave());
    expect(result.notice).toContain('损坏');
  });

  it('版本不匹配安全回退并提示', () => {
    const result = loadSave(memoryStorage(JSON.stringify({ ...defaultSave(), schemaVersion: 99 })));
    expect(result.data).toEqual(defaultSave());
    expect(result.notice).toContain('版本');
  });

  it('关卡不匹配的当前状态被丢弃，保留解锁进度', () => {
    const data = defaultSave();
    recordCompletion(data, 'l01');
    data.current = {
      levelId: 'l01',
      state: { ...initialState(LEVELS[1]), levelId: 'l01' },
      history: [],
    };
    const storage = memoryStorage(JSON.stringify(data));
    const result = loadSave(storage);
    expect(result.notice).toContain('不匹配');
    expect(result.data.current).toBeNull();
    expect(result.data.completed).toEqual(['l01']);
  });

  it('历史中含非法状态时整体丢弃当前存档', () => {
    const data = defaultSave();
    const level = LEVELS[3];
    const state = initialState(level);
    data.current = {
      levelId: level.id,
      state,
      history: [{ ...state, remaining: ['不存在'] }],
    };
    const result = loadSave(memoryStorage(JSON.stringify(data)));
    expect(result.data.current).toBeNull();
    expect(result.notice).toContain('不匹配');
  });

  it('存储不可用时仍可游戏并给出提示', () => {
    const load = loadSave(null);
    expect(load.data).toEqual(defaultSave());
    expect(load.notice).toContain('不可用');
    const write = writeSave(null, defaultSave());
    expect(write.ok).toBe(false);
    expect(write.notice).toContain('无法保存');
  });

  it('写入失败（配额）时返回失败与提示，不抛错', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    const result = writeSave(storage, defaultSave());
    expect(result.ok).toBe(false);
    expect(result.notice).toContain('写入失败');
  });

  it('读取抛错时安全回退', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    const result = loadSave(storage);
    expect(result.data).toEqual(defaultSave());
    expect(result.notice).toBeTruthy();
  });

  it('重复通关不产生重复记录', () => {
    const data = defaultSave();
    recordCompletion(data, 'l01');
    recordCompletion(data, 'l01');
    expect(data.completed).toEqual(['l01']);
    expect(data.unlocked.filter((id) => id === 'l02')).toHaveLength(1);
  });

  it('schemaVersion 常量与默认值一致', () => {
    expect(defaultSave().schemaVersion).toBe(SCHEMA_VERSION);
  });
});