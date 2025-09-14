import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

/*
 * A lightweight HTTP server implementing a basic AdSense auditing API
 * without any external dependencies. This file intentionally avoids
 * Express and other third‑party modules, using only Node.js built‑ins.
 *
 * Routes:
 *   GET  /         – serves the frontend (index.html) from the public directory.
 *   GET  /healthz  – returns 200 to indicate service health.
 *   GET  /<asset>  – serves static files from the public directory.
 *   POST /api/audit – accepts JSON { url: "https://..." }, fetches the URL
 *                    and applies simple checks for AdSense policy risks.
 */

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = join(process.cwd(), 'public');

/**
 * Derive a MIME type based on file extension for static file serving.
 * This minimal lookup covers only the types used in this project.
 * @param {string} ext File extension (including leading dot)
 */
function getMimeType(ext) {
  switch (ext.toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

const server = createServer(async (req, res) => {
  const { method, url: reqUrl } = req;
  // URL includes query; we ignore query and hash
  const pathname = reqUrl.split('?')[0];

  // Serve health check
  if (method === 'GET' && pathname === '/healthz') {
    res.statusCode = 200;
    return res.end('');
  }

  // Serve static files and root page
  if (method === 'GET') {
    // Determine file path: root path serves index.html
    const filePath = pathname === '/' || pathname === ''
      ? join(PUBLIC_DIR, 'index.html')
      : join(PUBLIC_DIR, pathname);
    try {
      const data = await readFile(filePath);
      const ext = extname(filePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', getMimeType(ext));
      return res.end(data);
    } catch (err) {
      // If not found, fall through
    }
  }

  // Handle audit endpoint
  if (method === 'POST' && pathname === '/api/audit') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      let payload;
      try {
        payload = JSON.parse(body || '{}');
      } catch (e) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
      }
      const auditUrl = payload?.url;
      if (!auditUrl || !/^https?:\/\//i.test(auditUrl)) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({ ok: false, error: 'Provide a valid http(s) URL in { url }' })
        );
      }
      try {
        // Fetch the remote page. Node 18+ provides global fetch.
        const response = await fetch(auditUrl, {
          headers: { 'User-Agent': 'AdsenseAuditor/1.0' },
          // Note: timeout is not directly supported by global fetch. In production
          // one could implement an AbortController if desired.
        });
        const html = await response.text();
        // Extract title via regex (case insensitive)
        let title = '';
        const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (match) {
          title = match[1].trim();
        }
        const lower = html.toLowerCase();
        const bannedPattern = /(porn|xxx|sex\s?cam|escort|casino|betting|gambl)/;
        const hasAdult = bannedPattern.test(lower);
        const hasAdsTxt = lower.includes('ads.txt');
        const result = {
          ok: true,
          page: {
            title,
            length: html.length,
          },
          checks: {
            potential_policy_risk_terms: hasAdult,
            has_ads_txt_reference: hasAdsTxt,
          },
          notes: [
            'This is a smoke test. Extend with layout analysis and more specific AdSense policies.',
          ],
        };
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(result));
      } catch (err) {
        res.statusCode = 502;
        return res.end(
          JSON.stringify({ ok: false, error: 'Fetch failed', detail: err?.message || String(err) })
        );
      }
    });
    return;
  }

  // Catch‑all for unknown routes
  res.statusCode = 404;
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
