import { cellsOf, cellKey, inBoard } from '../core/rules';
import { LevelDef } from '../core/types';

export interface ValidationError {
  levelId: string;
  message: string;
}

export function validateLevel(level: LevelDef): ValidationError[] {
  const errors: ValidationError[] = [];
  const err = (message: string) => errors.push({ levelId: level.id, message });

  if (level.width < 5 || level.width > 7) err(`宽度 ${level.width} 超出 5~7`);
  if (level.height < 3 || level.height > 7) err(`高度 ${level.height} 超出 3~7`);
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
    if (a.len < 1 || a.len > 3) err(`箭头 ${a.id} 长度 ${a.len} 超出 1~3`);
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
  return errors;
}