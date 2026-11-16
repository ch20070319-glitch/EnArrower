# 技术与设计取舍记录

日期：2026-11-16｜决定者：Qoder（实现）＋ 用户（范围与验收基线）。

## D1 技术栈：Vite + TypeScript + SVG + CSS（方案 A）
理由：第一版页面少、规则集中，SVG 适合离散网格与矢量箭头，CSS/rAF 足够动效；不引入 React 或游戏引擎，
避免组件生命周期与动画回调不同步。规则为纯函数（`src/core/`），与渲染（`src/ui/`）严格分离，DOM 不作规则状态来源。
实际版本（见 package-lock.json）：vite 8.3.8、typescript 7.0.2、vitest 5.1.0、@playwright/test 1.65.1、tsx 4.23.15；
运行环境 Node v24.20.0 / npm 11.19.0 / win32-x64。esbuild postinstall 经 `npm install-scripts approve esbuild` 放行。

## D2 规则建模：共线射线校验
箭头共线平移，扫过的新格恰为“头部前沿到棋盘边缘”的射线；自身原占用格天然不在射线上，故无需额外排除。
`checkMove` 沿射线返回首个阻挡物（箭头 id 或闸门组+坐标），供高亮。`exitDistance` 给出尾部完全出界格数，仅几何、与规则无关。
取舍：不模拟逐格碰撞，因共线保证等价，复杂度 O(射线长)。

## D3 机关：组共享布尔状态
`MechanismDef{group, initialOpen, gates[]}`；状态 `open: Partial<Record<GroupId,boolean>>`。
`applyMove` 先校验后切换，一次返回新状态；同组多开关靠多次 applyMove 自然实现奇偶切换。符号 ◇/○ + 颜色 + 开(虚线)/关(实心) 三重区分。

## D4 动画：rAF + viewBox 单位 + 兜底定时器
位移以 viewBox 网格单位计算（CELL=100），窗口缩放只改 CSS 尺寸不改碰撞/位移结果。
时长 clamp(250,450, 230+dist*0.24)；easeOutCubic；完成逻辑 `finished` 标志保证只执行一次；
rAF 之外设 duration+300ms 兜底 setTimeout，后台标签页 rAF 被节流时也能完成、不永久锁死（已实测隐藏页触发兜底）。
reduced-motion 时 duration=40ms 直接 finish，规则结果不变。输入锁为控制器布尔 `locked`，非视觉遮罩。

## D5 存档：schemaVersion=1 + 严格校验 + 安全回退
`loadSave` 校验版本、id 列表、当前状态与历史逐条对照关卡；任何异常回退默认进度并 toast 说明，不抛错不白屏。
只存稳定状态（remaining+open+history），不存动画坐标/锁/回调。写入失败返回 ok=false + 提示，游戏继续。
存储不可用（隐私模式）探测失败 → adapter=null，全程可玩但提示进度不保存。

## D6 求解器：记忆化 DFS
状态键 = 排序剩余 id + 各组门标志；上限 12 箭 ×4 门组合，状态空间 ≤ 2^12*4，无需更复杂系统。
`hint` 先 solve 当前状态，无解返回 dead-end；有解取解法首步（保证执行后仍可解）。

## D7 视觉：暖纸解压风
背景暖奶油 #f4efe4 + 极淡暖/冷光晕 + 细点纹理；主色 teal #3e8e7e（普通箭头/主按钮），
diamond amber #d9932c、circle violet #8a63c9、阻挡 coral #d96a5b、提示/成功 green #5fa777。
棋盘为视觉中心、留白充足；箭头渐变线身+三角头+组徽标；闸门符号+颜色+开合填充区分。
手机 ≤420px 操作区改 2×2 网格保证单行标签与 ≥44px 目标。自定义滚动条沿用 palette。尊重 prefers-reduced-motion。

## D8 DeepSeek 模型 ID 核对
2026-11-16 抓取官方 https://api-docs.deepseek.com/ ：base_url `https://api.deepseek.com`、
端点 `/chat/completions`、Bearer 鉴权；当前文档模型表为 `deepseek-flash`（默认）与 `deepseek-v4-pro`。
据此把 .env.example 默认模型从臆测的 `deepseek-chat` 改为文档列出的 `deepseek-flash`，并在注释标明旧别名不在当前模型表。
未配置密钥，实际调用尚未发生（见 api-usage.md）。

## D9 开发工具如实记录
本次实现由 Qoder 完成；附件模板提及 TRAE 仅为课程原始提示词载体，不据此虚构 TRAE 使用经历。
DeepSeek 审查脚本存在但无密钥 → 标记 not_called，不声称已调用。