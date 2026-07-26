'use strict';
/*
 * Server statico minimo, usato SOLO dai test.
 *
 * Serve a far girare i test sullo stesso protocollo con cui gira il sito
 * pubblicato (http), invece che su file://. La app non ne ha bisogno per
 * funzionare: non fa una sola richiesta di rete.
 *
 *     node tools/serve.js [porta]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const PORTA = Number(process.argv[2] || 8777);

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';

  // Non si esce dalla cartella del progetto, nemmeno con ../
  const assoluto = path.join(RADICE, path.normalize(rel));
  if (!assoluto.startsWith(RADICE)) {
    res.writeHead(403).end('403');
    return;
  }

  fs.readFile(assoluto, (err, dati) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 — ' + rel);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TIPI[path.extname(assoluto).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(dati);
  });
});

server.listen(PORTA, '127.0.0.1', () => {
  console.log(`server di test su http://127.0.0.1:${PORTA}`);
});
