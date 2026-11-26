import { describe, expect, it } from 'vitest';
import { initialState } from '../../src/core/rules';
import { GameSession } from '../../src/core/session';
import { LEVELS, TUTORIAL_LEVEL, displayNumber } from '../../src/levels/levels';
import {
  SAVE_KEY,
  SCHEMA_VERSION,
  StorageLike,
  defaultSave,
  loadSave,
  recordCompletion,
  recordLampBest,
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
    expect(loaded.data.current?.state.remaining).toEqual(
      initialState(level).remaining.filter((id) => id !== 's'),
    );
    expect(loaded.data.current?.history).toHaveLength(1);
    const restored = new GameSession(
      level,
      loaded.data.current!.state,
      loaded.data.current!.history,
    );
    expect(restored.canUndo).toBe(true);
    restored.undo();
    expect(restored.state.remaining).toEqual(initialState(level).remaining);
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

  it('旧存档（无 turned 字段）兼容加载，默认未调头', () => {
    const level = LEVELS[20];
    const state = initialState(level);
    const { turned: _omitted, ...oldState } = state;
    const data = defaultSave();
    data.current = { levelId: level.id, state: oldState as typeof state, history: [] };
    const result = loadSave(memoryStorage(JSON.stringify(data)));
    expect(result.notice).toBeNull();
    expect(result.data.current?.state.turned).toEqual([]);
    expect(result.data.current?.state.remaining).toEqual(state.remaining);
  });

  it('调头状态往返保存：刷新后恢复朝向', () => {
    const level = LEVELS[20];
    const session = new GameSession(level);
    session.commitTurn('r');
    const data = defaultSave();
    data.current = { levelId: level.id, state: session.state, history: session.history };
    const storage = memoryStorage();
    expect(writeSave(storage, data).ok).toBe(true);
    const loaded = loadSave(storage);
    expect(loaded.notice).toBeNull();
    expect(loaded.data.current?.state.turned).toEqual(['r']);
    const restored = new GameSession(level, loaded.data.current!.state, loaded.data.current!.history);
    expect(restored.state.turned).toEqual(['r']);
    restored.undo();
    expect(restored.state.turned).toEqual([]);
  });

  it('非法 turned（非 ⇄ 箭头 / 不在 remaining）丢弃当前存档', () => {
    const level = LEVELS[20];
    const data = defaultSave();
    data.current = {
      levelId: level.id,
      state: { ...initialState(level), turned: ['s'] },
      history: [],
    };
    const result = loadSave(memoryStorage(JSON.stringify(data)));
    expect(result.data.current).toBeNull();
    expect(result.notice).toContain('不匹配');
  });

  it('旧存档（无 lit 字段）兼容加载，默认灯全灭', () => {
    const level = LEVELS[25];
    const state = initialState(level);
    const { lit: _omitted, ...oldState } = state;
    const data = defaultSave();
    data.current = { levelId: level.id, state: oldState as typeof state, history: [] };
    const result = loadSave(memoryStorage(JSON.stringify(data)));
    expect(result.notice).toBeNull();
    expect(result.data.current?.state.lit).toEqual([]);
  });

  it('点灯状态往返保存：刷新后灯仍亮，撤销后熄灭', () => {
    const level = LEVELS[25];
    const session = new GameSession(level);
    session.commitMove('c');
    session.commitTurn('r');
    session.commitMove('r');
    const data = defaultSave();
    data.current = { levelId: level.id, state: session.state, history: session.history };
    const storage = memoryStorage();
    expect(writeSave(storage, data).ok).toBe(true);
    const loaded = loadSave(storage);
    expect(loaded.notice).toBeNull();
    expect(loaded.data.current?.state.lit).toEqual(['0,3']);
    const restored = new GameSession(level, loaded.data.current!.state, loaded.data.current!.history);
    expect(restored.state.lit).toEqual(['0,3']);
    restored.undo();
    expect(restored.state.lit).toEqual([]);
  });

  it('非法 lit（不是本关灯的坐标）丢弃当前存档', () => {
    const level = LEVELS[25];
    const data = defaultSave();
    data.current = {
      levelId: level.id,
      state: { ...initialState(level), lit: ['9,9'] },
      history: [],
    };
    const result = loadSave(memoryStorage(JSON.stringify(data)));
    expect(result.data.current).toBeNull();
    expect(result.notice).toContain('不匹配');
  });
});

describe('第六轮：教学 / 点灯最佳成绩 / 显示顺序重排兼容', () => {
  it('旧存档无 tutorialDone/lampBest 字段正常加载，默认未完成、无全亮记录', () => {
    const old = {
      schemaVersion: SCHEMA_VERSION,
      completed: ['l01'],
      unlocked: ['l01', 'l02'],
      current: null,
    };
    const result = loadSave(memoryStorage(JSON.stringify(old)));
    expect(result.notice).toBeNull();
    expect(result.data.tutorialDone).toBe(false);
    expect(result.data.lampBest).toEqual([]);
    expect(result.data.completed).toEqual(['l01']);
  });

  it('教学完成只记 tutorialDone，不增加正式完成数', () => {
    const data = defaultSave();
    recordCompletion(data, TUTORIAL_LEVEL.id);
    expect(data.tutorialDone).toBe(true);
    expect(data.completed).toEqual([]);
    expect(data.unlocked).toEqual(['l01']);
  });

  it('教学进行中的存档可恢复，且不污染解锁列表', () => {
    const data = defaultSave();
    const session = new GameSession(TUTORIAL_LEVEL);
    session.commitMove('C');
    data.current = { levelId: 'tutorial', state: session.state, history: session.history };
    const storage = memoryStorage();
    expect(writeSave(storage, data).ok).toBe(true);
    const loaded = loadSave(storage);
    expect(loaded.notice).toBeNull();
    expect(loaded.data.current?.levelId).toBe('tutorial');
    expect(loaded.data.unlocked).not.toContain('tutorial');
    const again = loadSave(memoryStorage(JSON.stringify(loaded.data)));
    expect(again.notice).toBeNull();
  });

  it('解锁按显示顺序：通关 l02（显示 2）解锁 l19（显示 3），而非 l03', () => {
    const data = defaultSave();
    recordCompletion(data, 'l02');
    expect(data.unlocked).toContain('l19');
    expect(data.unlocked).not.toContain('l03');
    recordCompletion(data, 'l21');
    expect(data.unlocked).toContain('l03');
  });

  it('重排前旧存档的解锁缺口被补齐：旧序完成到 l06 则新序前 8 位全解锁', () => {
    const old = {
      schemaVersion: SCHEMA_VERSION,
      completed: ['l01', 'l02', 'l03', 'l04', 'l05', 'l06'],
      unlocked: ['l01', 'l02', 'l03', 'l04', 'l05', 'l06', 'l07'],
      current: null,
    };
    const result = loadSave(memoryStorage(JSON.stringify(old)));
    expect(result.notice).toBeNull();
    // 旧存档解锁到 l07（新显示第 9 位），前 9 位（含前移的 l19/l21）全部可玩。
    const posOf = (id: string) => result.data.unlocked.includes(id);
    for (const id of ['l01', 'l02', 'l19', 'l21', 'l03', 'l04', 'l05', 'l06', 'l07']) {
      expect(posOf(id)).toBe(true);
    }
    expect(result.data.completed).toEqual(old.completed);
    expect(displayNumber(LEVELS.find((l) => l.id === 'l19')!)).toBe(3);
  });

  it('全亮最佳成绩只增不减：漏灯重玩不覆盖', () => {
    const data = defaultSave();
    recordLampBest(data, 'l26');
    recordLampBest(data, 'l26');
    recordCompletion(data, 'l26');
    expect(data.lampBest).toEqual(['l26']);
    const storage = memoryStorage();
    expect(writeSave(storage, data).ok).toBe(true);
    const loaded = loadSave(storage);
    expect(loaded.data.lampBest).toEqual(['l26']);
  });

  it('非法 lampBest（不存在的关卡 id）按损坏回退', () => {
    const data = { ...defaultSave(), lampBest: ['nope'] };
    const result = loadSave(memoryStorage(JSON.stringify(data)));
    expect(result.notice).toContain('损坏');
    expect(result.data.lampBest).toEqual([]);
  });
});