# 开发日志（真实阶段记录）

工具：Qoder（本会话）。日期：2026-11-16。每阶段：目标 → 实际工作 → 检查结果 → 提交。
人工判断与截图由用户补充处标记“待补”。

## 阶段 1 环境与需求检查
目标：核对附件、确认空工作区、初始化骨架。
工作：读取附件需求（与本次指令一致）；确认工作区为空 → 从零初始化；写 package.json/tsconfig/vite/playwright/.gitignore/.env.example；
安装依赖并放行 esbuild postinstall；核实 Node v24.20.0、npm 11.19.0、vite 8.3.8、ts 7.0.2、vitest 5.1.0。
检查：`npx tsc --version`、`vite --version`、`vitest --version` 均正常。
提交：2e3811f。

## 阶段 2 规则引擎 + 求解器 + 12 关 + 存档
目标：纯函数规则、记忆化求解、12 关可解、存档校验。
工作：core/types、rules（射线校验/applyMove/exitDistance）、solver（记忆化 DFS+hint）、session（撤销快照）、
levels/validate、levels（12 关+回归样例）、storage/save（版本+校验+回退）、scripts/validate-levels。
检查：首跑 validate 发现 l02/l08 左向 len2 箭尾越界（真实设计错误）→ 修正头部坐标 → 12 关+样例全部“数据合法+有解+可重放清空”。
单元测试首跑 2 失败（测试夹具自身越界）→ 修正夹具 → 81 项通过；tsc 干净。
提交：9a06a0d。

## 阶段 3 渲染 + 动画 + 界面 + 浏览器实测
目标：SVG 棋盘、连续离场动画、输入锁、机关预览、撤销/重开/提示、四界面、响应式、存档联动。
工作：ui/board（SVG+rAF+兜底定时器+预览/高亮）、ui/app（路由/锁/预览/提示/通关/存档）、style.css、index.html、main.ts；
tests/browser/game.spec.ts（22 用例 ×3 视口）；scripts/capture-evidence.mjs 截图。
检查：preview 启动；in-app 浏览器隐藏页实测发现 rAF 被节流 → 兜底定时器正确提交（验证不锁死）；
Playwright 桌面 20 项通过（含动画中间位移采样）→ 全视口 60 项通过；截图目视发现 hero 装饰元素散落在框外、
手机“查看机关”标签换行 → 修复（hero 加 backwards fill+框内坐标；≤420px 操作区 2×2）→ 复测 66 项通过。
提交：97cad4a。

## 阶段 4 测试加固 + DeepSeek 脚本 + 文档交付
目标：补 AC15 聚焦预览 / AC17 动画中改尺寸用例；DeepSeek 审查脚本；九份文档 + README + 证据索引。
工作：新增 2 浏览器用例 → 66 项通过；保存 unit/levels/browser/build 原始输出到 evidence/test-results/；
核对 DeepSeek 官方文档模型 ID（deepseek-flash/deepseek-v4-pro）→ 修正 .env.example；
写 scripts/deepseek-review.mjs（单调用、白名单文件、脱敏记录、无密钥 not_called）并运行产生占位记录；
写 docs 九件套 + prompts/00 + README。
检查：vitest 81 通过、validate 全通过、playwright 66 通过、build 成功、deepseek 脚本 not_called 正常退出。
提交：见最终提交（本阶段）。

## 阶段 5 棋盘扩大 + 箭头细化 + 机关精修（用户追加需求）
目标：用户确认「显示 640px + 网格 7×7」；箭头皮肤美化、细小；机关视觉精修。
工作：12 关全部重设为 7×7（保留浏览器测试行为锚点，样例夹具仍 5×3）；board-wrap/controls 640px；
箭身 32→20 高、尾端 −back−44、头部 48×44 描边 3、高光条、徽章 r10 居中；闸门 68 双框（关=实线浅填、开=虚线淡化）。
检查：validate 首跑发现 l11 环形依赖无解（I10）→ 调整 a/c 坐标 → 13/13 通过；锚点脚本确认 l07 死局/l11 sc 自由/l02 被挡/l01 自由；
截图目检发现 len1 开关箭徽章盖满箭身（I11）→ 延伸箭尾+缩小徽章 → 重截 8 张并目检 03/05/06/08；
复测 81 单元 + 66 浏览器 + build 全通过，证据输出刷新。
提交：见阶段 5 提交（哈希回填于 evidence-index）。

## 阶段 6 追加机关关卡（用户追加需求「再多创建机关关卡」）
目标：在不改动基线 12 关与规则的前提下新增六个机关关（l13–l18），并保持全量测试与证据同步。
工作：levels.ts 新增 6 关（7×7，单组进阶 3 + 双组进阶 3，各带目标文案与重放解法）；levels.test 扩到 18 关逐关校验/重放/提示首步；
game.spec 新增 AC21/AC22/AC23（13 关死局、17 关通关解锁、18 关末关无下一关按钮）与 clickArrow 助手；
capture-evidence.mjs 解锁种子扩到 18、选关页视口加高、新增 09 截图；app.ts 首页文案与末关下一关按钮隐藏逻辑随关卡数自适应。
检查：validate 首跑发现 l14 下向 len2 箭尾越界（I12）、l18 同列互挡环无解（I13）→ 修坐标 → 19/19 通过；
AC23 首跑三视口失败，暴露末关 hidden 按钮被 .btn display 覆盖的既有缺陷（I14）→ 加 `[hidden]{display:none!important}` → 重建复测；
最终 99 单元 + 19 条重放 + 75 浏览器（25 用例 ×3）+ build 全通过；截图 01/02/04/05/06 重截、新增 09，目检 04（18 格三态）与 09（三门九箭）无溢出/遮挡；
选关页首截捕捉到入场动画中途（10–18 半透明）→ 截图等待 400→1100ms 重截确认全格清晰。
提交：见阶段 6 提交（哈希回填于 evidence-index）。

## 第二轮玩法扩展（2026-11-24 用户指令；阶段 A–F）
目标：在现有架构上扩展大棋盘/折线/可调头/接力/护送/点灯，不重写；每阶段可玩；只记录变化与测试，不做最终报告。
工作：见 changes.md 第二轮各阶段（core 规则扩展、ui 选中条/虚线/灯屋/★、l19–l27 九关、存档 turned/lit 兼容、提示点名、求解耗时记录）。
检查（每阶段首跑→修复→复测，断言未弱化）：
- 阶段 A：validate 通过；AC26 首跑 360px 格宽 39.15px 不达标 → 满宽 + flex-shrink:0 → 44.25px（I16）；111 单元 / 87 浏览器。
- 阶段 B：validate 首跑报 l21 箭 a 越界 (6,7) → 头部 (6,6)→(6,5)（I15）；128 单元 / 102 浏览器。
- 阶段 C：142 单元 / 111 浏览器；接力失败状态引用不变、单撤销全恢复均有用例。
- 阶段 D：AC38 首跑三视口失败（刷新后应回首页点继续，I17）→ 修正用例流程 → 162 单元 / 123 浏览器 / 28 重放。
- 阶段 E：AC40 首跑三视口超时（局中切关按钮用错，I18）→ 改 #btn-game-back → 166 单元 / 126 浏览器；validate 输出逐关耗时（合计约 5~6ms，最慢 l01 约 0.6~0.7ms，本机实测）。
- 阶段 F：四件 test-results 刷新；截图 10–17 新增并目检（360 大棋盘满宽、选中条、接力中途、灯亮、全亮弹窗）。
提交：3f1891c / c06cb85 / f8a3220 / 8bd09e4 / ed7fc27 / 721f9e9（阶段 G 文档提交哈希回填于 evidence-index）。

## 第三轮修改（2026-11-25 用户指令；阶段 H–J）
目标：徽记直接调头（去掉底部调头按钮）；无机关无灯关铺满、机关/灯关加密；直箭 len≤5、折线 ≤9 格 ≤3 弯。
工作：见 changes.md 第三轮各阶段（board 徽记命中区/app turnById/index.html 选中条精简/types+validate 上限、
27 关铺满加密重排、validate 覆盖率强制、测试锚点迁移助手 playSolution/finishLevel/clearUntil）。
检查（首跑→修复→复测，断言未弱化）：
- 阶段 H：AC29 首跑三视口超时（徽记调头不选中、#btn-fire 在隐藏选中条内，I19）→ 用例补点箭身选中；
  len 字面量联合使 build 失败、陈旧 dist 致浏览器假失败（I20）→ len 改 number + 先 build 再测。
- 阶段 I：validate 首跑报 l03/l09 互挡环、l06 重叠与环（I21）、len6/4 弯/dir 不一致（I22）→ 重排填充箭 → 28/28；
  9 单元 + 17 浏览器用例因硬编码锚点失败 → 计算比较/求解重放迁移；AC32 保留集不可达清空超时（I23）→ 保留集补 u6/u8。
- 阶段 J：166 单元 / 28 重放（含逐关覆盖率，求解合计 19.7ms、最慢 l10 4.0ms）/ 126 浏览器（42×3）/ build 全通过；
  四件 test-results 刷新；截图 18 张全重截、新增 18（徽记调头），目检 03/07/10/11/16/17/18（铺满、通关、满宽、灯亮、无下一关）。
提交：见第三轮提交（哈希回填于 evidence-index）。本轮不做最终报告与整体收尾。

## 第四轮修改（2026-11-25 用户指令；阶段 K）
目标：把游戏做成可下载到电脑玩的 Windows 免安装应用（单 exe），网页版与关卡内容不变。
工作：electron/main.cjs（app:// 特权协议 + 沙箱渲染）、package.json build/scripts/devDeps、vite base './'、
make-icon 脚本、.gitignore /release/；README 桌面版小节与 requirements §11。
检查（首跑→修复→复测）：
- 打包首跑 ETIMEDOUT（GitHub 直连）、二跑卡死（I24）→ 用户确认 npmmirror 后预置 builder 归档缓存；
  三跑 600s 超时定位为 SHASUMS256.txt 每次构建强制重拉（I25）→ 种子校验文件入缓存 → 四跑退出码 0，
  产物 release/EnArrower-1.0.0-portable.exe（110,485,570 字节，sha256 8325e4e6…338e）。
- 冒烟：桌面截屏在全屏会话下为黑屏（I26）→ 改 exe 带 --remote-debugging-port 由 Playwright connectOverCDP 抓窗口；
  冒烟脚本误以为普通箭头需点 #btn-fire（实为点箭身即发射、#btn-fire 仅 ⇄ 选中显示，与网页版一致，非缺陷）→ 修正脚本后
  验证发射/存档/重启恢复/零外联，截图 19/20 目检。
- 回归：166 单元 / 28 重放（合计 19.3ms、最慢 l10 3.6ms）/ 126 浏览器（42×3）/ build 全通过；test-results 增 desktop.txt。
提交：见第四轮提交（哈希回填于 evidence-index）。本轮不做最终报告与整体收尾。

## 待用户补充
- 完整指令截图 / 对话导出（docs/prompts 已存文本，截图待补）。
- 真机手机验证（当前为 Playwright 移动仿真，非真机）。
- DeepSeek 密钥配置后的真实调用记录。
- Gitee 仓库创建、授权与最终 commit/tag。
- 学号、姓名、个人总结。