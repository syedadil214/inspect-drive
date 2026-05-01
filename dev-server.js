const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8888);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp'
};

function loadLocalEnv() {
  const candidates = ['.env.local', '.env'];
  for (const filename of candidates) {
    const filePath = path.join(ROOT, filename);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (key && process.env[key] == null) {
        process.env[key] = value;
      }
    }
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function safePathname(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  return normalized;
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handleFunction(req, res, functionName) {
  const filePath = path.join(ROOT, 'netlify', 'functions', `${functionName}.js`);
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { success: false, error: 'Function not found.' });
    return;
  }

  try {
    delete require.cache[require.resolve(filePath)];
    const mod = require(filePath);
    const handler = mod.handler || (mod.default && mod.default.handler);

    if (typeof handler !== 'function') {
      sendJson(res, 500, { success: false, error: 'Function handler is invalid.' });
      return;
    }

    const body = await readRequestBody(req);
    const event = {
      httpMethod: req.method,
      headers: req.headers,
      path: req.url,
      body,
      isBase64Encoded: false,
      queryStringParameters: Object.fromEntries(new URL(req.url, `http://${req.headers.host}`).searchParams.entries())
    };

    const result = await handler(event, {});
    const statusCode = result?.statusCode || 200;
    const headers = result?.headers || {};
    res.writeHead(statusCode, headers);
    res.end(result?.body || '');
  } catch (error) {
    console.error(`Dev server function error (${functionName}):`, error);
    sendJson(res, 500, { success: false, error: error.message || 'Function execution failed.' });
  }
}

function serveStatic(req, res, pathname) {
  let relativePath = pathname === '/' ? 'index.html' : safePathname(pathname).replace(/^[/\\]+/, '');
  let filePath = path.join(ROOT, relativePath);

  if (!filePath.startsWith(ROOT)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    sendText(res, 404, '404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

loadLocalEnv();

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/.netlify/functions/square-config') {
    await handleFunction(req, res, 'square-config');
    return;
  }

  if (pathname === '/.netlify/functions/process-payment') {
    await handleFunction(req, res, 'process-payment');
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Local dev server ready: http://localhost:${PORT}`);
});
