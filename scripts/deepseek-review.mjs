/**
 * 仅开发期使用的 DeepSeek 审查脚本（不参与网页构建）。
 *
 * 用法：
 *   1. 复制 .env.example 为 .env，填入 DEEPSEEK_API_KEY（切勿提交 .env）。
 *   2. node scripts/deepseek-review.mjs
 *
 * 安全与边界：
 *   - 密钥只从环境变量 / .env 读取，绝不写入前端、localStorage、日志或 Git。
 *   - 只发送下方 FILES 明确列出的文件 + 指定提示词，不扫描整个目录。
 *   - 每次运行只发起一次调用，不循环、不自动重试。
 *   - 未配置密钥时：写出 status=not_called 的记录并正常退出，不影响游戏开发。
 *   - 记录脱敏：保存 messages（仅代码与提示词）、响应文本、模型、参数、HTTP 状态、usage、时间；
 *     不保存 Authorization 头、密钥或任何环境变量 dump。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const FILES = ['src/core/rules.ts', 'src/core/solver.ts', 'src/core/session.ts'];
const PROMPT_FILE = 'docs/prompts/deepseek-review-request.md';
const OUT_DIR = join(ROOT, 'evidence', 'api');

function loadDotEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    const val = rawVal.replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
const BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');

const prompt = readFileSync(join(ROOT, PROMPT_FILE), 'utf8');
const fileBlocks = FILES.map((f) => `### 文件：${f}\n\`\`\`ts\n${readFileSync(join(ROOT, f), 'utf8')}\n\`\`\``).join('\n\n');
const messages = [
  { role: 'system', content: '你是资深 TypeScript 代码审查员，专注游戏规则的边界用例与状态一致性。回答用中文，简洁、可执行。' },
  { role: 'user', content: `${prompt}\n\n以下是被审查的真实代码：\n\n${fileBlocks}` },
];
const params = { model: MODEL, messages, temperature: 0.2, max_tokens: 2000, stream: false };

mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const recordPath = join(OUT_DIR, `review-${stamp}.json`);

const baseRecord = {
  task: 'EnArrower 规则引擎与求解器边界审查',
  startedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  endpoint: '/chat/completions',
  model: MODEL,
  params: { temperature: params.temperature, max_tokens: params.max_tokens, stream: false },
  selectedFiles: FILES,
  promptFile: PROMPT_FILE,
  requestMessages: messages,
};

if (!API_KEY) {
  const record = { ...baseRecord, status: 'not_called', reason: '未配置 DEEPSEEK_API_KEY，本次未发起 API 调用。', response: null, usage: null };
  writeFileSync(recordPath, JSON.stringify(record, null, 2));
  console.log('[deepseek-review] 未配置 DEEPSEEK_API_KEY，未调用 API。');
  console.log('[deepseek-review] 已写出占位记录：' + recordPath);
  console.log('[deepseek-review] 配置密钥后重新运行即可产生真实调用记录。游戏开发不受影响。');
  process.exit(0);
}

let httpStatus = null;
let responseText = null;
let usage = null;
let returnedModel = null;
let error = null;
try {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(params),
  });
  httpStatus = res.status;
  const body = await res.json();
  if (!res.ok) {
    error = body?.error?.message || `HTTP ${res.status}`;
  } else {
    responseText = body?.choices?.[0]?.message?.content ?? null;
    returnedModel = body?.model ?? null;
    usage = body?.usage ?? null;
  }
} catch (e) {
  error = String(e);
}

const record = {
  ...baseRecord,
  finishedAt: new Date().toISOString(),
  status: error ? 'failed' : 'success',
  httpStatus,
  returnedModel,
  response: responseText,
  usage,
  error,
};
writeFileSync(recordPath, JSON.stringify(record, null, 2));
console.log(`[deepseek-review] status=${record.status} http=${httpStatus} model=${returnedModel || MODEL}`);
console.log('[deepseek-review] 记录（脱敏）：' + recordPath);
if (error) console.log('[deepseek-review] 错误：' + error);
else console.log('[deepseek-review] 响应摘要：' + String(responseText).slice(0, 300) + '…');