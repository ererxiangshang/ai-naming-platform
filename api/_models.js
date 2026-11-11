/**
 * modelConfigMap：把各家大模型的「接口地址 + 密钥环境变量 + 模型名」集中在一张表里。
 * 所有平台都提供 OpenAI 兼容的 /v1/chat/completions 接口，
 * 所以只要换这张表里的配置，下面 name.js 的那一套请求代码就能通吃。
 *
 * 注意：密钥一律从环境变量读取，绝不写死在代码里。
 */
export const modelConfigMap = {
  doubao: {
    id: 'doubao',
    label: '豆包（火山方舟）',
    baseURL: process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    apiKeyEnv: 'DOUBAO_API_KEY',
    model: process.env.DOUBAO_MODEL || 'doubao-seed-1-6-250615',
    apiKey: process.env.DOUBAO_API_KEY || '',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
  },
  qwen: {
    id: 'qwen',
    label: '通义千问（DashScope）',
    // 注意：必须用 compatible-mode 地址，普通地址不是 OpenAI 兼容协议
    baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'QWEN_API_KEY',
    model: process.env.QWEN_MODEL || 'qwen-plus',
    apiKey: process.env.QWEN_API_KEY || '',
  },
  kimi: {
    id: 'kimi',
    label: 'Kimi（月之暗面 k3.1）',
    baseURL: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'KIMI_API_KEY',
    model: process.env.KIMI_MODEL || 'kimi-k3.1-pro',
    apiKey: process.env.KIMI_API_KEY || '',
  },
};

/** 取某个模型的配置，找不到就抛错（避免悄悄回退到别的模型） */
export function resolveModel(modelKey) {
  const key = (modelKey || 'doubao').trim();
  const conf = modelConfigMap[key];
  if (!conf) throw new Error(`不支持的模型：${key}`);
  return conf;
}

/** 给前端用的模型清单（只暴露 id/label/是否已配置密钥，不暴露密钥本身） */
export function listModels() {
  return Object.values(modelConfigMap).map((m) => ({
    id: m.id,
    label: m.label,
    model: m.model,
    ready: Boolean(m.apiKey),
  }));
}
