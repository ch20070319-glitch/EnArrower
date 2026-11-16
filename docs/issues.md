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