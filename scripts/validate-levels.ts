/**
 * 关卡自动验证：数据校验 + 求解器搜索 + 用规则引擎逐步重放解法。
 * 运行：npm run validate:levels
 */
import { applyMove, applyRelay, applyTurn, cellsOf, checkMove, initialState, isWin } from '../src/core/rules';
import { solve } from '../src/core/solver';
import { LEVELS, SAMPLE_LEVEL } from '../src/levels/levels';
import { validateLevel } from '../src/levels/validate';

let failed = 0;
let totalMs = 0;
let maxMs = 0;
let maxLevel = '';

for (const level of [...LEVELS, SAMPLE_LEVEL]) {
  const errors = validateLevel(level);
  if (errors.length > 0) {
    failed++;
    console.error(`[数据非法] ${level.id} ${level.name}`);
    for (const e of errors) console.error(`  - ${e.message}`);
    continue;
  }
  const t0 = performance.now();
  const result = solve(level, initialState(level));
  const ms = performance.now() - t0;
  totalMs += ms;
  if (ms > maxMs) {
    maxMs = ms;
    maxLevel = level.id;
  }
  if (!result.solvable || !result.solution) {
    failed++;
    console.error(`[无解] ${level.id} ${level.name}（搜索 ${result.visited} 个状态）`);
    continue;
  }
  let state = initialState(level);
  let replayOk = true;
  for (const [i, op] of result.solution.entries()) {
    if (op.kind === 'turn') {
      const turned = applyTurn(level, state, op.arrowId);
      if (!turned.ok) {
        replayOk = false;
        console.error(`[重放失败] ${level.id} 第 ${i + 1} 步 ${op.arrowId} 无法调头`);
        break;
      }
      state = turned.state;
      continue;
    }
    if (op.kind === 'relay') {
      const moved = applyRelay(level, state, op.arrowId);
      if (!moved.ok) {
        replayOk = false;
        console.error(`[重放失败] ${level.id} 第 ${i + 1} 步接力 ${op.arrowId} 被阻挡`);
        break;
      }
      state = moved.state;
      continue;
    }
    const check = checkMove(level, state, op.arrowId);
    if (!check.ok) {
      replayOk = false;
      console.error(`[重放失败] ${level.id} 第 ${i + 1} 步 ${op.arrowId} 被阻挡`);
      break;
    }
    state = applyMove(level, state, op.arrowId).state;
  }
  if (!replayOk || !isWin(level, state)) {
    failed++;
    console.error(`[重放未清空] ${level.id}`);
    continue;
  }
  const pretty = result.solution
    .map((op) => (op.kind === 'turn' ? `⇄${op.arrowId}` : op.kind === 'relay' ? `${op.arrowId}⇒` : op.arrowId))
    .join(' → ');
  // 第三轮：无机关无灯的关卡箭头必须铺满全部格子；有门/灯关报告覆盖率（尽量加密）。
  const covered = new Set(level.arrows.flatMap((a) => cellsOf(a).map((c) => `${c.x},${c.y}`))).size;
  const cells = level.width * level.height;
  const mustFill = level.mechanisms.length === 0 && (level.lamps ?? []).length === 0 && level.id !== SAMPLE_LEVEL.id;
  if (mustFill && covered !== cells) {
    failed++;
    console.error(`[未铺满] ${level.id} 覆盖 ${covered}/${cells} 格（无机关无灯关必须铺满）`);
    continue;
  }
  console.log(
    `[通过] ${level.id} ${level.name}｜${level.arrows.length} 箭｜覆盖 ${covered}/${cells} 格｜解法 ${pretty}｜搜索 ${result.visited} 状态｜耗时 ${ms.toFixed(1)}ms`,
  );
}

if (failed > 0) {
  console.error(`\n${failed} 个关卡未通过验证`);
  process.exit(1);
}
console.log('\n全部关卡数据合法、有解且可逐步重放达通关（护送关以 ★ 离场为准）。');
console.log(
  `求解耗时合计 ${totalMs.toFixed(1)}ms；最慢 ${maxLevel} ${maxMs.toFixed(1)}ms（本机实测，非承诺上限）。`,
);