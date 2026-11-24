# 验收表（AC01~AC40）

初始一律“未验证”；下表为 2026-11-16 实际执行后的状态。证据路径见 `evidence-index.md`。
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
| AC12 | 自动验证 27 关+逐步重放 | 数据合法、均达通关条件 | 通过 | validate-levels 28 条全通过（27 关+样例，含逐关耗时；护送关以 ★ 离场为准）；levels.test 逐关重放；levels.txt |
| AC13 | 通关/进行中/撤销后刷新 | 恢复稳定状态+历史+解锁 | 通过 | browser AC13 刷新后 remaining=[b,c] history=1 undo enabled |
| AC14 | 动画中刷新/坏档/存储不可用 | 不恢复半途、不锁死、有说明 | 通过 | browser AC14 坏档回退+动画中刷新回上一稳定；unit storage 写入失败/不可用 |
| AC15 | 悬停/聚焦开关、手机查看模式 | 显示关联门+下一状态、预览不移动 | 通过 | browser AC15 聚焦预览 gate.is-preview+“将开启”；查看模式点击不移动 |
| AC16 | 360/390/桌面操作 | 棋盘完整、按钮可点、无横溢 | 通过（仿真） | browser AC16 三宽度×三项目 overflow≤1、按钮高≥44；截图 02/08 |
| AC17 | 减少动态+切换窗口尺寸 | 规则/回调/存档正确、不锁死 | 通过 | browser AC17 reduced-motion 结果一致；动画中改尺寸不锁死；隐藏页兜底实测 |
| AC18 | 实际调用 DeepSeek 完成审查 | 脱敏请求/响应/模型/实录 | 未完成 | 脚本+配置完备；无密钥 status=not_called（evidence/api/review-*.json）；待用户配置 |
| AC19 | 核查指令/截图/问题/阶段提交 | 可追溯、失败修复成对、无伪造 | 部分通过 | prompts/00 文本+issues 成对+3 阶段提交+evidence；完整用户截图待补 |
| AC20 | 教师可访问 Gitee 最终检出 | 代码/README/配置/报告一致、commit 可定位 | 未完成 | 本地 git 已就绪；Gitee 仓库/授权待外部办理 |
| AC21 | 第13关先走挡路箭再走开关 | 死局提示正确、门状态不变 | 通过 | browser AC21 三视口：f→s 后 hint 报“无法通关”、open.diamond=false、remaining=[a,b,c] |
| AC22 | 第17关双组互衔完整解法 | 七步清空、通关并解锁 18 | 通过 | browser AC22 三视口：sc→sd→e→a→b→d→c 后 win 可见、completed 含 l17、unlocked 含 l18 |
| AC23 | 第18关九步通关 | 通关且“下一关”指向折线教学关 l19 | 通过 | browser AC23 三视口：九步清空、win 可见、#btn-next 文案含「折弯初识」（末关无下一关断言已随新末关迁移至 AC39） |
| AC24 | 折线离场绳随动画 | 路径逐帧展开、弯折中途可见、尾出界后移除 | 通过 | browser AC24 三视口：d 逐帧采样 distinct>3、midBent=true、removed=true；截图 10 |
| AC25 | 折线箭身挡路 | d 被 k 弯折身阻挡、状态不变 | 通过 | browser AC25 三视口：status 被挡住、remaining/history 不变；unit 折线 describe |
| AC26 | 大棋盘 360px 竖屏 | 格≥44px、无横溢、可实玩 | 通过（仿真） | browser AC26：格宽 44.25px、overflow≤1、实玩 k1→s；截图 11 整页目检 |
| AC27 | 第20关大棋盘完整通关 | 九步清空、下一关指向调头教学 l21 | 通过 | browser AC27 三视口：k1→k2→s→a→b→c→d→e→f 后 win、btn-next 含「调头初试」 |
| AC28 | 单击 ⇄ 只选中；发射被挡不变；调头后向左离场 | 选中条出现、阻挡不改状态、调头可解 | 通过 | browser AC28 三视口：sel-bar 可见、被挡 remaining 不变、调头后发射成功 |
| AC29 | 第21关完整通关 | a→调头r→发射r→s 四步清空 | 通过 | browser AC29 三视口：win 可见、completed 含 l21 |
| AC30 | 调头后刷新 | 恢复朝向与选中前状态 | 通过 | browser AC30 三视口：刷新+继续后 turned=['r']、r aria 含「当前向左」 |
| AC31 | 第22关双向抉择 | 疏通左路后调头通关、下一关指向接力教学 l23 | 通过 | browser AC31 三视口：t→c→调头r→发射r→s 后 win、btn-next 含「接力过桥」 |
| AC32 | 提示识别调头操作 | a 离场后提示先调头且高亮 r | 通过 | browser AC32 三视口：status 含「调头」、r is-hint=1 |
| AC33 | 点 B 只高亮 A；接力失败双方不动；单撤销全恢复 | 预演整体成败、一次撤销恢复 A/B+闸门 | 通过 | browser AC33 三视口：B 点击仅高亮 A、失败 remaining=[A,B,C] history=0、成功后 history=2、win-undo 后 [A,B]+门开 |
| AC34 | 第24关接力长链完整通关 | 四步清空、下一关指向护送关 l25 | 通过 | browser AC34 三视口：s→A⇒→t→C⇒ 后 win、history=4、btn-next 含「护送星标」 |
| AC35 | 接力顺序动画 | A 先出、B 后出逐帧可证 | 通过 | browser AC35 三视口：sawLeaderGoneFollowerPresent=true、bothGone=true；截图 14 中途帧 |
| AC36 | 第25关护送 ★ | ★ 离场即通关、a 留场、提示指向 ★、下一关 l26 | 通过 | browser AC36 三视口：win+status 含 ★、remaining=['a']、btn-next 含「灯与调头」；截图 15 |
| AC37 | 第26关向右直接发射 | 通关但灯不亮、弹窗说明缺灯 | 通过 | browser AC37 三视口：lamp--lit=0、win-detail 含「还有 1 盏灯没亮」 |
| AC38 | 第26关调头向左点灯 | 灯亮→撤销熄灭→刷新恢复→全亮通关 | 通过 | browser AC38 三视口：lit=['0,3']→undo lit=[]→刷新仍亮→win-detail 含「点亮小屋」；截图 16 |
| AC39 | 第27关（末关）终局灯屋 | 接力+向右各点一盏、全亮通关、无下一关 | 通过 | browser AC39 三视口：lit 两盏、win-detail 含「点亮小屋：所有灯都亮了」、#btn-next 隐藏；截图 17 |
| AC40 | 提示文案具体化 | 开关/接力/护送三类点名 | 通过 | browser AC40 三视口：「开关 s」+◇、「开关 C」、「启动接力 A」、「护送 ★ 箭头 e」 |

## 说明
- 阶段 5（2026-11-16 用户追加）：12 关重设为 7×7、显示 640px、箭头细化与机关精修后，AC01–AC17 以相同断言全量复测通过（81 单元 / 13 关重放 / 66 浏览器 / build）；截图重截目检。网格范围以用户确认的 D10 为准，回归样例仍 5×3。
- 阶段 6（2026-11-16 用户追加「再多创建机关关卡」）：新增 l13–l18 后全量复测 99 单元 / 19 条重放（18 关+样例）/ 75 浏览器（25 用例 ×3 视口）/ build 全通过；AC21–AC23 为新增用例，首跑 AC23 暴露末关 hidden 按钮缺陷（I14）修复后复测通过。截图 04 扩为 18 格、新增 09（第 18 关）并重截目检。
- 第二轮（2026-11-24 用户指令，阶段 A–F）：新增 l19–l27 与折线/⇄/接力/护送/点灯机制后全量复测 166 单元 / 28 条重放（27 关+样例，含逐关求解耗时）/ 126 浏览器（42 用例 ×3 视口）/ build 全通过。AC24–AC40 为新增用例；首跑失败 I15–I18 均修复后以相同断言复测。「末关无下一关」断言随新末关迁移（AC23→AC27→AC31→AC34→AC39），旧编号改断言下一关指向新教学关，未弱化断言。截图 10–17 新增并目检。本轮不做最终报告与整体收尾。
- “通过（仿真）”指 Playwright 移动视口仿真，不等同真机；真机待补。
- AC18/AC20 为外部待办，不阻塞本地功能；AC19 的完整截图/导出由用户留存。
- 所有“通过”均有对应实际执行的测试或脚本输出，未执行者不写通过。