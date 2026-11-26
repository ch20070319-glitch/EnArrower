# 证据索引（evidence-index）

所有证据均为实际执行产物。截图为 Playwright 真实渲染截取并逐张目检；移动视口为仿真，非真机。

## 测试结果（evidence/test-results/，第六轮阶段 M 刷新；第四轮 desktop.txt、第五轮 sites.txt 沿用）
| 文件 | 内容 | 结果 |
|---|---|---|
| unit.txt | `npm test`（Vitest，tests/unit 4 文件） | 176 passed（第六轮：+教学/点灯最佳/重排兼容用例） |
| levels.txt | `npm run validate:levels`（27 关 + 样例，校验+求解+逐步重放+逐关覆盖率与耗时） | 28/28 通过；无机关无灯关覆盖 49/49 |
| browser.txt | `npm run test:browser`（Playwright，60 用例 × desktop/mobile-390/mobile-360） | 180 passed（第六轮；AC55 首跑期望值写错修正后全过） |
| build.txt | `npm run build` + 第六轮 `npm run dist:win` 日志（含产物字节数与 sha256 记录行） | 成功，无类型错误；portable 退出码 0 |
| exe-smoke-1.1.0.txt | 第六轮 1.1.0 portable exe 冒烟（CDP：首页/教学/跳过/接力受阻与成功/单撤销/灯可选进度/零外联/正常退出重启恢复） | 全过；exe 110,487,368 字节 sha256 763218e5…751；截图 22–27 目检 |
| desktop.txt | 第四轮 `npm run dist:win` + portable exe 冒烟（CDP 抓窗：启动/app:// 加载/发射存档/重启恢复/零外联） | exe 110,485,570 字节 sha256 8325e4e6…338e；冒烟各项实测通过；他机/SmartScreen 未验证 |
| sites.txt | 第五轮 Qoder Sites 部署链返回 + 公网浏览器实测（加载/进入/发射/存档/无跨域资源） | published=true、public；公网 URL 实测通过；论坛发布未执行 |

## 截图（evidence/screenshots/；第六轮 01–18 全重截并目检 04/17，22–27 为第六轮 exe 新增）
| 文件 | 内容 |
|---|---|
| 01-home-desktop.png | 首页（桌面 1280，文案 27 关） |
| 02-home-mobile-360.png | 首页（360 移动仿真） |
| 03-game-l01-desktop.png | 第 1 关棋盘（桌面，铺满 49/49、11 箭） |
| 04-levels-desktop.png | 选关页三章节（基础疏通5/闸门进阶15/特殊箭头7，显示序编号，26 带「小屋全亮」标记，1280×1080） |
| 05-game-l12-desktop.png | 第 12 关双组机关棋盘（加密后 12 箭） |
| 06-inspect-preview.png | 查看机关模式预览（闸门高亮 + 将开启/将关闭） |
| 07-win-desktop.png | 通关反馈覆盖层（l01 铺满后 11 步清空） |
| 08-game-l11-mobile-360.png | 第 11 关（360 移动仿真，控件 2×2） |
| 09-game-l18-desktop.png | 第 18 关终局回环（双组三门，加密后 12 箭，桌面） |
| 10-game-l19-poly-desktop.png | 第 19 关折线教学（铺满 49/49、12 箭含多弯折线，桌面） |
| 11-game-l20-mobile-360.png | 第 20 关 8×12 大棋盘（360 仿真满宽、格 44.25px，整页） |
| 12-game-l21-turn-selected.png | 第 21 关 ⇄ 选中态（珊瑚色 + 预览射线 + 发射/取消选中条） |
| 13-game-l23-relay-link.png | 第 23 关接力虚线连接 A/B |
| 14-relay-mid-animation.png | 接力中途帧：A 已离场、B 仍在场（顺序动画证据） |
| 15-game-l25-escort.png | 第 25 关护送 ★ 金色徽章 |
| 16-game-l26-lamp-lit.png | 第 26 关徽记调头向左经过灯后小屋点亮 |
| 17-win-l27-all-lamps.png | 第 27 关全亮通关弹窗「可选挑战达成：小屋全部点亮！」（末关无下一关） |
| 18-game-l21-badge-turn.png | 第 21 关 ⇄ 尾格徽记直接点击调头后向左（不选中、底部无调头按钮） |
| 19-desktop-exe.png | 第四轮：portable exe 窗口内第 1 关中途（a/b 已离场、9 支），CDP 抓窗目检 |
| 20-desktop-exe-resume.png | 第四轮：exe 重启后继续存档恢复第 1 关 9 支中途局面 |
| 21-sites-public.png | 第五轮：Playwright 直连 Qoder Sites 公网 URL，第 1 关满铺 11 支（含 Made with Qoder 角标），目检 |
| 22-exe-110-home.png | 第六轮：1.1.0 exe 全新玩家首页「开始游戏」，目检 |
| 23-exe-110-tutorial.png | 第六轮：exe 新手教学 5×3（目标/玩法说明/跳过教学按钮），目检 |
| 24-exe-110-relay-blocked.png | 第六轮：exe l23 接力受阻——虚线高亮+挡路闸门红框+短文字，目检 |
| 25-exe-110-relay-done.png | 第六轮：exe l23 接力完成 A/B/C 离场、门开、history=2，目检 |
| 26-exe-110-lamp.png | 第六轮：exe l26 调头向左点灯「可选 · 点亮小屋 1/1」，目检 |
| 27-exe-110-resume.png | 第六轮：exe 正常退出重启后恢复 l26 中途（撤销后 0/1、r 已调头），目检 |

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
| dfe961b | 回填阶段 5 提交哈希 |
| 8745f7e | 阶段 6：l13–l18 六个机关关 + AC21–AC23 + I12–I14 修复 + 证据/文档同步 |
| 3f1891c | 第二轮阶段 A：大棋盘 l20 + 折线 l19（绳随路线共享碰撞/预览/动画）+ AC24–AC27 |
| c06cb85 | 第二轮阶段 B：可调头 ⇄（选中/调头/发射分离）l21–l22 + AC28–AC32 |
| f8a3220 | 第二轮阶段 C：接力 A/B（预演整体成败、顺序动画、单撤销）l23–l24 + AC33–AC35 |
| 8bd09e4 | 第二轮阶段 D：护送 ★ 与点灯 l25–l27（灯随撤销/存档）+ AC36–AC39 |
| ed7fc27 | 第二轮阶段 E：提示点名文案、求解规模阈值与实测耗时 + AC40 |
| 721f9e9 | 第二轮阶段 F：证据刷新（test-results 四件 + 截图 10–17） |
| d22c3a6 | 第三轮阶段 H–J：徽记调头 + 27 关铺满/加密 + 上限放宽 + 复测证据与文档 |
| 562bfff | 第四轮阶段 K：Electron portable exe + app:// 主进程 + 冒烟证据与文档 |

## 待补（用户留存，不伪造）
- 用户聊天完整截图/导出。
- 真机（手机浏览器）操作验证记录。
- DeepSeek 真实调用后的采用/拒绝评估记录。
- Gitee 仓库地址、最终 commit/tag（GitHub 已推送，见下；Gitee 仍待办）。
- 学号、姓名、个人总结。

## 仓库推送（第四轮，2026-11-25 实际执行）
- GitHub：https://github.com/ch20070319-glitch/EnArrower ；`git push -u origin main` 成功；
  推送前 README 全文经用户过目并确认「按现状提交推送」；首次推送 head=515b1e002da8d2f3dceabe978ee778889a2df97c，
  与本地 HEAD 一致（git ls-remote 复核）；本记录提交随后同步推送，远端始终与本地 main 一致。
- 入库内容：源码/27 关/锁文件/docs/evidence（含截图 19/20 与 desktop.txt）；不含 exe（release/ 忽略）、不含 .env 与密钥（跟踪文件仅 .env.example 空模板）。
- GitHub Releases（同日，用户指令）：tag `v1.0.0`；release id 458044673（draft=false、prerelease=false）；
  附件 `EnArrower-1.0.0-portable.exe`（asset id 791353340，state=uploaded，110,485,570 字节），
  下载地址 https://github.com/ch20070319-glitch/EnArrower/releases/download/v1.0.0/EnArrower-1.0.0-portable.exe ；
  本机 HEAD 请求 HTTP 200，完整下载回读 sha256=8325e4e61202fa8a46ac70b0df99e43514eb18587dc147290a09d3e8e17c338e，与本地 exe 逐字节哈希一致。
  exe 仍以 Release 附件分发，不进 Git 树。

## Qoder Sites 公网部署（第五轮，2026-11-25 实际执行）
- 公网地址：https://enarrower-tt60ydf4j2q.qoder.zone （访问范围 public，用户「公网部署」指令授权）。
- actionId=cda2e78d-ca62-4e6c-91e3-db4d59446016；projectId=01a21294-8f87-79be-9c51-ffbd9e58845f；siteId=01a21294-8f8b-7723-8b24-0ac9740975e9；
  publishOperationId=01a21294-d4b5-72a0-9638-7b6bb89900b5（succeeded/committed）；published=true、readiness=publication_completed。
- 上传内容：dist/（index.html + assets/index-Dcgy5xMs.js + assets/index-DxgN4poB.css + favicon.svg），与第四轮 build 产物一致；无 Function/数据库/Secret。
- 描述符：.EnArrower · 箭头解谜.qoder.site（首次 pending 未落盘，同 action 同输入重试 prepare 恢复 written；未重复发布）。
- 公网实测见 sites.txt 与截图 21；内嵌浏览器截屏视口不可见改 Playwright 补截屏，已如实记录。
## 第六轮（2026-11-26，阶段 M：体验更新 + 1.1.0）
- 复测：176 单元 / 28 重放 / 180 浏览器（60 用例 ×3 视口）/ build 全通过；01–18 截图全重截（capture-evidence.mjs 选择器随章节嵌套与教学入口更新）。
- 1.1.0 打包：`npm run dist:win` 退出码 0；release/EnArrower-1.1.0-portable.exe 110,487,368 字节，
  sha256 763218e53778cfc2d88fae2350f0991f2d172726ee1dfa575b971a493fc43751（build.txt 记录行）。
- exe 冒烟：exe-smoke-1.1.0.txt 全过（首页/教学/跳过/接力受阻与成功/单撤销/灯可选/零外联/正常退出重启恢复）；截图 22–27 目检。
  重启恢复按正常退出路径实测；强杀提交窗口限制见 docs/issues.md I27，不写「断电恢复通过」。
- 提交与推送：见下「仓库推送（第六轮）」（提交后回填哈希）。

## 仓库推送（第六轮，2026-11-26 实际执行）
- GitHub：https://github.com/ch20070319-glitch/EnArrower ；main 无分支保护（REST 404 Branch not protected），直推无需 PR。
- `git push origin main`：46bf437..8053dd1；`git ls-remote origin main` = 8053dd14d1e070527ce12da8f4aa7ba56f41ddf3，与本地 HEAD 一致。
- 提交 8053dd1 仅含第六轮源码/关卡/测试/脚本/文档/证据（50 文件）；不含 docs/tianchi-forum-draft.md（无关草稿）、release/、node_modules、.env 与密钥（diff 扫描仅文档提及键名）。
- tag `v1.1.0`（annotated c2be297）peel 后指向 8053dd14d1e070527ce12da8f4aa7ba56f41ddf3（实测通过的提交），已推送。
- GitHub Releases：release id 459405314（draft=false、prerelease=false），https://github.com/ch20070319-glitch/EnArrower/releases/tag/v1.1.0 ；
  附件 `EnArrower-1.1.0-portable.exe`（asset id 795869926，state=uploaded，110,487,368 字节），
  下载地址 https://github.com/ch20070319-glitch/EnArrower/releases/download/v1.1.0/EnArrower-1.1.0-portable.exe ；
  公网完整下载 HTTP 200、110,487,368 字节，回读 sha256=763218e53778cfc2d88fae2350f0991f2d172726ee1dfa575b971a493fc43751，与本地 exe 一致。
- Release 正文含更新内容、实测摘要、存档位置、未签名 SmartScreen 提示与强杀提交窗口限制、sha256 与提交号。
