# 课程报告提纲（report-outline）

按要求的八部分组织。每部分列出可直接引用的真实素材位置；个人信息与个人总结由本人填写，不代写。

## 1. 项目概述与需求分析
- 素材：docs/requirements.md（需求逐条整理）、docs/prompts/00-initial-requirements.md（用户指令原文）。
- 要点：轻松解压 + 顺序推理的箭头解谜；无计时/生命/扣分；无限撤销/重开/提示；单机网页、本地存档、运行不依赖 AI API。

## 2. 功能清单与验收标准
- 素材：docs/acceptance.md（AC01–AC23 实际状态）、docs/requirements.md 功能清单。
- 要点：规则引擎（四向/长度/阻挡/自身格）、开关闸门（先判后切、组共享、符号+颜色）、连续离场动画（一次性提交/输入锁/兜底）、提示保持可解、存档校验回退、18 关梯度（12 基线 + 6 追加机关关）。

## 3. 开发工具、DeepSeek API 和环境
- 素材：README 环境节、docs/api-usage.md、docs/decisions.md、.env.example、scripts/deepseek-review.mjs。
- 事实：开发工具为 Qoder（不得写成 TRAE）；Node v24.20.0 / npm 11.19.0 / win32-x64；Vite 8.3.8、TypeScript 7.0.2、Vitest 5.1.0、Playwright 1.65.1、tsx 4.23.15（锁文件实测版本）。
- DeepSeek：脚本与配置完备、模型 ID 已核对官方文档；真实调用 not_called，待用户配置密钥（外部待办）。

## 4. 方案设计与开发过程
- 素材：docs/decisions.md（D1–D11）、docs/development-log.md（阶段 1–6）、docs/changes.md（阶段提交链见 evidence-index）。
- 要点：规则纯函数与 UI 分离、网格坐标为唯一状态源；viewBox 网格单位 SVG 天然适配缩放；记忆化 DFS 求解器同时服务提示与死局检测；快照式撤销；动画完成守卫 + 兜底定时器防锁死。

## 5. AI 未达标问题及处理
- 素材：docs/issues.md（I1–I14，含表现/原因/修复/复测）。
- 可写实例：关卡数据越界（校验器拦截，I1/I12）、测试夹具坐标错误、hero 动画错位、移动端按钮换行、通关层阻断撤销、模型别名过时、隐藏标签页 rAF 节流的兜底验证、7×7 重设环形依赖（I10）、追加关同列互挡环（I13）、末关 hidden 按钮被样式覆盖（I14，新测试暴露既有缺陷）。
- 注意：只写记录中真实发生的问题；个人判断与体会由本人补充。

## 6. 最终产品、截图和验收
- 素材：evidence/screenshots/01–09（真实渲染截图）、evidence/test-results/（99 单元 / 75 浏览器 / 19 条重放 / 构建）、docs/acceptance.md。
- 说明：移动截图为 Playwright 仿真，真机验证待补；AC18/AC20 为外部待办。

## 7. 个人总结
- 待本人填写（学号、姓名、学习体会不编造、不代写）。

## 8. Gitee 链接和最终版本
- 待外部办理：仓库地址、推送授权、最终 commit/tag。
- 本地已就绪：git 历史 6 阶段提交链（见 evidence-index）、锁文件、.gitignore（.env/node_modules/dist/证据 raw 不入库）。
- 提交准备清单见 README「Gitee 提交准备清单」。