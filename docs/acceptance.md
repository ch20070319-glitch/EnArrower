# 验收表（AC01~AC20）

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
| AC12 | 自动验证 12 关+逐步重放 | 数据合法、均清空 | 通过 | validate-levels 13 条全通过；levels.test 逐关重放；levels.txt |
| AC13 | 通关/进行中/撤销后刷新 | 恢复稳定状态+历史+解锁 | 通过 | browser AC13 刷新后 remaining=[b,c] history=1 undo enabled |
| AC14 | 动画中刷新/坏档/存储不可用 | 不恢复半途、不锁死、有说明 | 通过 | browser AC14 坏档回退+动画中刷新回上一稳定；unit storage 写入失败/不可用 |
| AC15 | 悬停/聚焦开关、手机查看模式 | 显示关联门+下一状态、预览不移动 | 通过 | browser AC15 聚焦预览 gate.is-preview+“将开启”；查看模式点击不移动 |
| AC16 | 360/390/桌面操作 | 棋盘完整、按钮可点、无横溢 | 通过（仿真） | browser AC16 三宽度×三项目 overflow≤1、按钮高≥44；截图 02/08 |
| AC17 | 减少动态+切换窗口尺寸 | 规则/回调/存档正确、不锁死 | 通过 | browser AC17 reduced-motion 结果一致；动画中改尺寸不锁死；隐藏页兜底实测 |
| AC18 | 实际调用 DeepSeek 完成审查 | 脱敏请求/响应/模型/实录 | 未完成 | 脚本+配置完备；无密钥 status=not_called（evidence/api/review-*.json）；待用户配置 |
| AC19 | 核查指令/截图/问题/阶段提交 | 可追溯、失败修复成对、无伪造 | 部分通过 | prompts/00 文本+issues 成对+3 阶段提交+evidence；完整用户截图待补 |
| AC20 | 教师可访问 Gitee 最终检出 | 代码/README/配置/报告一致、commit 可定位 | 未完成 | 本地 git 已就绪；Gitee 仓库/授权待外部办理 |

## 说明
- “通过（仿真）”指 Playwright 移动视口仿真，不等同真机；真机待补。
- AC18/AC20 为外部待办，不阻塞本地功能；AC19 的完整截图/导出由用户留存。
- 所有“通过”均有对应实际执行的测试或脚本输出，未执行者不写通过。