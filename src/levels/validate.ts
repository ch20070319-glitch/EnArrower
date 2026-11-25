import { cellsOf, cellKey, headDirOf, inBoard } from '../core/rules';
import { LevelDef } from '../core/types';

export interface ValidationError {
  levelId: string;
  message: string;
}

export function validateLevel(level: LevelDef): ValidationError[] {
  const errors: ValidationError[] = [];
  const err = (message: string) => errors.push({ levelId: level.id, message });

  // 本轮需求变化：中后段大棋盘约 2× 旧面积（7×7=49 → 8×12=96），上限随之放宽。
  if (level.width < 5 || level.width > 10) err(`宽度 ${level.width} 超出 5~10`);
  if (level.height < 3 || level.height > 14) err(`高度 ${level.height} 超出 3~14`);
  if (level.arrows.length < 3 || level.arrows.length > 12) {
    err(`箭头数 ${level.arrows.length} 超出 3~12`);
  }
  if (level.mechanisms.length > 2) err('机关组超过 2 组');
  const gateCount = level.mechanisms.reduce((n, m) => n + m.gates.length, 0);
  if (gateCount > 4) err(`闸门格 ${gateCount} 超过 4`);

  const ids = new Set<string>();
  const occupied = new Map<string, string>();
  for (const a of level.arrows) {
    if (ids.has(a.id)) err(`箭头 id 重复: ${a.id}`);
    ids.add(a.id);
    if (a.path) {
      const p = a.path;
      if (p.length < 2 || p.length > 9) err(`箭头 ${a.id} 折线格数 ${p.length} 超出 2~9`);
      const seen = new Set<string>();
      let bends = 0;
      let prevDir: string | null = null;
      for (let i = 0; i < p.length; i++) {
        const key = cellKey(p[i]);
        if (seen.has(key)) err(`箭头 ${a.id} 折线坐标重复 (${p[i].x},${p[i].y})`);
        seen.add(key);
        if (i > 0) {
          const dx = p[i].x - p[i - 1].x;
          const dy = p[i].y - p[i - 1].y;
          if (Math.abs(dx) + Math.abs(dy) !== 1) {
            err(`箭头 ${a.id} 折线第 ${i} 段不相邻 (${p[i - 1].x},${p[i - 1].y})→(${p[i].x},${p[i].y})`);
          }
          const d = `${dx},${dy}`;
          if (prevDir && d !== prevDir) bends++;
          prevDir = d;
        }
      }
      if (bends > 3) err(`箭头 ${a.id} 折线弯折 ${bends} 处，最多 3 处直角弯`);
      const last = p[p.length - 1];
      if (last.x !== a.head.x || last.y !== a.head.y) err(`箭头 ${a.id} head 与折线末端不一致`);
      if (headDirOf(a) !== a.dir) err(`箭头 ${a.id} dir 与折线末段朝向不一致`);
    } else if (a.len < 1 || a.len > 5) {
      err(`箭头 ${a.id} 长度 ${a.len} 超出 1~5`);
    }
    if (a.reversible) {
      if (a.path) err(`箭头 ${a.id} 可调头箭头必须是直箭头`);
      if (a.len < 2) err(`箭头 ${a.id} 可调头箭头长度至少 2（⇄ 徽记独占尾格命中区）`);
      if (a.group) err(`箭头 ${a.id} 可调头箭头不同时作为机关开关（徽记冲突）`);
    }
    for (const c of cellsOf(a)) {
      if (!inBoard(level, c)) err(`箭头 ${a.id} 占用格越界 (${c.x},${c.y})`);
      const key = cellKey(c);
      const prev = occupied.get(key);
      if (prev) err(`箭头 ${a.id} 与 ${prev} 重叠于 (${c.x},${c.y})`);
      occupied.set(key, `箭头 ${a.id}`);
    }
  }

  const groups = new Set<string>();
  for (const m of level.mechanisms) {
    if (groups.has(m.group)) err(`机关组重复: ${m.group}`);
    groups.add(m.group);
    if (m.gates.length === 0) err(`机关组 ${m.group} 没有闸门`);
    for (const g of m.gates) {
      if (!inBoard(level, g)) err(`闸门越界 (${g.x},${g.y})`);
      const key = cellKey(g);
      const prev = occupied.get(key);
      if (prev) err(`闸门 (${g.x},${g.y}) 与 ${prev} 重叠`);
      occupied.set(key, `闸门 ${m.group}`);
    }
  }

  for (const a of level.arrows) {
    if (a.group && !groups.has(a.group)) {
      err(`箭头 ${a.id} 引用了不存在的机关组 ${a.group}`);
    }
  }
  for (const g of groups) {
    if (!level.arrows.some((a) => a.group === g)) {
      err(`机关组 ${g} 没有任何开关箭头`);
    }
  }

  const relayIds = new Set<string>();
  for (const r of level.relays ?? []) {
    if (!ids.has(r.leader)) err(`接力领头 ${r.leader} 不存在`);
    if (!ids.has(r.follower)) err(`接力跟随 ${r.follower} 不存在`);
    if (r.leader === r.follower) err(`接力对 ${r.leader} 领头与跟随相同`);
    for (const id of [r.leader, r.follower]) {
      if (relayIds.has(id)) err(`箭头 ${id} 属于多个接力对`);
      relayIds.add(id);
      const a = level.arrows.find((x) => x.id === id);
      if (a?.reversible) err(`接力箭头 ${id} 第一轮不同时可调头`);
      if (a?.path) err(`接力箭头 ${id} 第一轮必须是直箭头`);
    }
  }

  if (level.escort !== undefined && !ids.has(level.escort)) {
    err(`护送目标 ${level.escort} 不存在`);
  }
  const lampKeys = new Set<string>();
  for (const c of level.lamps ?? []) {
    if (!inBoard(level, c)) err(`灯越界 (${c.x},${c.y})`);
    const key = cellKey(c);
    if (lampKeys.has(key)) err(`灯坐标重复 (${c.x},${c.y})`);
    lampKeys.add(key);
    if (occupied.has(key)) err(`灯 (${c.x},${c.y}) 与箭头/闸门重叠`);
  }
  return errors;
}