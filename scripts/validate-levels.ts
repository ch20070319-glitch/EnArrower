/**
 * 关卡自动验证：数据校验 + 求解器搜索 + 用规则引擎逐步重放解法。
 * 运行：npm run validate:levels
 */
import { applyMove, applyRelay, applyTurn, checkMove, initialState, isWin } from '../src/core/rules';
import { solve } from '../src/core/solver';
import { LEVELS, SAMPLE_LEVEL } from '../src/levels/levels';
import { validateLevel } from '../src/levels/validate';

let failed = 0;

for (const level of [...LEVELS, SAMPLE_LEVEL]) {
  const errors = validateLevel(level);
  if (errors.length > 0) {
    failed++;
    console.error(`[数据非法] ${level.id} ${level.name}`);
    for (const e of errors) console.error(`  - ${e.message}`);
    continue;
  }
  const result = solve(level, initialState(level));
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
  if (!replayOk || !isWin(state)) {
    failed++;
    console.error(`[重放未清空] ${level.id}`);
    continue;
  }
  const pretty = result.solution
    .map((op) => (op.kind === 'turn' ? `⇄${op.arrowId}` : op.kind === 'relay' ? `${op.arrowId}⇒` : op.arrowId))
    .join(' → ');
  console.log(
    `[通过] ${level.id} ${level.name}｜${level.arrows.length} 箭｜解法 ${pretty}｜搜索 ${result.visited} 状态`,
  );
}

if (failed > 0) {
  console.error(`\n${failed} 个关卡未通过验证`);
  process.exit(1);
}
console.log('\n全部关卡数据合法、有解且可逐步重放清空。');