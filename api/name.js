import { resolveModel } from './_models.js';
import { saveHistory } from './_supabase.js';

/**
 * POST /api/name
 * body: { requirement: string, model?: 'doubao'|'deepseek'|'qwen'|'kimi', style?: string }
 *
 * 一套共用调用代码：从 modelConfigMap 里取 baseURL / apiKey / model，
 * 用 OpenAI 兼容的 /chat/completions（stream:true）请求，边生成边把文字推给浏览器。
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: '只支持 POST' });
    return;
  }

  // ---- 1. 读参数、做校验 ----
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch { body = {}; }
  }
  body = body || {};
  const requirement = String(body.requirement || '').trim();
  const style = String(body.style || '国风').trim();
  const modelKey = String(body.model || 'doubao').trim();

  if (!requirement) {
    res.status(400).json({ error: '请填写起名需求，例如：男孩、国风、简约' });
    return;
  }
  if (requirement.length > 200) {
    res.status(400).json({ error: '起名需求请不要超过 200 字' });
    return;
  }

  let conf;
  try {
    conf = resolveModel(modelKey);
  } catch (err) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (!conf.apiKey) {
    res.status(400).json({ error: `模型「${conf.label}」还没有配置密钥，请先在环境变量里填 ${conf.apiKeyEnv}` });
    return;
  }

  // ---- 2. 准备流式响应头 ----
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = (obj) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  const messages = [
    {
      role: 'system',
      content:
        '你是一位资深中文起名顾问，精通诗词典故、字义与音律。' +
        '只输出名字方案，不要寒暄、不要自我介绍、不要解释你正在做什么。',
    },
    {
      role: 'user',
      content:
        `起名需求：${requirement}\n` +
        `名字风格：${style}\n\n` +
        '请给出 3 组名字，每组严格按下面格式输出（不要编号以外的多余内容）：\n' +
        '【名字】字的读音（声调）\n' +
        '寓意：结合字义、典故说明好在哪里，2-3 句\n' +
        '适合：性别/气质/使用场景一句话\n\n' +
        '三组之间空一行。如果风格是「英文名」，请给出英文名并配中文释义。',
    },
  ];

  // ---- 3. 发起上游请求（OpenAI 兼容协议，curl 里看到的那套东西）----
  const controller = new AbortController();
  let aborted = false;
  req.on('close', () => {
    if (!res.writableEnded) {
      aborted = true;
      controller.abort();
    }
  });

  // 请求体对所有模型都一样：这就是 OpenAI 兼容协议的好处
  const payload = JSON.stringify({
    model: conf.model,
    messages,
    stream: true,
    temperature: 0.9,
    max_tokens: 900,
    ...(conf.extra || {}),
  });
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${conf.apiKey}`,
  };
  const post = (base) =>
    fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: payload,
      signal: controller.signal,
    });

  let upstream;
  try {
    upstream = await post(conf.baseURL);
    // 火山方舟新旧版本路径兼容：官方现为 /api/v3，早期文档写 /api/v1
    const v = conf.baseURL.match(/\/api\/v(\d)/);
    if (upstream.status === 404 && v) {
      const alt = conf.baseURL.replace(/\/api\/v\d/, `/api/v${v[1] === '3' ? '1' : '3'}`);
      upstream = await post(alt);
    }
  } catch (err) {
    send({ type: 'error', message: `连接模型接口失败：${err.message}` });
    res.end();
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    let hint = text;
    try { hint = JSON.parse(text)?.error?.message || text; } catch { /* 原样返回 */ }
    send({ type: 'error', message: `${conf.label} 返回错误（${upstream.status}）：${String(hint).slice(0, 300)}` });
    res.end();
    return;
  }

  // ---- 4. 逐块解析 SSE，边读边推给前端 ----
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  send({ type: 'meta', model: conf.id, label: conf.label, modelId: conf.model });

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 以空行分隔一条消息，注意最后一段可能不完整，留在 buffer 里
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        for (const line of part.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              fullText += delta;
              send({ type: 'delta', text: delta });
            }
          } catch {
            // 忽略无法解析的片段（比如心跳注释）
          }
        }
      }
    }
  } catch (err) {
    if (!aborted) send({ type: 'error', message: `读取流式响应失败：${err.message}` });
  }

  // ---- 5. 收尾：把结果存进 Supabase ----
  if (aborted) {
    if (!res.writableEnded) res.end();
    return;
  }

  const saved = await saveHistory({
    requirement: `${requirement}（风格：${style}）`,
    result: fullText.trim(),
    modelName: conf.id,
  });

  send({ type: 'done', saved: saved.saved, recordId: saved.id || null, reason: saved.reason || null });
  res.end();
}
