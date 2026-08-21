import { createServer } from 'node:http';

import { createGenerateHandler, type GatewayResponse } from './gateway.ts';

const host = process.env.GATEWAY_HOST?.trim() || '127.0.0.1';
const parsedPort = Number(process.env.GATEWAY_PORT ?? '8787');
const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65_536
  ? parsedPort
  : 8_787;
const parsedTimeout = Number(process.env.GATEWAY_TIMEOUT_MS ?? '120000');
const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0
  ? parsedTimeout
  : 120_000;
const handler = createGenerateHandler({ timeoutMs });

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.url !== '/api/generate') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found', code: 'not_found' }));
    return;
  }

  const chunks: Buffer[] = [];
  let bodyBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bodyBytes += buffer.length;
    if (bodyBytes > 8_192) {
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Request body is too large', code: 'body_too_large' }));
      return;
    }
    chunks.push(buffer);
  }

  let adapter: GatewayResponse;
  adapter = {
    status(code) {
      res.statusCode = code;
      return adapter;
    },
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    json(value) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(value));
    },
    end() {
      res.end();
    },
  };

  try {
    await handler({
      method: req.method,
      headers: req.headers,
      body: Buffer.concat(chunks).toString('utf8'),
      socket: { remoteAddress: req.socket.remoteAddress },
    }, adapter);
  } catch {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
    }
    if (!res.writableEnded) {
      res.end(JSON.stringify({ error: 'Local gateway failed', code: 'internal_error' }));
    }
  }
});

server.listen(port, host, () => {
  console.log(`Local generation gateway listening at http://${host}:${port}/api/generate`);
});
