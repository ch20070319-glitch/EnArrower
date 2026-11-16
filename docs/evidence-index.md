# 证据索引（evidence-index）

所有证据均为实际执行产物。截图为 Playwright 真实渲染截取并逐张目检；移动视口为仿真，非真机。

## 测试结果（evidence/test-results/）
| 文件 | 内容 | 结果 |
|---|---|---|
| unit.txt | `npm test`（Vitest，tests/unit 4 文件） | 81 passed |
| levels.txt | `npm run validate:levels`（12 关 + 样例，校验+求解+逐步重放） | 13/13 通过 |
| browser.txt | `npm run test:browser`（Playwright，22 用例 × desktop/mobile-390/mobile-360） | 66 passed |
| build.txt | `npm run build`（tsc --noEmit && vite build） | 成功，无类型错误 |

## 截图（evidence/screenshots/，阶段 5 重截并目检）
| 文件 | 内容 |
|---|---|
| 01-home-desktop.png | 首页（桌面 1280） |
| 02-home-mobile-360.png | 首页（360 移动仿真） |
| 03-game-l01-desktop.png | 第 1 关棋盘（桌面） |
| 04-levels-desktop.png | 选关页（完成/解锁/锁定三态） |
| 05-game-l12-desktop.png | 第 12 关双组机关棋盘 |
| 06-inspect-preview.png | 查看机关模式预览（闸门高亮 + 将开启/将关闭） |
| 07-win-desktop.png | 通关反馈覆盖层 |
| 08-game-l11-mobile-360.png | 第 11 关（360 移动仿真，控件 2×2） |

## API 记录（evidence/api/）
- review-2026-11-16T08-42-29-353Z.json：`npm run review:deepseek` 实跑记录，status=not_called（环境无 DEEPSEEK_API_KEY）。**真实 API 调用尚未发生**；配置密钥后重跑将生成脱敏请求/响应/usage 记录。raw/ 目录已 gitignore。

## 指令与提示词（docs/prompts/）
- 00-initial-requirements.md：用户完整指令原文（会话记录导出留存）。
- deepseek-review-request.md：发送给 DeepSeek 的审查请求文本（仅含明确选择的 3 个规则文件）。

## 阶段提交（git）
| 提交 | 阶段 |
|---|---|
| 2e3811f | 骨架与配置 |
| 9a06a0d | 规则/关卡/存档 + 81 单元测试 |
| 97cad4a | UI/动画 + 60 浏览器测试 + 截图 |
| 02372b6 | 66 浏览器测试、DeepSeek 脚本、全部文档与 README |
| 7ea580a | 回填阶段 4 哈希 |
| 53a36db | .gitignore 锚定修复 + 最终复测证据入库（I9） |
| d4eaf4d | 证据索引补全提交链 |
| 0acfdb5 | 7×7 关卡重设、箭头细化、机关精修、640px、复测证据与文档 |

## 待补（用户留存，不伪造）
- 用户聊天完整截图/导出。
- 真机（手机浏览器）操作验证记录。
- DeepSeek 真实调用后的采用/拒绝评估记录。
- Gitee 仓库地址、最终 commit/tag。
- 学号、姓名、个人总结。