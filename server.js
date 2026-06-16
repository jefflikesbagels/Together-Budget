/**
 * Together Budget — shared household server
 * Serves the app and stores one budget in data/budget.json
 *
 * Usage: node server.js
 * Optional: set PORT (default 3000) and BUDGET_SECRET to require a shared key
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const SECRET = process.env.BUDGET_SECRET || '';
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'budget.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isAuthorized(req) {
  if (!SECRET) return true;
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${SECRET}`) return true;
  const url = new URL(req.url, `http://${req.headers.host}`);
  return url.searchParams.get('key') === SECRET;
}

function readStore() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      budget: parsed.budget ?? null,
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch {
    return { budget: null, updatedAt: 0 };
  }
}

function writeStore(budget, updatedAt) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const payload = { budget, updatedAt };
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function send(res, status, body, type = 'application/json') {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(ROOT, filePath);

  if (!full.startsWith(ROOT)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(full, (err, data) => {
    if (err) {
      send(res, 404, 'Not found', 'text/plain');
      return;
    }
    const ext = path.extname(full);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(data);
  });
}

async function handleApi(req, res, pathname) {
  if (!isAuthorized(req)) {
    send(res, 401, { error: 'Unauthorized — set BUDGET_SECRET or pass ?key=' });
    return;
  }

  if (pathname === '/api/budget' && req.method === 'GET') {
    send(res, 200, readStore());
    return;
  }

  if (pathname === '/api/budget' && req.method === 'PUT') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      send(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const store = readStore();
    const clientVersion = Number(body.updatedAt) || 0;

    if (store.updatedAt !== 0 && clientVersion !== 0 && clientVersion !== store.updatedAt) {
      send(res, 409, {
        error: 'Conflict — budget was updated elsewhere',
        ...store,
      });
      return;
    }

    if (!body.budget || typeof body.budget !== 'object') {
      send(res, 400, { error: 'Missing budget object' });
      return;
    }

    const updatedAt = Date.now();
    writeStore(body.budget, updatedAt);
    send(res, 200, { ok: true, updatedAt });
    return;
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    send(res, 200, { requiresAuth: Boolean(SECRET) });
    return;
  }

  send(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    await handleApi(req, res, pathname);
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`Together Budget running at http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.log(`  On your network: http://<this-computer-ip>:${PORT}`);
  }
  console.log(`  Data file: ${DATA_FILE}`);
  if (SECRET) console.log('  API auth: enabled (BUDGET_SECRET)');
  else console.log('  API auth: off — set BUDGET_SECRET before exposing to the internet');
});
