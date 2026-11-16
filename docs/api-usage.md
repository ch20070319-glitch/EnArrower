# DeepSeek API 使用记录（api-usage）

## 当前状态：真实调用未完成（not_called）
- 2026-11-16 实跑 `npm run review:deepseek`：环境无 DEEPSEEK_API_KEY，脚本按设计记录 status=not_called 并正常退出，未发出任何网络请求。
- 记录文件：evidence/api/review-2026-11-16T08-42-29-353Z.json。
- 脚本存在 ≠ 已使用 API。本文件在真实调用后更新。

## 官方文档核对（2026-11-16，调用前完成）
- 接口：OpenAI 兼容，POST `${DEEPSEEK_BASE_URL}/chat/completions`，默认 base https://api.deepseek.com，Bearer 认证。
- 当前文档模型表：deepseek-flash（默认）、deepseek-v4-pro；旧别名 deepseek-chat / deepseek-reasoner 已不在当前模型表（.env.example 已据此更正，见 issues.md I6）。
- 事实与推测区分：模型表为当日文档抓取事实；模型能力对比未实测，属待验证。

## 安全与范围约束（已在脚本中实现）
- 密钥仅从 DEEPSEEK_API_KEY 环境变量 / 本地 .env 读取；.env 已 gitignore；无 VITE_ 前缀；不进入前端、localStorage、日志、截图。
- 仅发送明确选择的文件：src/core/rules.ts、src/core/solver.ts、src/core/session.ts + docs/prompts/deepseek-review-request.md。
- 单次调用（temperature 0.2、max_tokens 2000、stream false），无自动重试循环、无无上限调用。
- 记录脱敏：保存请求消息文本、响应、返回模型、usage、HTTP 状态、时间戳；不保存 Authorization 头与密钥。

## 用户操作步骤（不要在聊天中发送密钥）
1. 复制 .env.example 为 .env，在本机填入 DEEPSEEK_API_KEY。
2. 运行 `npm run review:deepseek`。
3. 查看 evidence/api/review-<时间戳>.json；对模型建议逐条记录采用/拒绝理由（追加到本文件）。

## 建议评估记录
- 待真实调用后填写（当前无建议可评估，不编造）。