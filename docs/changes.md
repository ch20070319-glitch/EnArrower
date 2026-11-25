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
## 阶段 5：棋盘扩大与视觉精修（用户追加需求，commit 0acfdb5）
- src/levels/levels.ts：12 关重设为 7×7（l11 修复环形依赖 I10）；样例夹具不变。
- src/ui/board.ts：箭头细化（身 20 高/尾 −back−44/头 48×44/描边 3/高光条/徽章 r10 居中，I11）；闸门 68 双框。
- src/style.css：board-wrap 与 controls 640px；箭头/闸门样式同步；gate-pulse 2.5→5.5。
- 测试断言未改动、未弱化；81 单元 + 13 关重放 + 66 浏览器 + build 复测全通过。
- evidence/screenshots/01–08 重截并目检；evidence/test-results/ 刷新。
- docs：decisions D10、issues I10/I11、development-log 阶段 5、acceptance 备注、README 尺寸说明。

## 阶段 6：追加六个机关关（用户追加需求，commit 8745f7e）
- src/levels/levels.ts：新增 l13 回马枪 / l14 双闸连开 / l15 开关接力 / l16 错钥 / l17 双锁互衔 / l18 终局回环（均 7×7，带重放解法）；l01–l12 与样例不变。
- src/ui/app.ts：首页关卡数文案随 LEVELS.length 自适应；末关通关隐藏“下一关”（配合 I14 修复）。
- src/style.css：`[hidden]{display:none!important}` 修复 hidden 被 .btn display 覆盖（I14）。
- tests/unit/levels.test.ts：18 关逐关校验/重放/提示首步 → 99 项通过。
- tests/browser/game.spec.ts：clickArrow 助手 + AC21/AC22/AC23 → 25 用例 ×3 视口 = 75 项通过。
- scripts/capture-evidence.mjs：18 关解锁种子、选关页 1080 高 + 1100ms 等待、新增 09-game-l18-desktop。
- 修复：l14 箭尾越界（I12）、l18 同列互挡环（I13）、末关 hidden 按钮缺陷（I14）；断言未弱化。
- evidence：test-results 四件刷新（99/19/75/build）；screenshots 01/02/04/05/06 重截 + 09 新增，目检通过。
- docs：requirements §5/§7 追加说明、decisions D11、issues I12–I14、development-log 阶段 6、acceptance AC12 更新 + AC21–AC23、evidence-index、report-outline、README 计数与提交链。

## 第二轮玩法扩展（2026-11-24 用户指令；按「大棋盘与折线 → 可调头 → 接力 → 特殊目标」推进）

### 阶段 A：大棋盘 + 折线箭头（commit 3f1891c）
- src/core/{types,rules}.ts：ArrowDef.path；cellsOf 统一尾→头、headDirOf 取末段朝向；sweptCells = 自身格 + 出口射线，碰撞/预览/动画/点灯共用。
- src/levels/validate.ts：宽 5~10、高 3~14、箭 3~12；折线 2~5 格、相邻、不重复、≤1 弯、head/dir 与末段一致。
- src/levels/levels.ts：l19 折弯初识（7×7）、l20 长湾疏流（8×12=96≈2×49，9 箭两条折线）；l01–l18 逐字不变。
- src/ui/board.ts：折线箭身 path 渲染 + 绳随离场动画（逐帧展开 d）；src/style.css：`.board-wrap--tall` 桌面限高、≤420px 满宽且 `flex-shrink:0`（I16）。
- 测试：levels.test 折线 describe 5 项；browser AC24（d 逐帧采样）/AC25（弯折身挡路）/AC26（360px 格≥44px 实玩）/AC27；AC23 锚点改指 l19。
- 修复：AC26 首跑格宽 39.15px → 满宽后仍 40.9px（flex 父压缩）→ flex-shrink:0 → 44.25px 通过（I16）。

### 阶段 B：可调头箭头 ⇄（commit c06cb85）
- rules：effectiveArrow（调头后头尾互换、朝向取反）、applyTurn（只改朝向、不触闸门）、stateKey 含 turned（防调头循环）。
- session.commitTurn 单快照；solver 搜索 exit 优先再 turn，HintResult 增 turn；save turned 可选子集校验（旧档缺省 []）。
- ui：选中条 #sel-bar（调头/发射/取消）、珊瑚色 ⇄ 皮肤、选中预览射线；app 选中/调头/发射路由、Esc 先退选中。
- levels：l21 调头初试（不调头无解）、l22 双向抉择（右路永闭）；validate 禁 ⇄+开关/折线共存。
- 测试：unit 调头 5 项 + 会话 3 项 + 存档 turned 3 项；browser AC28–AC32；AC27 锚点改指 l21。
- 修复：l21 箭 a 头部 (6,6) 上向 len2 尾越界 → (6,5)（I15）。

### 阶段 C：接力箭头 A/B（commit f8a3220）
- rules：relayOf/checkRelay（预演 A 离场后的中间态再查 B，RelayCheck.failedId 指明谁被挡）/applyRelay（失败返回原状态引用）；legalMoves 排除跟随箭。
- session.commitRelay 单快照；solver HintResult 增 relay；validate 接力对校验（存在/不同/不跨队/直/不可调头）。
- ui：虚线 relay-link、点 B 高亮 A、顺序动画（A 动画 → 中间态 render → B 动画 → 一次 commitRelay）。
- levels：l23 接力过桥、l24 接力长链（8×8 双接力双组）。
- 测试：unit 接力 6 项 + 会话单撤销/失败 2 项；browser AC33–AC35（含 sampleRelay 顺序采样）；AC31 锚点改指 l23。

### 阶段 D：护送 ★ 与点灯（commit 8bd09e4）
- rules：isWin(level,state) 护送感知；applyMove 按 sweptCells 点灯；allLampsLit；GameState.lit。
- save lit 可选子集校验（旧档缺省 []）；validate 护送 id 存在、灯不越界/不重复/不与箭或门重叠。
- ui：灯屋 SVG（未亮/已亮）、★ 金色徽章、通关文案「点亮小屋：所有灯都亮了！」/「还有 N 盏灯没亮（不影响通关）」/护送 ★ 文案；index.html 玩法说明增 ★/灯条目。
- levels：l25 护送星标（★ 离场即胜、a 可留场）、l26 灯与调头（右发可胜但不亮灯）、l27 终局灯屋（8×8 接力+⇄+两灯）。
- 测试：unit 护送/点灯 6 项 + 会话点灯撤销/护送 2 项 + 存档 lit 3 项；browser AC36–AC39；AC34 锚点改指 l25、末关无下一关断言移至 AC39（l27）。
- 修复：AC38 刷新后断言直接可见游戏屏失败 → 应用刷新后回首页、需点 #btn-start 继续（与 AC13 一致，I17）。

### 阶段 E：提示操作化 + 求解规模记录（commit ed7fc27）
- app.giveHint：move 分支点名（开关 X 切换 ◇/○ / 护送 ★ X / 普通 X 沿朝向离场）；turn 分支点名 ⇄ X。
- scripts/validate-levels.ts：逐关记录求解耗时 ms + 合计/最慢（本机实测，非承诺上限）。
- 测试：unit 规模 describe 4 项（l20<500 状态、l27<200、灯不入状态键、27 关总耗时<1s 回归阈值）；browser AC40 三类点名文案。
- 修复：AC40 局中切关误用首页 #btn-levels → 游戏屏 #btn-game-back 回选关页（I18）。

### 阶段 F：全量复测 + 证据刷新（commit 721f9e9）
- 复测：166 单元 / 28 条重放（27 关+样例，含耗时）/ 126 浏览器（42 用例 ×3 视口）/ build 全通过；evidence/test-results 四件刷新。
- scripts/capture-evidence.mjs：解锁种子扩到 27；新增截图 10–17（l19 折线、l20 360 满宽整页、l21 选中条、l23 虚线、接力中途 A 已出 B 在场、l25 ★、l26 灯亮、l27 全亮通关弹窗），逐张目检。
- 本轮不做最终报告与整体收尾（用户指令：待游戏内容定稿后再做）。

## 第三轮修改（2026-11-25 用户指令：徽记调头 / 铺满加密 / 更长更多弯折）

### 阶段 H：⇄ 徽记直接调头 + 上限放宽
- src/ui/board.ts：BoardCallbacks 增 onTurn；⇄ 徽记移到尾格中心（命中圆 r=50 独占整格），click/keydown stopPropagation 直接调头；新增 flashTurn 脉冲反馈；箭身命中区为其余格。
- src/ui/app.ts：删除 #btn-turn 监听，turnSelected 改为 turnById（徽记回调直达 commitTurn）；选中 ⇄ 文案改为「点箭尾 ⇄ 徽记调头，或在此发射」。
- index.html：选中条移除调头按钮（只留发射/取消）；玩法说明与键盘说明同步徽记调头。
- src/style.css：.arrow-turn / .arrow-turn-hit / .arrow-badge--turn / turn-pulse 动画与聚焦描边。
- src/core/types.ts + src/levels/validate.ts：len 字面量联合 1|2|3 → number（校验 1~5）；折线 2~9 格、≤3 弯；⇄ 需 len≥2。
- 修复：AC29 徽记调头不选中导致隐藏选中条内 #btn-fire 不可见 → 用例补「点箭身选中」一步（I19）；len 联合类型使 build 失败、dist 陈旧致浏览器假失败 → 先 build 再测（I20）。

### 阶段 I：27 关铺满 / 加密重设计
- src/levels/levels.ts：l01/l02/l03/l19 重排为 49/49 全铺满（可剥依赖链 motif）；l04–l18、l20–l27 依「解法射线安全格」勘察添加填充箭（每关 ≤12 箭），覆盖率 22~46 格不等；教学锚点（开关/⇄/接力/★/灯）位置与依赖关系保留。
- scripts/validate-levels.ts：输出逐关覆盖率；无机关无灯关（除样例）覆盖 ≠ 宽×高 判失败。
- 测试锚点迁移（断言强度不变）：硬编码 remaining 列表改为「初始剩余 − 已离场」计算比较；通关序列改为重放求解器解法（playSolution）或「教学锚点步 + finishLevel 补完填充箭」；AC32 用 clearUntil 保留 ⇄ 教学局面；AC33 撤销回接力步再撤销接力本身。
- 修复：l03 两次互挡环、l09 r5a↔r45b 环、l06 m1/m2 重叠与 m2↔m4 环（I21）；填充箭直 len6 超上限改 6 格折线、4 弯改 3 弯、dir 与末段朝向不一致改朝向（I22）；AC32 clearUntil 保留集不可达致清空超时 → 保留集补 u6/u8（I23）。

### 阶段 J：全量复测 + 证据刷新 + 本轮文档
- 复测：166 单元 / 28 条重放（27 关+样例，含逐关覆盖率与耗时：合计 19.7ms、最慢 l10 4.0ms）/ 126 浏览器（42 用例 ×3 视口）/ build 全通过；evidence/test-results 四件刷新。
- scripts/capture-evidence.mjs：07/17 通关序列改铺满后解法序；新增截图 18（l21 徽记直接调头、底部无调头按钮）；18 张全重截，目检 03（l01 49/49）/07/10（l19 49/49）/11（360 满宽）/16（灯亮）/17（全亮无下一关）/18。
- docs：requirements §10、decisions D13、issues I19–I23、development-log 第三轮、acceptance 行文与第三轮说明、evidence-index、README 计数。
- 本轮不做最终报告与整体收尾（用户指令：待游戏内容定稿后再做）。
