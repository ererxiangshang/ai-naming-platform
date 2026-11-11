/**
 * 本地开发服务器（等价于 `vercel dev` 的最小实现）。
 * 作用：在没装 Vercel CLI 时也能 `npm run dev` 在本机预览，路由规则与 Vercel 保持一致。
 * 线上部署到 Vercel 后由平台自动处理，不需要这个文件。
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const routes = {
  '/api/name': (await import('./api/name.js')).default,
  '/api/history': (await import('./api/history.js')).default,
  '/api/models': (await import('./api/models.js')).default,
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function decorateResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) return {};
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  decorateResponse(res);

  const handler = routes[url.pathname];
  if (handler) {
    try {
      req.body = await readBody(req);
      await handler(req, res);
    } catch (err) {
      console.error(err);
      if (!res.writableEnded) res.status(500).json({ error: err.message });
    }
    return;
  }

  // 静态文件
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.normalize(filePath).replace(/^([/\\])+/, '');
  if (filePath.startsWith('..') || filePath.startsWith('.env') || filePath.startsWith('api/')) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  try {
    const content = await readFile(path.join(__dirname, filePath));
    res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
    res.end(content);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`本地预览：http://localhost:${PORT}`);
});
