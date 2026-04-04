// Simple static file server for local development
// Usage: node server.js
// Then open: http://localhost:3000
//
// Create local.config.js (gitignored) to inject secrets during local dev.
// Copy local.config.example.js and fill in your values.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

let localConfig = {};
try { localConfig = require('./local.config.js'); } catch {}
const TWITCH_CLIENT_ID = localConfig.TWITCH_CLIENT_ID || '';
const GA_MEASUREMENT_ID = localConfig.GA_MEASUREMENT_ID || '';

function injectSecrets(text) {
  if (TWITCH_CLIENT_ID) text = text.replace(/__TWITCH_CLIENT_ID__/g, TWITCH_CLIENT_ID);
  if (GA_MEASUREMENT_ID) text = text.replace(/__GA_MEASUREMENT_ID__/g, GA_MEASUREMENT_ID);
  return text;
}

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
};

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);

  // Prevent path traversal outside ROOT
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    // Inject secrets into HTML and JS files at serve-time
    if (ext === '.html' || ext === '.js') {
      const injected = injectSecrets(data.toString('utf8'));
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(injected, 'utf8');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`FortuneWheel5000 running at http://localhost:${PORT}/`);
  console.log('Set your Twitch redirect URI to: http://localhost:3000');
  console.log('Press Ctrl+C to stop.');
});
