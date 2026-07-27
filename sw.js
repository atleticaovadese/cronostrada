'use strict';
/*
 * CronoStrada — service worker.
 *
 * Serve a una cosa sola: al traguardo la app deve partire in un secondo
 * anche con il telefono in modalità aereo. Per questo la strategia è
 * cache-first sul codice, senza mai chiedere niente alla rete.
 *
 * LA VERSIONE
 * Il browser si accorge che c'è un aggiornamento solo se questo file cambia,
 * byte per byte. Siccome il sito è statico e non c'è nessun passaggio di
 * build che possa iniettare un numero, la versione è l'impronta di
 * index.html, scritta qui sotto e tenuta allineata da un test: se qualcuno
 * modifica la app e si dimentica di aggiornarla, `npm test` fallisce e dice
 * cosa lanciare.
 *
 *     npm run versione
 *
 * COSA NON FINISCE IN CACHE
 * Solo i file elencati in GUSCIO. I dati di prova (reference_anon.json,
 * wise_iscritti_anon.xlsx) e tutto ciò che sta in test/ e tools/ non c'entrano
 * niente con la app e non devono occupare spazio sul telefono di nessuno.
 * Non c'è nessuna messa in cache opportunistica: quello che non è nel guscio
 * passa dalla rete e non viene mai conservato.
 */

const VERSIONE = 'i-4d0eff4b611b';
const CACHE = 'cronostrada-' + VERSIONE;

// Tutto ciò che serve alla app per partire da sola, e nient'altro.
const GUSCIO = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icone/icona-192.png',
  './icone/icona-512.png',
  './icone/icona-maskable-512.png',
  './icone/icona-ios-180.png',
];

self.addEventListener('install', evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' salta la cache HTTP del browser: si scaricano davvero
    // i file nuovi, non quelli che il browser aveva già da parte.
    await cache.addAll(GUSCIO.map(u => new Request(u, { cache: 'reload' })));
    // NIENTE skipWaiting qui: la versione nuova resta in attesa finché non è
    // la persona davanti allo schermo a decidere di ricaricare. Aggiornarsi
    // da soli mentre qualcuno cronometra è il modo più veloce per perdere
    // un arrivo.
  })());
});

self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    for (const nome of await caches.keys()) {
      if (nome.startsWith('cronostrada-') && nome !== CACHE) await caches.delete(nome);
    }
    await self.clients.claim();
  })());
});

// La pagina chiede di passare alla versione nuova: succede solo dopo che
// qualcuno ha premuto "Ricarica" sull'avviso, e mai a gara in corso.
self.addEventListener('message', evento => {
  if (evento.data && evento.data.tipo === 'PASSA_ALLA_NUOVA') self.skipWaiting();
});

self.addEventListener('fetch', evento => {
  const richiesta = evento.request;
  if (richiesta.method !== 'GET') return;

  const url = new URL(richiesta.url);
  if (url.origin !== self.location.origin) return;      // roba altrui: non ci riguarda

  // Aprire la app: si risponde dal guscio, senza toccare la rete. È questo
  // che la fa partire in modalità aereo.
  if (richiesta.mode === 'navigate') {
    evento.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const dal_guscio = await cache.match('./index.html');
      if (dal_guscio) return dal_guscio;
      try { return await fetch(richiesta); }
      catch (e) { return new Response('CronoStrada non disponibile offline.', { status: 503 }); }
    })());
    return;
  }

  // Tutto il resto: se è nel guscio si serve dalla cache, altrimenti si va in
  // rete e non si conserva niente.
  evento.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const trovato = await cache.match(richiesta, { ignoreSearch: true });
    if (trovato) return trovato;
    return fetch(richiesta);
  })());
});
