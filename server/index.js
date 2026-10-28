import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabase, queryDatabaseAll, createPage, updatePage, archivePage } from './notion.js';
import { DBS, normalizeRow, claimToProperties, buildMeta } from './normalize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 5_000_000) {
        reject(new Error('body troppo grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON non valido'));
      }
    });
    req.on('error', reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleApi(req, res, pathname, url) {
  try {
    // GET /api/meta
    if (pathname === '/api/meta' && req.method === 'GET') {
      const schemas = {};
      await Promise.all(
        Object.entries(DBS).map(async ([key, cfg]) => {
          try {
            schemas[key] = await getDatabase(cfg.id);
          } catch {
            schemas[key] = null;
          }
        })
      );
      return sendJson(res, 200, { dbs: buildMeta(schemas) });
    }

    // GET /api/claims
    if (pathname === '/api/claims' && req.method === 'GET') {
      const claims = [];
      for (const [dbKey, cfg] of Object.entries(DBS)) {
        const rows = await queryDatabaseAll(cfg.id);
        for (const row of rows) claims.push(normalizeRow(dbKey, row));
      }
      return sendJson(res, 200, { claims });
    }

    // POST /api/claims
    if (pathname === '/api/claims' && req.method === 'POST') {
      const body = await readBody(req);
      const dbKey = body.db;
      if (!DBS[dbKey]) return sendJson(res, 400, { error: 'db non valido: ' + dbKey });
      const properties = claimToProperties(dbKey, body);
      if (!properties[DBS[dbKey].title]) {
        return sendJson(res, 400, { error: 'nome mancante' });
      }
      const page = await createPage(DBS[dbKey].id, properties);
      return sendJson(res, 201, { id: page.id, url: page.url });
    }

    // PATCH /api/claims/:id
    const patchMatch = pathname.match(/^\/api\/claims\/([a-f0-9-]+)$/);
    if (patchMatch && req.method === 'PATCH') {
      const id = patchMatch[1];
      const body = await readBody(req);
      const dbKey = body.db;
      if (!DBS[dbKey]) return sendJson(res, 400, { error: 'db non valido: ' + dbKey });
      const properties = claimToProperties(dbKey, body);
      const page = await updatePage(id, properties);
      return sendJson(res, 200, { id: page.id });
    }

    // DELETE /api/claims/:id
    const deleteMatch = pathname.match(/^\/api\/claims\/([a-f0-9-]+)$/);
    if (deleteMatch && req.method === 'DELETE') {
      await archivePage(deleteMatch[1]);
      return sendJson(res, 200, { ok: true });
    }

    // POST /api/upload (immagine)
    if (pathname === '/api/upload' && req.method === 'POST') {
      const rawName = url.searchParams.get('name') || 'image.png';
      const ext = path.extname(rawName).toLowerCase();
      const safeExt = /^\.(png|jpe?g|gif|webp)$/.test(ext) ? ext : '.png';
      const base = rawName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60) || 'image';
      const filename = `${Date.now()}-${base}${safeExt}`;
      const uploadsDir = path.join(PUBLIC_DIR, 'uploads');
      fs.mkdirSync(uploadsDir, { recursive: true });
      const buf = await readRawBody(req);
      fs.writeFileSync(path.join(uploadsDir, filename), buf);
      return sendJson(res, 200, { url: `/uploads/${filename}` });
    }

    return sendJson(res, 404, { error: 'endpoint non trovato: ' + pathname });
  } catch (err) {
    console.error('[api]', err.message);
    sendJson(res, err.statusCode || 500, { error: err.message });
  }
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  rel = rel.split('?')[0];
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 - Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    return handleApi(req, res, pathname, url);
  }
  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`K-Claims in esecuzione su http://localhost:${PORT}`);
});
