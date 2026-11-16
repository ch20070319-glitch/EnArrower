/**
 * 关卡自动验证：数据校验 + 求解器搜索 + 用规则引擎逐步重放解法。
 * 运行：npm run validate:levels
 */
import { applyMove, checkMove, initialState, isWin } from '../src/core/rules';
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
  for (const [i, id] of result.solution.entries()) {
    const check = checkMove(level, state, id);
    if (!check.ok) {
      replayOk = false;
      console.error(`[重放失败] ${level.id} 第 ${i + 1} 步 ${id} 被阻挡`);
      break;
    }
    state = applyMove(level, state, id).state;
  }
  if (!replayOk || !isWin(state)) {
    failed++;
    console.error(`[重放未清空] ${level.id}`);
    continue;
  }
  console.log(
    `[通过] ${level.id} ${level.name}｜${level.arrows.length} 箭｜解法 ${result.solution.join(' → ')}｜搜索 ${result.visited} 状态`,
  );
}

if (failed > 0) {
  console.error(`\n${failed} 个关卡未通过验证`);
  process.exit(1);
}
console.log('\n全部关卡数据合法、有解且可逐步重放清空。');