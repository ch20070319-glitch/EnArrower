# 验收表（AC01~AC59）

初始一律“未验证”；下表为各轮实际执行后的状态（最近复测 2026-11-26，第六轮）。证据路径见 `evidence-index.md`。
移动设备为 Playwright 仿真（非真机）；真机验证另列待补。

| 编号 | 操作/条件 | 预期 | 状态 | 证据 |
|---|---|---|---|---|
| AC01 | 新目录安装/启动/构建 | 可打开、构建成功、无缺失 | 通过 | npm install/dev/preview/build 实跑；build.txt；browser AC01 无控制台错误 |
| AC02 | 四向不同长度无遮挡点击 | 连续沿向移动、尾出界后移除 | 通过 | unit rules 四向 len1-3；browser AC02 中间位移采样（distinct>5、mid>3、removed=true） |
| AC03 | 点击被挡箭头 | 原位、显示阻挡、不改机关/历史 | 通过 | unit 阻挡判定；browser AC03 remaining/history 不变 + status“被挡住” |
| AC04 | 开关成功离场/被阻挡开关 | 本组切换一次、他组不变、被挡不切换 | 通过 | unit 闸门碰撞；browser AC04 circle 切换 diamond 不变 |
| AC05 | 经过开启闸门/自身原格 | 无假碰撞；关闭闸门不能过 | 通过 | unit“关闭闸门阻挡开启可通过”“自身原占用格不误判” |
| AC06 | 动画中连点+撤销/重开/切关 | 只提交一次、无重复切换 | 通过 | browser AC06 连点 8 次 remaining=[b,c] history=1；动画期间四按钮 disabled |
| AC07 | 最后一支开关离场 | 动画+机关更新后通关 | 通过 | unit“最后一支离场后即使关门也通关”；browser AC07 win 可见+解锁 l02 |
| AC08 | 成功移动/切换后连续撤销 | 逐步恢复箭头+闸门、空历史禁用 | 通过 | unit 会话无限撤销；browser AC08 门状态恢复+undo disabled |
| AC09 | 中途重开 | 初始布局+门状态+空历史、保留解锁 | 通过 | unit 重开；browser AC09 remaining/open/history 复位 |
| AC10 | 初始/中途可解请求提示 | 提示箭头合法且移动后仍可解 | 通过 | unit 求解器与提示；browser AC10 is-hint=1 且不自动移动 |
| AC11 | 样例先 A 后提示 | 即使 C 可移动也识别无解 | 通过 | unit fixture“先 A 后提示 dead-end”；browser AC11 第7关先开关后提示“无法通关” |
| AC12 | 自动验证 27 关+逐步重放 | 数据合法、均达通关条件 | 通过 | validate-levels 28 条全通过（27 关+样例，含逐关覆盖率与耗时；无机关无灯关强制铺满；护送关以 ★ 离场为准）；levels.test 逐关重放；levels.txt |
| AC13 | 通关/进行中/撤销后刷新 | 恢复稳定状态+历史+解锁 | 通过 | browser AC13 刷新后 remaining=[b,c] history=1 undo enabled |
| AC14 | 动画中刷新/坏档/存储不可用 | 不恢复半途、不锁死、有说明 | 通过 | browser AC14 坏档回退+动画中刷新回上一稳定；unit storage 写入失败/不可用 |
| AC15 | 悬停/聚焦开关、手机查看模式 | 显示关联门+下一状态、预览不移动 | 通过 | browser AC15 聚焦预览 gate.is-preview+“将开启”；查看模式点击不移动 |
| AC16 | 360/390/桌面操作 | 棋盘完整、按钮可点、无横溢 | 通过（仿真） | browser AC16 三宽度×三项目 overflow≤1、按钮高≥44；截图 02/08 |
| AC17 | 减少动态+切换窗口尺寸 | 规则/回调/存档正确、不锁死 | 通过 | browser AC17 reduced-motion 结果一致；动画中改尺寸不锁死；隐藏页兜底实测 |
| AC18 | 实际调用 DeepSeek 完成审查 | 脱敏请求/响应/模型/实录 | 未完成 | 脚本+配置完备；无密钥 status=not_called（evidence/api/review-*.json）；待用户配置 |
| AC19 | 核查指令/截图/问题/阶段提交 | 可追溯、失败修复成对、无伪造 | 部分通过 | prompts/00 文本+issues 成对+3 阶段提交+evidence；完整用户截图待补 |
| AC20 | 教师可访问 Gitee 最终检出 | 代码/README/配置/报告一致、commit 可定位 | 未完成 | 本地 git 已就绪；Gitee 仓库/授权待外部办理 |
| AC21 | 第13关先走挡路箭再走开关 | 死局提示正确、门状态不变 | 通过 | browser AC21 三视口：f→s 后 hint 报“无法通关”、open.diamond=false、remaining=初始−{f,s} |
| AC22 | 第17关双组互衔完整解法 | 求解器解法重放清空、通关并解锁 18 | 通过 | browser AC22 三视口：playSolution 清空（解法含 sc/sd 双组互衔）、win 可见、completed 含 l17、unlocked 含 l18 |
| AC23 | 第18关完整通关 | 通关且“下一关”指向折线教学关 l19 | 通过 | browser AC23 三视口：playSolution 清空、win 可见、#btn-next 文案含「折弯初识」（末关无下一关断言已随新末关迁移至 AC39） |
| AC24 | 折线离场绳随动画 | 路径逐帧展开、弯折中途可见、尾出界后移除 | 通过 | browser AC24 三视口：d 逐帧采样 distinct>3、midBent=true、removed=true；截图 10 |
| AC25 | 折线箭身挡路 | d 被 k 弯折身阻挡、状态不变 | 通过 | browser AC25 三视口：status 被挡住、remaining/history 不变；unit 折线 describe |
| AC26 | 大棋盘 360px 竖屏 | 格≥44px、无横溢、可实玩 | 通过（仿真） | browser AC26：格宽 44.25px、overflow≤1、实玩 k1→s；截图 11 整页目检 |
| AC27 | 第20关大棋盘完整通关 | 求解器解法重放清空、下一关指向调头教学 l21 | 通过 | browser AC27 三视口：playSolution 清空后 win、btn-next 含「调头初试」 |
| AC28 | 单击 ⇄ 只选中；发射被挡不变；调头后向左离场 | 选中条出现、阻挡不改状态、调头可解 | 通过 | browser AC28 三视口：sel-bar 可见、被挡 remaining 不变、调头后发射成功 |
| AC29 | 第21关完整通关 | 徽记调头+发射锚点步后补完填充箭清空 | 通过 | browser AC29 三视口：a→徽记调头r→点选r→发射r→s 后 finishLevel 补完、win 可见、completed 含 l21 |
| AC30 | 调头后刷新 | 恢复朝向与选中前状态 | 通过 | browser AC30 三视口：刷新+继续后 turned=['r']、r aria 含「当前向左」 |
| AC31 | 第22关双向抉择 | 疏通左路后调头通关、下一关指向接力教学 l23 | 通过 | browser AC31 三视口：t→c→徽记调头r→点选r→发射r→s 后 finishLevel 补完、win、btn-next 含「接力过桥」 |
| AC32 | 提示识别调头操作 | 保留 ⇄ 教学局面后提示先调头且高亮 r | 通过 | browser AC32 三视口：clearUntil 保留 ['r','s','u6','u8']、status 含「调头」、r is-hint=1 |
| AC33 | 点 B 只高亮 A；接力失败双方不动；单撤销全恢复 | 预演整体成败、一次撤销恢复 A/B+闸门 | 通过 | browser AC33 三视口：B 点击仅高亮 A、失败 remaining=初始不变 history=0、成功后 history=2、win-undo+撤销回接力步再撤接力本身 → [初始−C]+门开 |
| AC34 | 第24关接力长链完整通关 | 接力锚点步后补完填充箭清空、下一关指向护送关 l25 | 通过 | browser AC34 三视口：s→A⇒→t→C⇒ 后 finishLevel 补完、win、history≥4、btn-next 含「护送星标」 |
| AC35 | 接力顺序动画 | A 先出、B 后出逐帧可证 | 通过 | browser AC35 三视口：sawLeaderGoneFollowerPresent=true、bothGone=true；截图 14 中途帧 |
| AC36 | 第25关护送 ★ | ★ 离场即通关、其余可留场、提示指向 ★、下一关 l26 | 通过 | browser AC36 三视口：win+status 含 ★、remaining=初始−{s,b,e}、btn-next 含「灯与调头」；截图 15 |
| AC37 | 第26关向右直接发射 | 通关但灯不亮、弹窗说明缺灯 | 通过 | browser AC37 三视口：lamp--lit=0、win-detail 含「还有 1 盏灯没亮」 |
| AC38 | 第26关调头向左点灯 | 灯亮→撤销熄灭→刷新恢复→全亮通关 | 通过 | browser AC38 三视口：lit=['0,3']→undo lit=[]→刷新仍亮→win-detail 含「小屋全部点亮」、lampBest 含 l26；截图 16 |
| AC39 | 第27关（末关）终局灯屋 | 接力+向右各点一盏、全亮通关、无下一关 | 通过 | browser AC39 三视口：lit 两盏、win-detail 含「小屋全部点亮」、#btn-next 隐藏、lampBest 含 l27；截图 17 |
| AC40 | 提示文案具体化 | 开关/接力/护送三类点名 | 通过 | browser AC40 三视口：「开关 s」+◇、「开关 C」、「启动接力 A」、「护送 ★ 箭头 e」 |
| AC41 | Windows 免安装单 exe 可启动可玩 | portable exe 产出、双击等价启动、app:// 加载、发射与存档正常 | 通过 | desktop.txt：dist:win 退出码 0、exe 110,485,570 字节；CDP 目标 app://local/index.html；点箭身 a/b 离场且 save remaining 更新；截图 19 目检 |
| AC42 | 桌面存档独立且重启恢复 | userData 存档、重启后恢复中途局面 | 通过 | desktop.txt：%APPDATA%/enarrower 含 Local Storage；taskkill 重启后 remaining 仍 c..k，继续后「第 1 关 · 9 支」ids c..k；截图 20 |
| AC43 | 桌面版零网络请求 | 无外联资源与连接 | 通过 | desktop.txt：resource timing 空数组；Get-NetTCPConnection 对 EnArrower 进程无 ESTABLISHED 外联 |
| AC44 | Qoder Sites 公网部署可玩 | 发布 committed、public 访问、公网实测加载/发射/存档 | 通过 | sites.txt：published=true、policy.mode=public；公网 URL 实测进入第 1 关、发射 a 后存档 b..k、无跨域资源；截图 21 目检 |
| AC45 | 全新玩家首玩 | 开始游戏→5×3 教学三步通关→正式第1关；教学不计完成数 | 通过 | browser AC45 三视口：btn-start「开始游戏」、game-title「新手教学」、跳过按钮可见、三步通关、btn-next「初次见面」、completed=[]、current=null、首页仍「27 个原创关卡」 |
| AC46 | 跳过教学 | 跳过直达第1关；刷新后不再弹教学 | 通过 | browser AC46 三视口：跳过后「第 1 关」、tutorialDone=true、刷新后 btn-start「继续第 1 关」 |
| AC47 | 老玩家直接进入原流程 | 完成 l01/l02 后主按钮「进入第 3 关」→折弯初识 | 通过 | browser AC47 三视口：btn-start「进入第 3 关」、game-title「第 3 关 · 折弯初识」 |
| AC48 | 首页主按钮四态 | 进行中/刚通关/重玩中途/全通关，文字与去向一致 | 通过 | browser AC48a-d 三视口：「继续第 8 关」恢复 l06 棋盘；「进入第 9 关」→先走后关；「继续重玩第 6 关」恢复 l04 中途且可撤销；「回顾关卡」→选关页 |
| AC49 | 完成计数只算不同正式关 | 教学与重复通关不增加计数 | 通过 | browser AC49 三视口：completed=['l01'] 重玩通关后仍 ['l01']，首页「已完成 1 / 27 关」 |
| AC50 | 分级提示 | 第一次观察不点名、第二次点名；移动/重开重置；不提示已离场箭 | 通过 | browser AC50 三视口：l23 首提「观察」无「开关 C」且无 is-hint，二提「开关 C」；C 离场后重置且不再提 C，二提「启动接力 A」；重开后再分级 |
| AC51 | 接力受阻反馈 | 先虚线高亮再挡路闸门高亮；整队不动；短文字 | 通过 | browser AC51 三视口：relay-link.is-active=1→gate.is-blocker=1、status「接力没启动」含 B、remaining/history 不变 |
| AC52 | 接力成功虚线贯穿 | A/B 离场动画期间虚线保持，结束后清除；一次接力=一步 | 通过 | browser AC52 三视口：动画中 is-active≥1、结束后 relay-link=0、remaining=初始−{A,B,C}、history=2 |
| AC53 | 点灯可选进度即时 | 入场 0/1→点亮 1/1→撤销 0/1；主目标不含灯 | 通过 | browser AC53 三视口：#game-optional 三态文本精确匹配、#game-goal 不含「灯」 |
| AC54 | 全亮标记持久 | 全亮通关记 lampBest+选关标记；漏灯重玩不覆盖；刷新保留 | 通过 | browser AC54 三视口：lampBest=['l26']、.level-best「小屋全亮」、漏灯重玩后仍 ['l26']、刷新后标记仍在 |
| AC55 | 旧存档重排兼容 | 完成到 l06 的旧档：l19/l21 已解锁、进度不丢、下一未完成按新序 | 通过 | browser AC55 三视口：「已完成 6 / 27 关」、l19/l21/l07 可点 l08 锁定、「进入第 3 关」→折弯初识；unit 解锁缺口补齐用例 |
| AC56 | 选关三章节布局 | 基础疏通5/闸门进阶15/特殊箭头7；编号按显示序；360/1280 无横溢 | 通过 | browser AC56 三视口+两宽度：章节数/标题/卡片数、l19=03 l21=04 l27=27、scrollWidth 溢出≤1、卡片≥44px 可点 |
| AC57 | 入场文案分工 | 目标栏只写目标、状态栏留空、玩法说明独立不重复 | 通过 | browser AC57 三视口：l23 goal 含「虚线连接的两支箭头一起离场」、intro 含「领头」、status 空、goal≠intro |
| AC58 | 1.1.0 exe 冒烟 | 首页入口/教学/接力关/灯关/零外联/重启恢复 | 通过 | exe-smoke-1.1.0.txt：首页「开始游戏」→教学→跳过→第1关；l23 受阻虚线→闸门高亮、接力 history=2、单撤销恢复 A/B；l26 可选 0/1→1/1→撤销 0/1；零外联；正常退出重启存档逐字一致并恢复第26关；截图 22–27 目检 |
| AC59 | GitHub 推送与 v1.1.0 Release | 远端提交一致、tag 指向实测提交、exe 附件回读校验 | 通过 | push 46bf437..8053dd1（main 无保护，直推无 PR）；ls-remote main=8053dd14d1e0…；tag v1.1.0 peel=8053dd1；release id 459405314（draft=false）；asset id 795869926 state=uploaded 110,487,368 字节；公网下载 HTTP 200 回读 sha256 763218e5…751 与本地一致 |

## 说明
- 阶段 5（2026-11-16 用户追加）：12 关重设为 7×7、显示 640px、箭头细化与机关精修后，AC01–AC17 以相同断言全量复测通过（81 单元 / 13 关重放 / 66 浏览器 / build）；截图重截目检。网格范围以用户确认的 D10 为准，回归样例仍 5×3。
- 阶段 6（2026-11-16 用户追加「再多创建机关关卡」）：新增 l13–l18 后全量复测 99 单元 / 19 条重放（18 关+样例）/ 75 浏览器（25 用例 ×3 视口）/ build 全通过；AC21–AC23 为新增用例，首跑 AC23 暴露末关 hidden 按钮缺陷（I14）修复后复测通过。截图 04 扩为 18 格、新增 09（第 18 关）并重截目检。
- 第二轮（2026-11-24 用户指令，阶段 A–F）：新增 l19–l27 与折线/⇄/接力/护送/点灯机制后全量复测 166 单元 / 28 条重放（27 关+样例，含逐关求解耗时）/ 126 浏览器（42 用例 ×3 视口）/ build 全通过。AC24–AC40 为新增用例；首跑失败 I15–I18 均修复后以相同断言复测。「末关无下一关」断言随新末关迁移（AC23→AC27→AC31→AC34→AC39），旧编号改断言下一关指向新教学关，未弱化断言。截图 10–17 新增并目检。本轮不做最终报告与整体收尾。
- 第三轮（2026-11-25 用户指令，阶段 H–J）：徽记直接调头 / 无机关无灯关铺满+机关灯关加密 / 直箭 len≤5、折线 ≤9 格 ≤3 弯后，以相同断言强度全量复测 166 单元 / 28 条重放（含逐关覆盖率，无机关无灯关强制 49/49）/ 126 浏览器（42 用例 ×3 视口）/ build 全通过。锚点迁移（计算剩余 / playSolution / finishLevel / clearUntil 保留集 / 撤销回接力步）属测试维护，未弱化断言；首跑失败 I19–I23 均修复后复测。截图新增 18（徽记调头）、18 张全重截并目检 03/07/10/11/16/17/18。本轮不做最终报告与整体收尾。
- 第四轮（2026-11-25 用户指令，阶段 K）：Windows 免安装桌面版（Electron portable exe）。新增 AC41–AC43 以 desktop.txt 冒烟实测为证据（启动/游玩/存档恢复/零外联）；网页版以相同断言复测 166 单元 / 28 重放 / 126 浏览器 / build 全通过。exe 不进 Git（release/ 已忽略）；无签名、他机双击与 SmartScreen 表现未实测，不写通过。本轮不做最终报告与整体收尾。
- 第五轮（2026-11-25 用户指令，阶段 L）：Qoder Sites 公网部署。新增 AC44 以 sites.txt 与公网实测为证据；无源码改动，网页/桌面/单元回归沿用第四轮结果。论坛发布本次未要求、未执行。本轮不做最终报告与整体收尾。
- 第六轮（2026-11-26 用户指令，阶段 M）：体验更新 + 1.1.0。新增 AC45–AC57 以 browser 三视口实测为证据；AC38/AC39 文案断言随可选挑战改写迁移（「小屋全部点亮」），AC23/AC27 下一关断言随 DISPLAY_ORDER 迁移（长湾疏流/双向抉择），AC40/AC10/AC32/AC36 改两次点击取具体提示（分级提示需求），均属需求变更后的断言迁移，未弱化强度。AC55 首跑失败为期望值写错（旧档重排后下一未完成是第3关而非第9关），修正断言后 180 项全过。复测 176 单元 / 28 重放 / 180 浏览器 / build。AC58/AC59 待 exe 冒烟与推送回读后更新。
- “通过（仿真）”指 Playwright 移动视口仿真，不等同真机；真机待补。
- AC18/AC20 为外部待办，不阻塞本地功能；AC19 的完整截图/导出由用户留存。
- 所有“通过”均有对应实际执行的测试或脚本输出，未执行者不写通过。- 第六轮 exe 冒烟说明：重启恢复按真实用户「正常关闭再打开」路径实测（window.close → app.quit 刷盘）；taskkill /F 强杀落在 Chromium localStorage 批量提交窗口（首批约 5s、后续批次实测可达约 60s）会丢最近写入，属引擎行为而非游戏缺陷，探针事实见 docs/issues.md I27，不据此写「断电恢复通过」。
