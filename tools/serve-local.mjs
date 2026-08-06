import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(process.cwd());
const port = Number(process.argv[2]) || 8765;
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.json5': 'application/json5; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(target, (error, data) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
      return;
    }
    response.writeHead(200, {
      'content-type': types[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(data);
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`Vugg local server: http://127.0.0.1:${port}`);
});
