# EnArrower

轻松解压、带适度顺序推理的箭头解谜网页游戏。点击箭头让它沿朝向滑出棋盘；部分箭头是开关，离场后会切换关联闸门，因此需要安排顺序。清空全部箭头即通关。无倒计时、无生命值、无扣分，无限撤销 / 重开 / 提示。

单机网页：鼠标、触摸、键盘均可操作；进度存于 localStorage；游戏运行不依赖任何 AI API。界面、关卡均为原创。

## 实际功能
- 5–7 × 3–7 网格棋盘，每关 3–12 支箭头（长 1–3 格，四向），点击头部或箭身均可选中。
- 整支箭头沿朝向连续滑出（250–450ms，尾部完全出界后移除）；被阻挡时原位抖动并高亮实际阻挡物，不记历史、不切机关。
- 开关箭头（◇ 琥珀 / ○ 紫，符号+颜色双重区分）：先按移动前门状态判定路径，成功离场后整组切换一次；每关 ≤2 组、≤4 闸门格。
- 机关预览：桌面悬停 / 键盘聚焦高亮关联闸门并标注“将开启/将关闭”；移动端“查看机关”模式下点击只预览不移动。
- 无限撤销（含闸门状态完整恢复，通关后可撤销但不收回解锁）、重开（保留完成/解锁记录）、提示（记忆化求解器搜索完整解法，只高亮“走后可通关”的箭头；死局时建议撤销/重开）。
- 12 个原创固定关卡（1–3 基础 → 4–6 开门 → 7–9 关门顺序 → 10–12 双组组合），全部经规则引擎逐步重放验证可解。
- 入口 / 游戏 / 通关 / 选关四界面；选关区分已完成、已解锁、未解锁；通关反馈在最后一支动画结束后出现。
- 存档：schemaVersion 校验，损坏/不匹配/不可用安全回退并提示；动画中刷新恢复上一稳定状态；写入失败仍可继续游戏。
- 可访问性：控件文字/aria 名称、键盘聚焦与 Enter/Space 触发、role=status 实时通知、prefers-reduced-motion 支持；快捷键 Z 撤销 / R 重开 / H 提示 / Esc 返回。
- 适配 360px / 390px / 桌面，触摸目标 ≥44px，无横向溢出。

## 环境（实测）
- Node v24.20.0，npm 11.19.0，Windows 10 x64（其他平台理论可用，未实测）。
- 锁文件实测版本：Vite 8.3.8、TypeScript 7.0.2、Vitest 5.1.0、@playwright/test 1.65.1、tsx 4.23.15。
- 浏览器测试需 Chromium：`npx playwright install chromium`。

## 安装与启动
```bash
npm install            # 如提示 esbuild 脚本审批：npm install-scripts approve esbuild
npm run dev            # 开发服务器 http://localhost:5173
```

## 构建与预览
```bash
npm run build          # tsc --noEmit && vite build → dist/
npm run preview        # http://localhost:4173
```

## 测试（均已实际执行）
```bash
npm test               # Vitest 单元测试：81 passed（规则/求解器/会话/存档/关卡）
npm run validate:levels# 12 关 + 样例：校验 + 求解 + 逐步重放，13/13 通过
npm run test:browser   # Playwright：22 用例 × 3 视口 = 66 passed（需先 install chromium）
```
原始输出存于 `evidence/test-results/`；真实截图存于 `evidence/screenshots/`。浏览器测试为真实操作（含动画中间位移的逐帧采样），移动视口为仿真而非真机。

## 玩法
1. 首页“开始游戏”或“继续上次”；选关页按解锁进度进入。
2. 观察箭头朝向与闸门：点击箭头使其滑出；被挡会提示阻挡物。
3. 开关箭头离场会切换同符号闸门——先想好顺序，必要时用“查看机关”预览。
4. 卡住就撤销（Z）、重开（R）或提示（H）；清空全部箭头通关并解锁下一关。

## 存档限制
- 进度仅保存在**同一浏览器、同一站点来源**的 localStorage（键 `enarrower.save`，schemaVersion=1）。
- 换浏览器、换设备、换端口/域名、清除站点数据都会丢失进度；无云同步。
- 隐私模式或存储被禁用时游戏仍可玩，但会提示进度无法保存。

## DeepSeek 审查脚本（仅开发期，可选）
```bash
cp .env.example .env   # 本机填入 DEEPSEEK_API_KEY（不要在聊天中发送密钥）
npm run review:deepseek
```
- 密钥仅经环境变量读取，无 VITE_ 前缀，不进入前端/日志/Git；只发送明确选择的 3 个规则文件；单次调用。
- 当前状态：**真实调用未完成**（无密钥，记录 status=not_called，见 `docs/api-usage.md` 与 `evidence/api/`）。

## 已知问题与限制
- 后台标签页中 rAF 被浏览器节流时，动画由兜底定时器（时长+300ms）完成提交，视觉动画可能不完整，但状态正确、不会锁死（已实测，见 docs/issues.md I8）。
- 移动端验证为 Playwright 仿真（360/390），真机验证待补。
- 音效、粒子、成就、关卡编辑器不在第一版范围。
- DeepSeek 真实调用、Gitee 推送为外部待办，不影响本地功能。

## 文档与记录
`docs/`：requirements / decisions / development-log / issues / acceptance / changes / evidence-index / api-usage / report-outline / prompts（含用户指令原文留存）。全部开发工作由 Qoder 实际完成。

## Gitee 提交准备清单
- [x] 源码 + 12 关 + 锁文件（package-lock.json 已提交）
- [x] .gitignore：node_modules/、dist/、.env*（保留 .env.example）、test-results/、playwright-report/、evidence/api/raw/
- [x] 阶段提交：2e3811f（骨架）→ 9a06a0d（引擎+81 单元测试）→ 97cad4a（UI+60 浏览器测试）→ 02372b6（文档+66 浏览器测试）
- [x] README / 测试证据 / 课程文档齐备
- [ ] 创建 Gitee 仓库并配置推送授权（用户操作）
- [ ] `git remote add origin <仓库地址>` → `git push -u origin main`（用户操作）
- [ ] 打最终 tag（如 v1.0.0）并推送，将地址与哈希回填 docs/evidence-index.md 与报告第 8 部分（用户操作）
- [ ] 确认仓库不含 .env 与任何密钥（推送前 `git ls-files | grep -i env` 复核）