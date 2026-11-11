# 锦名 · AI 起名平台

一个可直接部署到 Vercel 的 Node 网页应用：用户输入起名需求，AI 流式输出 3 组名字与寓意，结果自动保存到 Supabase，支持豆包 / DeepSeek / 通义千问 / Kimi 四个模型切换。

## 目录结构

```
.
├── index.html            # 前端页面（原生 HTML/CSS/JS，无构建步骤）
├── api
│   ├── _models.js        # modelConfigMap 模型配置表（核心）
│   ├── _supabase.js      # Supabase 客户端 + 历史读写
│   ├── name.js           # POST /api/name    流式起名 + 写库
│   ├── history.js        # GET  /api/history 读历史
│   └── models.js         # GET  /api/models  可选模型列表
├── supabase/schema.sql   # 建表 SQL（含 RLS 策略）
├── server.js             # 本地预览服务器（等价于 vercel dev）
├── package.json
├── .env.example
└── vercel.json
```

## 本地运行

```bash
npm install
cp .env.example .env   # 填入 SUPABASE_URL / SUPABASE_ANON_KEY / 模型密钥
npm run dev            # 打开 http://localhost:3000
# 或
npx vercel dev
```

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `SUPABASE_URL` | Supabase 项目地址 |
| `SUPABASE_ANON_KEY` | Supabase 匿名密钥 |
| `DOUBAO_API_KEY` | 火山方舟密钥 |
| `DOUBAO_MODEL` | 豆包模型名或推理接入点 `ep-xxxx` |
| `DEEPSEEK_API_KEY` / `QWEN_API_KEY` / `KIMI_API_KEY` | 其余三家模型密钥（按需） |

密钥只放在服务器端环境变量里，前端拿不到，也不会进 Git 仓库（`.env` 已写入 `.gitignore`）。

## 接入新模型

只在 `api/_models.js` 的 `modelConfigMap` 里加一项配置即可，`api/name.js` 的请求逻辑不用改：

```js
newmodel: {
  id: 'newmodel',
  label: '某平台',
  baseURL: 'https://xxx/v1',      // 必须是 OpenAI 兼容地址
  apiKeyEnv: 'NEWMODEL_API_KEY',
  model: process.env.NEWMODEL_MODEL || 'xxx',
  apiKey: process.env.NEWMODEL_API_KEY || '',
}
```

## 建表

Supabase 控制台 → SQL Editor → 执行 `supabase/schema.sql`。

## 部署

1. 推送到 GitHub `main` 分支（`.env` 不提交）。
2. Vercel → Add New Project → 导入该仓库（框架选 Other，无需构建命令）。
3. Project Settings → Environment Variables 填入上表全部变量。
4. Redeploy，拿到公网域名即可访问。
