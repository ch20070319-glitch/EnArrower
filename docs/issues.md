# 问题记录（真实未达标 → 分析 → 修复 → 复测）

格式：目标 / 未达标表现 / 原因分析（事实 vs 推测）/ 措施 / 复测 / 状态。
指令编号见 `docs/prompts/00-initial-requirements.md`（单次完整指令，章节引用）。

## I1 关卡 l02/l08 左向 len2 箭尾越界
- 目标：指令八“所有占用格不能越界”；关卡校验。
- 表现：首跑 `validate:levels` 报 l02 箭头 c 占用 (5,2)、l08 箭头 s 占用 (6,0) 越界。
- 原因（事实）：左向箭头尾部在头部右侧（head - dir*(len-1)），设计时误把头部当最右格，导致 len2 尾部出界。
- 措施：l02 c 头部 (4,2)→(3,2)；l08 s 头部 (5,0)→(4,0)。
- 复测：validate 全 13 条（12 关+样例）通过；levels.test 通过。
- 状态：已解决。

## I2 单元测试夹具自身越界（3 处）
- 目标：指令十一“四向不同长度移动/阻挡”测试有效。
- 表现：rules.test 首跑 2 失败：exitDistance 左向 len2 head(4,0) 与 down len2 head(0,0) 期望不符；
  多格阻挡用例 down len3 head(4,0) 未阻挡。
- 原因（事实）：测试构造的箭头尾部越界（左/下向尾部在头右/头上），属夹具错误而非引擎错误；
  引擎 exitDistance 对合法输入正确。
- 措施：改夹具为合法坐标（left head(3,0)、down head(0,1)、down len3 head(4,2)）。
- 复测：81 项单元测试通过。
- 状态：已解决。

## I3 首页 hero 装饰元素散落框外
- 目标：指令九“简洁柔和、不堆砌装饰”、视觉完整。
- 表现：截图 01-home 中 amber 箭头/◇闸门/第二支 teal 箭头聚在左上框外重叠。
- 原因（事实）：hero 箭头/闸门带 animation-delay 但无 fill-mode，延迟期间停留在 base 位置 (0,0)；闸门无 transform。
- 措施：hero 箭头加 `backwards` fill + 框内 rest 坐标；闸门加 transform translate(240,128)；补 3×2 淡格；
  为 amber 箭头单独 keyframe；同步 reduced-motion rest。
- 复测：重截图 01-home 目视整洁、元素均在框内。
- 状态：已解决。

## I4 手机 360px“查看机关”标签换行
- 目标：指令九“无按钮重叠、触摸目标约 44px”。
- 表现：截图 08-mobile 中四按钮单行排布，“查看机关”四字折成两行，观感拥挤。
- 原因（事实）：≤420px 仍单行四等分，单按钮宽约 80px 不足以容纳图标+四字。
- 措施：≤420px 操作区改 flex-wrap 2×2（flex:1 1 42%），单行标签、目标更大。
- 复测：重截图 08-mobile 单行标签；AC16 三视口×三项目通过、按钮高 ≥44。
- 状态：已解决。

## I5 showWin 焦点目标类型错误 + 通关后撤销不可达
- 目标：指令六“通关后可撤销最后一步”、可访问焦点。
- 表现（代码审查发现，未上线）：`(next ?? $('btn-replay')).focus()` 中 next 为 LevelDef 非元素；
  通关遮罩盖住底部撤销按钮导致无法撤销。
- 原因（事实）：笔误 + 遮罩交互遗漏。
- 措施：焦点改为 next?btn-next:btn-replay；通关卡新增“撤销最后一步”按钮（hideWin+undo）。
- 复测：tsc 干净；AC07/AC08 通过；截图 07-win 含撤销按钮。
- 状态：已解决。

## I6 DeepSeek 默认模型 ID 过时
- 目标：指令十“调用时核对官方文档和模型 ID，不臆测版本”。
- 表现：.env.example 初版默认 deepseek-chat，不在 2026-11-16 官方文档模型表。
- 原因（事实）：沿用旧别名；官方当前表为 deepseek-flash / deepseek-v4-pro。
- 措施：默认改 deepseek-flash，注释列明文档模型与旧别名退役说明。
- 复测：WebFetch 官方文档确认；脚本以 env 模型为准。
- 状态：已解决（配置层面）；真实调用仍待密钥（见 I7）。

## I7 DeepSeek 实际调用未完成（外部待办）
- 目标：指令十/AC18 真实 API 调用证据。
- 表现：无 DEEPSEEK_API_KEY，脚本运行输出 status=not_called。
- 原因（事实）：密钥由用户本地配置，本会话不持有、也不应在聊天接收。
- 措施：脚本与配置说明完备；运行产生脱敏占位记录 evidence/api/review-*.json（status=not_called）。
- 复测：脚本无密钥正常退出、不影响游戏。
- 状态：未解决（外部待办：用户配置密钥后重跑）。

## I8 in-app 浏览器隐藏页 rAF 节流（非缺陷，验证兜底）
- 目标：指令五“动画取消/后台不永久锁死”。
- 表现：in-app 浏览器 visibilityState=hidden 时点击后 600ms 未提交。
- 原因（事实）：隐藏页 requestAnimationFrame 被节流；兜底 setTimeout(duration+300) 尚未到点。
- 措施：无需改代码；等待 >632ms 后兜底正确提交、释放锁、写存档（实测 remaining 减一、history=1）。
- 复测：隐藏页实测兜底生效；Playwright 可见页 rAF 正常、AC02 中间位移采样通过。
- 状态：已验证（兜底设计有效）。
## I9 .gitignore 误忽略测试证据目录
- 目标：交付要求“测试代码和实际测试结果”入库可追溯。
- 表现：最终核查 `git ls-files evidence` 发现 evidence/test-results/ 四个原始输出未被 Git 跟踪。
- 原因（事实）：.gitignore 的 `test-results/` 未锚定根目录，匹配了任意层级同名目录（含 evidence/test-results/）。
- 措施：改为 `/test-results/`（playwright-report/、blob-report/ 同样锚定），仅忽略 Playwright 根级输出。
- 复测：`git check-ignore` 不再命中 evidence/test-results/；四个证据文件随最终提交入库。
- 状态：已解决。

## I10 第 11 关重设后环形依赖无解
- 目标：7×7 重设后 12 关仍全部可解。
- 表现：validate:levels 报 l11「无解」（搜索 8 状态）。
- 原因（事实）：sd 下行路径被 a 的尾部格 (0,2) 挡，而 a 又等 sd 开 ◇ 门 → 循环依赖。
- 措施：a 头部 (1,2)→(2,2)、c 头部 (2,6)→(3,6)，让出第 0 列；复跑 validate 与锚点脚本。
- 复测：13/13 通过；l11 解法 sd→a→e→sc→d→b→c；sc 初始可动、双组初始关闭锚点成立。
- 状态：已解决。

## I11 单格开关箭徽章盖满箭身（视觉缺陷）
- 目标：箭头细化后仍清晰读作“箭”，移动端不出现“浮空圆钉”。
- 表现：360px 截图目检发现 len1 开关箭的白色徽章遮住全部箭身，只剩徽章+三角。
- 原因（事实）：箭身可见段仅 28 单位而徽章直径 24，且徽章底边与头部底边重合。
- 措施：箭尾延伸至 −back−44、徽章 r10 并居中（bx=−back/2−24），徽章两端露出箭身；重截 03/05/06/08 目检。
- 复测：桌面与 360px 截图确认 shaft+徽章+头 连续；66 浏览器项复跑通过。
- 状态：已解决。

## I12 第 14 关开关箭下向 len2 箭尾越界
- 目标：新增机关关仍满足“所有占用格不越界”。
- 表现：validate:levels 首跑报 l14 开关 s 占用 (0,−1) 越界。
- 原因（事实）：下向箭头尾部在头部上方（head−dir*(len−1)），设计时把头部放在 (0,0)，len2 尾部出界；与 I1 同类错误。
- 措施：s 头部 (0,0)→(0,1)。
- 复测：validate 19/19 通过；l14 解法 e→s→a→b→c→d 重放清空。
- 状态：已解决。

## I13 第 18 关同列两箭互挡形成环形依赖
- 目标：新增末关有解且解法可重放。
- 表现：validate:levels 报 l18「无解」。
- 原因（事实）：g 原设计 (6,2) 下向、sc (6,4) 上向，同列互相挡住对方离场路径，且两者都不受机关控制 → 循环依赖，与 I10 同类。
- 措施：g 头部 (6,2)→(4,2)，改为被 ◇ 门后的 b 阻挡（可由开关解开）；sc 保持 (6,4) 上向自由。
- 复测：validate 19/19 通过；l18 解法 f→sd→a→b→sc→c→g→d→e 重放清空；browser AC23 三视口实玩通关。
- 状态：已解决。

## I14 末关通关弹窗“下一关”按钮 hidden 失效（既有 UI 缺陷）
- 目标：末关通关后不应出现可点的“下一关”死按钮。
- 表现：新增 AC23 首跑三视口全失败：`#btn-next` 已设 hidden 属性但 Playwright 判定可见；目检确认末关弹窗仍显示该按钮。
- 原因（事实）：作者样式 `.btn{display:inline-flex}` 优先级高于 UA 的 `[hidden]{display:none}`，hidden 属性被覆盖；阶段 3 起即存在（l12 当时为末关），旧用例未覆盖末关故未暴露。
- 措施：src/style.css 增加 `[hidden] { display: none !important; }`；未改任何断言。
- 复测：重建后 75/75 浏览器项通过（含 AC23 三视口 toBeHidden）；截图 07 通关弹窗正常。
- 状态：已解决。

## I15 第 21 关上向 len2 箭头箭尾越界
- 目标：调头教学关所有占用格不越界。
- 表现：validate:levels 首跑报 l21「箭头 a 占用格越界 (6,7)」。
- 原因（事实）：a 头部 (6,6) 上向 len2，尾部在 (6,7) 出界（7×7 最大 y=6）；与 I1/I12 同类。
- 措施：a 头部 (6,6)→(6,5)。
- 复测：validate 28/28 通过；l21 解法 a→⇄r→r→s 重放清空；browser AC29 三视口实玩通关。
- 状态：已解决。

## I16 大棋盘 360px 格宽不足 44px（flex 父压缩）
- 目标：手机大棋盘格子 ≥44px，不靠缩小 UI。
- 表现：AC26 首跑实测格宽 39.15px；改 `width:calc(100vw - 2px)` 后仍 40.9px。
- 原因（事实）：.board-wrap 是 flex 子项，父容器按内容把它压缩回容器宽，满宽声明失效。
- 措施：≤420px 媒体查询内 `.board-wrap--tall{flex-shrink:0; width:calc(100vw - 2px); padding:1px}`。
- 复测：354/8=44.25px ≥44 通过；AC26 三视口无横溢且实玩 k1→s；截图 11 目检满宽。
- 状态：已解决。

## I17 点灯刷新用例误断言刷新后直入游戏屏
- 目标：灯状态刷新后恢复（用例本身，非产品缺陷）。
- 表现：AC38 首跑三视口失败：reload 后 #screen-game hidden。
- 原因（事实）：应用刷新后一律回首页，进行中存档需点「开始/继续」（#btn-start）恢复，与 AC13 既有流程一致；用例漏了该步。
- 措施：AC38 reload 后补 `page.click('#btn-start')`；产品行为不变。
- 复测：AC38 三视口通过（灯亮→撤销熄灭→再亮→刷新仍亮→全亮通关）。
- 状态：已解决。

## I18 提示点名用例局中切关用错按钮
- 目标：AC40 验证开关/接力/护送三类点名文案（用例本身，非产品缺陷）。
- 表现：AC40 首跑三视口 60s 超时：#btn-levels 只存在于首页，游戏屏不可点。
- 原因（事实）：游戏屏返回选关的按钮是 #btn-game-back（→showLevels），首页才是 #btn-levels。
- 措施：AC40 局中切关改 `#btn-game-back` + 直接点 `.level-tile:nth-child(n)`。
- 复测：AC40 三视口通过（开关 s/◇、开关 C、启动接力 A、护送 ★ 箭头 e）。
- 状态：已解决。

## 备注：末关锚点随新增关迁移（非缺陷）
- 「末关无下一关按钮」断言随每阶段新末关迁移：AC23(l18)→AC27(l20)→AC31(l22)→AC34(l24)→AC39(l27)；
  旧编号改为断言「下一关」按钮指向新教学关。属测试维护，未弱化任何断言。

## I19 徽记调头不选中，隐藏选中条内的发射按钮不可点（第三轮）
- 目标：AC29/AC31/AC38 调头后发射离场（用例流程，非产品缺陷）。
- 表现：阶段 H 首跑三视口超时：#btn-fire 位于 hidden 的 #sel-bar 内。
- 原因（事实）：第三轮徽记直接调头不再附带选中（设计如此），用例沿用「调头即选中」旧流程。
- 措施：用例在徽记调头后补「点箭身选中」一步再点发射；产品行为不变。
- 复测：15 项调头相关用例三视口通过。
- 状态：已解决。

## I20 len 字面量联合类型使 build 失败、陈旧 dist 造成浏览器假失败（第三轮）
- 目标：放宽长度上限后构建与浏览器实测一致。
- 表现：build 报 TS2322（'4'/'8' 不能赋给 '1|2|3'）；随后浏览器 AC02/AC07 失败于旧稀疏 l01。
- 原因（事实）：types.ts len 仍为字面量联合；build 失败后 dist 未更新，preview 复用旧 dist。
- 措施：len 改 number（合法范围交由 validateLevel 1~5 校验）；确立「src 改动后先 build 再跑浏览器」顺序。
- 复测：build 通过；浏览器以新 dist 复测。
- 状态：已解决。

## I21 铺满/加密重设计中的互挡环与重叠（第三轮）
- 目标：27 关铺满/加密后仍有解且可重放。
- 表现：validate 报 l03 无解（两次：d↔e、f↔h 互挡）、l09 无解（r5a↔r45b 互挡，搜索 147 状态）、l06 数据非法（m1/m2 重叠 (1,2)；改法一度引入 m2↔m4 环）。
- 原因（事实）：全铺满 motif 中 interior 蛇形箭出口射线撞另一支尚未离场的箭身，形成循环依赖。
- 措施：l03 中部重排为 f/g/h/i 可剥链；l09 r45b 改 (6,5) 朝下先走、r5a 延至 (5,5)；l06 m1 让出 (1,2)、m4 出口改 (4,1) 朝上。
- 复测：28 条重放全通过（l03 搜索 9 状态、l09 81 状态、l06 12 状态）。
- 状态：已解决。

## I22 填充箭违反校验上限/朝向一致性（第三轮）
- 目标：加密填充箭数据合法。
- 表现：validate 报 l04/l05/l07「长度 6 超出 1~5」、l06 m3「4 处直角弯」、l13 f6 / l18 q2 / l06 m4「dir 与折线末段朝向不一致」、l27 直 len7。
- 原因（事实）：6 格 straight 超直箭上限；蛇形路径弯数超限；path 末段方向与 dir 字段不符。
- 措施：6/7 格改 path 折线（0 弯）；m3 重排为 3 弯；f6/q2 末段实为向左改 dir left（出口出界更简洁）；m4 重排末段朝上。
- 复测：28 条重放全通过。
- 状态：已解决。

## I23 AC32 clearUntil 保留集不可达致清空棋盘超时（第三轮）
- 目标：AC32 保留「只剩 ⇄ 教学局面」再验证提示先调头。
- 表现：AC32 三视口 60s 超时：#btn-hint disabled（棋盘已清空通关）。
- 原因（事实）：填充箭 u6/u8 的出口依赖 s/⇄ 离场，保留集 ['r','s'] 不可达，循环把棋盘清空。
- 措施：保留集扩为 ['r','s','u6','u8']（仍只剩教学锚点 + 两支被锚点挡住的填充箭），提示首步仍为调头。
- 复测：AC32 三视口通过（status 含「调头」、r is-hint=1）。
- 状态：已解决。

## I24 electron-builder 资源下载卡死/超时（第四轮）
- 目标：npm run dist:win 产出 portable exe。
- 表现：首跑 connect ETIMEDOUT 57.155.223.240:443；改镜像后二跑卡在 electron 100% 之后（进程仅一条到 GitHub 185.199.108.133 的连接）。
- 原因（事实）：本机 GitHub 直连不可达；旧镜像路径 /mirrors/electron-builder-binaries/ 已 404，正确为 registry.npmmirror.com/-/binary/electron-builder-binaries/；builder 仍有个别请求走 GitHub。
- 措施：经用户确认 npmmirror 后，curl 预置 nsis-3.0.4.1/3.0.4.2、nsis-resources-3.4.1、winCodeSign-2.6.0 到 %LOCALAPPDATA%/electron-builder/Cache/<releaseName>/<filename>（downloadAndExtract 先查归档缓存）。
- 复测：资源本地命中，打包推进到 nsis 包与 portable exe。
- 状态：已解决。

## I25 SHASUMS256.txt 每次构建强制重拉致 600s 超时（第四轮）
- 表现：缓存预置后三跑仍 Timeout awaiting 'request' for 600000ms，停在 packaging 阶段。
- 原因（事实）：@electron/get 对 SHASUMS256.txt 以 cacheMode=Bypass 每次重下（#10039）；electron zip 虽已缓存仍触发该网络请求。
- 措施：从镜像取 v45.5.0 SHASUMS256.txt 存为 %LOCALAPPDATA%/electron/Cache/SHASUMS256.txt-45.5.0（resolveSeededChecksums 种子契约），并 sha256sum 实测缓存 zip 与文件条目一致（20155c8b…69bd）。
- 复测：四跑退出码 0，release/EnArrower-1.0.0-portable.exe 产出。
- 状态：已解决。

## I26 桌面冒烟取证方式修正（第四轮，非游戏缺陷）
- 表现：全屏 CopyFromScreen 截屏全黑；冒烟脚本点普通箭身后等 #btn-fire 可点而超时。
- 原因（事实）：会话无可见桌面致截屏黑；普通箭头点箭身即发射，#btn-fire 随 #sel-bar 仅 ⇄ 选中时显示（与网页版一致），脚本假设错误。
- 措施：exe 带 --remote-debugging-port=9222，Playwright connectOverCDP 抓窗口截图与 DOM/存档断言；脚本改为点箭身直接验证发射。
- 复测：截图 19/20 目检正常；发射、存档、重启恢复、零外联均实测通过。
- 状态：已解决。
