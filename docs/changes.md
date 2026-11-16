# 变更记录（changes）

按阶段列出实际改动与对应提交。全部工作由 Qoder 在本工作区实际执行。

## 阶段 1：环境与骨架（commit 2e3811f）
- 确认工作区为空 → 初始化（未覆盖任何无关文件）。
- 新增 package.json / package-lock.json / tsconfig.json / vite.config.ts / playwright.config.ts / .gitignore / .env.example / index.html 骨架 / public/favicon.svg。
- 实测环境：Node v24.20.0、npm 11.19.0、win32-x64；esbuild postinstall 经 `npm install-scripts approve esbuild` 批准。

## 阶段 2：规则引擎与数据（commit 9a06a0d）
- src/core/{types,rules,solver,session}.ts：纯函数规则、记忆化求解器、快照式无限撤销会话。
- src/levels/{levels,validate}.ts：固定样例 + 12 关（l01–l12）+ 校验器。
- src/storage/save.ts：schemaVersion=1 严格校验、安全回退、写入失败容忍。
- scripts/validate-levels.ts：校验 + 求解 + 逐步重放。
- tests/unit/*.test.ts：81 项单元测试，全部通过（evidence/test-results/unit.txt）。
- 修复：l02/l08 左向 len2 头部越界（校验器发现）；3 处测试夹具坐标错误；save.ts 冗余代码。见 issues.md I1/I2。

## 阶段 3：界面、动画与浏览器实测（commit 97cad4a）
- src/ui/{board,app}.ts、src/main.ts、src/style.css：SVG 棋盘、连续离场动画（rAF + 一次性完成守卫 + 兜底定时器）、输入锁、预览/查看机关、提示、通关、存档接线、四界面与响应式。
- tests/browser/game.spec.ts：20 用例 × 3 视口 = 60 项通过。
- scripts/capture-evidence.mjs + evidence/screenshots/01–08：真实截图并逐张目检。
- 修复：首页 hero 元素错位（fill-mode/transform）、移动端按钮换行、通关覆盖层阻断撤销（新增 btn-win-undo）、2 处浏览器夹具选择器/关卡选择错误。见 issues.md I3–I5、I7。

## 阶段 4：补充测试、DeepSeek 脚本与文档（commit 02372b6）
- tests/browser/game.spec.ts：新增 AC15 键盘聚焦预览、AC17 动画中改尺寸 + reduced-motion → 22 用例 × 3 = 66 项通过（evidence/test-results/browser.txt 更新）。
- scripts/deepseek-review.mjs + docs/prompts/deepseek-review-request.md：单次调用、脱敏记录、无密钥标记 not_called；实跑产出 evidence/api/review-2026-11-16T08-42-29-353Z.json（status=not_called，未发生真实 API 调用）。
- .env.example：模型默认值由过时的 deepseek-chat 更正为 deepseek-flash（2026-11-16 核对官方文档，见 issues.md I6）。
- docs/：requirements、decisions、development-log、issues、acceptance、changes、evidence-index、api-usage、report-outline、prompts/00-initial-requirements（用户原文留存）。
- README.md：用途/功能/环境/安装/构建/测试/玩法/存档限制/已知问题/Gitee 清单。

## 未改动说明
- 未删除任何需求或弱化断言来换取测试通过；所有失败均修复后以相同用例复测。
- 工作区外文件（用户附件等）只读确认存在，未修改。