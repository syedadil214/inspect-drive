const express = require('express');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8888);

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

function createNetlifyEvent(req) {
  return {
    httpMethod: req.method,
    headers: req.headers,
    path: req.path,
    body: req.rawBody || '',
    isBase64Encoded: false,
    queryStringParameters: req.query || {}
  };
}

function sendFunctionResult(res, result) {
  const statusCode = result?.statusCode || 200;
  const headers = result?.headers || {};

  res.status(statusCode);
  for (const [key, value] of Object.entries(headers)) {
    res.set(key, value);
  }

  res.send(result?.body || '');
}

function wrapNetlifyFunction(handler) {
  return async (req, res) => {
    try {
      const result = await handler(createNetlifyEvent(req), {});
      sendFunctionResult(res, result);
    } catch (error) {
      console.error('Express function error:', error);
      res
        .status(500)
        .set('Cache-Control', 'no-store')
        .json({ success: false, error: 'Function execution failed.' });
    }
  };
}

loadLocalEnv();

const { handler: squareConfigHandler } = require('./netlify/functions/square-config');
const { handler: processPaymentHandler } = require('./netlify/functions/process-payment');

const app = express();

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    res
      .status(400)
      .set('Cache-Control', 'no-store')
      .json({ success: false, error: 'Invalid payment request payload.' });
    return;
  }

  next(error);
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/square-config', wrapNetlifyFunction(squareConfigHandler));
app.post('/api/process-payment', wrapNetlifyFunction(processPaymentHandler));

app.get('/.netlify/functions/square-config', wrapNetlifyFunction(squareConfigHandler));
app.post('/.netlify/functions/process-payment', wrapNetlifyFunction(processPaymentHandler));

app.use(express.static(ROOT, {
  extensions: ['html'],
  index: 'index.html'
}));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Express server ready: http://localhost:${PORT}`);
});
