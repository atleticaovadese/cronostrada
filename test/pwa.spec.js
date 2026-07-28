'use strict';
/*
 * APP INSTALLABILE E FUNZIONAMENTO OFFLINE
 *
 * Il traguardo è il posto peggiore in cui scoprire che serve la rete. Questi
 * test verificano che la app installata parta in modalità aereo, che in cache
 * finisca solo quello che le serve, e soprattutto che un aggiornamento non si
 * prenda mai la libertà di ricaricare la pagina mentre qualcuno cronometra.
 *
 * Il test degli aggiornamenti lavora su una COPIA della app in una cartella
 * temporanea, con un server suo: deve poter modificare i file per simulare
 * l'uscita di una versione nuova, e non può farlo su quelli veri mentre gli
 * altri test girano.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { RADICE } = require('./aiuto');
const { versioneAttesa } = require('../tools/versione');

const FILE_APP = [
  'index.html', 'sw.js', 'manifest.webmanifest',
  'icone/icona-192.png', 'icone/icona-512.png',
  'icone/icona-maskable-512.png', 'icone/icona-ios-180.png',
];

// I test che usano il service worker hanno bisogno di un contesto che glielo
// permetta e di partire sempre puliti.
test.use({ serviceWorkers: 'allow' });

/** Aspetta che il service worker abbia preso il controllo della pagina. */
async function attendiControllo(page) {
  await page.waitForFunction(
    () => 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null,
    null, { timeout: 20_000 });
}

test.describe('Installabilità', () => {
  test('il manifest dichiara quello che serve per installarla', async ({ page }) => {
    await page.goto('/index.html');
    const collegato = await page.getAttribute('link[rel=manifest]', 'href');
    expect(collegato, 'la pagina deve collegare il manifest').toBe('manifest.webmanifest');

    const m = await page.evaluate(async () =>
      fetch('manifest.webmanifest').then(r => r.json()));

    expect(m.name, 'nome').toBe('CronoStrada');
    expect(m.short_name, 'nome breve').toBe('CronoStrada');
    expect(m.display, 'apertura a schermo intero').toBe('standalone');
    expect(m.orientation, 'orientamento libero').toBe('any');
    expect(m.theme_color.toLowerCase(), 'colore tema scuro, come il pannello del cronometro')
      .toBe('#12151a');
    expect(m.start_url, "percorso relativo: il sito sta in una sottocartella").toBe('./');
    expect(m.scope, 'ambito relativo').toBe('./');

    // le misure richieste, più una ritagliabile
    const misure = m.icons.map(i => `${i.sizes}/${i.purpose}`).sort();
    expect(misure, 'servono 192, 512 e una maskable').toEqual(
      ['192x192/any', '512x512/any', '512x512/maskable'].sort());

    // e l'icona per iPhone, che non passa dal manifest
    const ios = await page.getAttribute('link[rel=apple-touch-icon]', 'href');
    expect(ios, "iPhone usa apple-touch-icon, non il manifest").toBe('icone/icona-ios-180.png');
  });

  test('tutte le icone dichiarate esistono davvero e sono della misura giusta', async ({ page }) => {
    await page.goto('/index.html');
    const m = await page.evaluate(async () => fetch('manifest.webmanifest').then(r => r.json()));
    const daControllare = [
      ...m.icons.map(i => ({ src: i.src, lato: Number(i.sizes.split('x')[0]) })),
      { src: 'icone/icona-ios-180.png', lato: 180 },
    ];

    const problemi = [];
    for (const i of daControllare) {
      const misura = await page.evaluate(src => new Promise(risolvi => {
        const img = new Image();
        img.onload = () => risolvi({ ok: true, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => risolvi({ ok: false });
        img.src = src;
      }), i.src);
      if (!misura.ok) problemi.push(`  ${i.src}: non si carica`);
      else if (misura.w !== i.lato || misura.h !== i.lato) {
        problemi.push(`  ${i.src}: è ${misura.w}x${misura.h}, dichiarata ${i.lato}x${i.lato}`);
      }
    }
    if (problemi.length) {
      throw new Error('\nIcone dichiarate ma sbagliate:\n' + problemi.join('\n') +
        '\n\n  Rigenerale con: npm run icone\n');
    }
  });

  test('i file che decidono la versione hanno i fine-riga di Unix', async () => {
    /* L'impronta è il SHA-256 dei byte. Un CRLF al posto di un LF cambia i
       byte, quindi cambia l'impronta.

       Due modi di farsi male, e questo test copre tutti e due.
       Il primo è già successo: index.html è passato da LF a CRLF senza che
       nessuno lo decidesse — 4461 byte in più che in un diff non si vedono,
       il file identico riga per riga e diverso byte per byte. Da lì
       l'impronta è cambiata e le rotture di npm run mutazioni che
       attraversano due righe hanno smesso di trovare il loro punto.
       Il secondo è il rischio di adesso: .gitattributes normalizza quello
       che viene REGISTRATO, e se uno strumento riscrivesse il file con CRLF
       il disco resterebbe sbagliato. Siccome l'impronta si calcola sul file
       locale, il numero di qui e quello di un clone divergerebbero. A
       quello pensa tools/testo.js; questo test è quello che se ne accorge
       se saltano entrambi. */
    const daControllare = ['index.html', 'dist/CronoStrada.html', 'sw.js', 'manifest.webmanifest'];
    const colpevoli = daControllare
      .map(f => ({ f, byte: fs.readFileSync(path.join(RADICE, f)) }))
      .filter(x => x.byte.includes(0x0d))
      .map(x => `  ${x.f}: ${x.byte.toString('utf8').split('\r\n').length - 1} righe con CRLF`);

    if (colpevoli.length) {
      throw new Error(
        '\nQuesti file hanno i fine-riga di Windows:\n' + colpevoli.join('\n') +
        '\n\n  L\'impronta del guscio è il SHA-256 dei byte: con i fine-riga sbagliati\n' +
        '  il numero calcolato qui non coincide con quello di un clone pulito, e\n' +
        '  la versione del service worker diventa una lotteria.\n\n' +
        '  Rimettili a posto e rilancia:  npm run versione\n');
    }
  });

  test('la versione del service worker è allineata a tutto il guscio', async () => {
    // Se si modifica un file che finisce in cache e sw.js resta identico, il
    // browser non si accorge di niente e chi ha la app installata usa la
    // versione vecchia per sempre, senza nessun avviso. È un guasto
    // silenzioso. Vale per index.html, ma anche per il manifest e per le
    // icone: quelle si rigenerano da sole con `npm run icone`, ed è proprio
    // il caso in cui è facile dimenticarsene.
    //
    // Il calcolo è rifatto qui a mano, apposta: se il test si limitasse a
    // chiamare tools/versione.js, un errore lì dentro passerebbe inosservato
    // perché entrambe le parti sbaglierebbero allo stesso modo.
    const sw = fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8');

    const blocco = /const GUSCIO = \[([\s\S]*?)\]/.exec(sw);
    expect(blocco, "in sw.js deve esserci l'elenco GUSCIO").not.toBeNull();
    const guscio = [...new Set([...blocco[1].matchAll(/'([^']+)'/g)]
      .map(m => m[1].replace(/^\.\//, ''))
      .map(v => (v === '' ? 'index.html' : v)))].sort();

    // Se domani qualcuno aggiunge un file al guscio, deve entrare anche
    // nell'impronta: l'elenco è uno solo e viene letto da sw.js, ma questo
    // controllo si accorge se il guscio si svuota per sbaglio.
    expect(guscio, 'nel guscio ci vanno la pagina, il manifest e le icone')
      .toEqual(['icone/icona-192.png', 'icone/icona-512.png',
        'icone/icona-ios-180.png', 'icone/icona-maskable-512.png',
        'index.html', 'manifest.webmanifest']);

    const mancanti = guscio.filter(f => !fs.existsSync(path.join(RADICE, f)));
    if (mancanti.length) {
      throw new Error('\nIn GUSCIO ci sono file che non esistono:\n' +
        mancanti.map(f => '  ' + f).join('\n') + '\n');
    }

    const combinata = crypto.createHash('sha256');
    for (const f of guscio) {
      combinata.update(f + '\n');
      combinata.update(crypto.createHash('sha256')
        .update(fs.readFileSync(path.join(RADICE, f))).digest('hex') + '\n');
    }
    const attesa = 'g-' + combinata.digest('hex').slice(0, 12);
    const scritta = (/const VERSIONE = '([^']+)'/.exec(sw) || [])[1];

    if (scritta !== attesa) {
      // Dire QUALE file è cambiato: senza, si va a tentativi.
      const righe = guscio.map(f => '  ' + crypto.createHash('sha256')
        .update(fs.readFileSync(path.join(RADICE, f))).digest('hex').slice(0, 12) + '  ' + f);
      throw new Error(
        `\nLa versione in sw.js non corrisponde ai file del guscio.\n` +
        `  sw.js dice     ${scritta}\n` +
        `  dovrebbe dire  ${attesa}\n\n` +
        `  Impronte dei file che finiscono in cache:\n` + righe.join('\n') + '\n\n' +
        `  Senza questo il browser non si accorge dell'aggiornamento e chi ha la\n` +
        `  app installata resta alla versione vecchia senza saperlo: pagina,\n` +
        `  manifest e icone comprese.\n\n` +
        `  Sistemala con:  npm run versione\n`);
    }
  });
});

test.describe('Funzionamento offline', () => {
  test('in cache finisce solo la app, mai i dati di prova', async ({ page }) => {
    await page.goto('/index.html');
    await attendiControllo(page);

    const dentro = await page.evaluate(async () => {
      const fuori = [];
      for (const nome of await caches.keys()) {
        const c = await caches.open(nome);
        for (const r of await c.keys()) fuori.push(new URL(r.url).pathname);
      }
      return fuori.sort();
    });

    expect(dentro.length, 'la cache non deve essere vuota').toBeGreaterThan(0);

    const vietati = dentro.filter(p =>
      /(reference(_anon)?\.json|wise_iscritti|\/test\/|\/tools\/|playwright\.config|package(-lock)?\.json|\.github\/|\/dist\/)/i.test(p));
    if (vietati.length) {
      throw new Error(
        `\nIn cache è finita roba che non appartiene alla app:\n` +
        vietati.map(p => `  ${p}`).join('\n') +
        `\n\n  Ci va solo ciò che serve per partire offline: la pagina, il manifest\n` +
        `  e le icone. I dati di prova e gli strumenti occupano spazio sul\n` +
        `  telefono di chi la usa e non servono a niente.\n`);
    }

    // e ci deve essere il minimo indispensabile
    for (const necessario of ['/index.html', '/manifest.webmanifest']) {
      expect(dentro.some(p => p.endsWith(necessario)),
        `${necessario} deve essere in cache, altrimenti offline non parte`).toBe(true);
    }
  });

  test('in modalità aereo parte lo stesso, e in fretta', async ({ page, context }) => {
    await page.goto('/index.html');
    await attendiControllo(page);

    // una gara con dei dati dentro
    await page.evaluate(() => {
      S.iscritti = [{
        id: 'a', pett: 126, cognome: 'ROSSI', nome: 'MARCO', sesso: 'M',
        societa: 'ATL. TEST', nascita: '1990-01-01', conferma: 'S',
      }];
      touched(); go('traguardo');
    });
    await page.click('#btnStart');
    await page.evaluate(() => { segnaArrivo(126); });

    // MODALITÀ AEREO
    await context.setOffline(true);
    const t0 = Date.now();
    await page.reload();
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null, null, { timeout: 20_000 });
    const impiegato = Date.now() - t0;

    const r = await page.evaluate(() => ({
      arrivi: S.arrivi.length,
      iscritti: S.iscritti.length,
      partenza: !!S.start,
      calcola: typeof calcola === 'function',
      pettorale: S.arrivi[0] && S.arrivi[0].pett,
    }));

    expect(r.calcola, 'la app deve essere caricata per intero').toBe(true);
    expect(r.arrivi, "l'arrivo registrato prima di andare offline è ancora lì").toBe(1);
    expect(r.pettorale, 'con il suo pettorale').toBe(126);
    expect(r.iscritti, 'e gli iscritti pure').toBe(1);
    expect(r.partenza, "e l'orario di partenza").toBe(true);

    if (impiegato > 3000) {
      throw new Error(
        `\nOffline la app ci ha messo ${impiegato} ms a ripartire.\n` +
        `  Al traguardo deve partire in un secondo: la strategia è cache-first,\n` +
        `  senza chiedere niente alla rete.\n`);
    }

    await context.setOffline(false);
  });

  test('offline si continua a cronometrare e a salvare', async ({ page, context }) => {
    await page.goto('/index.html');
    await attendiControllo(page);
    await page.evaluate(() => {
      S.iscritti = [{
        id: 'a', pett: 7, cognome: 'BIANCHI', nome: 'GIULIA', sesso: 'F',
        societa: 'ATL. TEST', nascita: '1992-01-01', conferma: 'S',
      }];
      touched(); go('traguardo');
    });

    await context.setOffline(true);
    await page.click('#btnStart');
    await page.evaluate(() => { segnaArrivo(7); segnaArrivo(null); });

    const salvato = await page.evaluate(() =>
      (JSON.parse(localStorage.getItem('cronostrada.v1') || '{}').arrivi || []).length);
    expect(salvato, 'senza rete gli arrivi si salvano come sempre').toBe(2);

    await page.reload();
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null, null, { timeout: 20_000 });
    expect(await page.evaluate(() => S.arrivi.length),
      'e li si ritrova dopo un ricaricamento, sempre senza rete').toBe(2);

    await context.setOffline(false);
  });
});

test.describe('La app non dipende dal service worker', () => {
  /*
   * Il vincolo che viene prima di tutti gli altri: CronoStrada deve
   * continuare a funzionare aperta con un doppio clic dalla chiavetta USB,
   * dove i service worker non esistono nemmeno. La PWA è un in più, non una
   * condizione per partire.
   */

  test('la logica della app non chiede un solo file esterno', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);

    const r = await page.evaluate(() => ({
      caricata: typeof S !== 'undefined' && typeof calcola === 'function' && typeof csvWiseRows === 'function',
      // Manifest e icone sono decorazioni: se mancano la app parte lo stesso.
      // Script e fogli di stile esterni no: quelli sarebbero una dipendenza.
      dipendenze: performance.getEntriesByType('resource')
        .filter(e => ['script', 'link', 'css', 'xmlhttprequest', 'fetch'].includes(e.initiatorType))
        .map(e => new URL(e.name).pathname)
        .filter(p => !/manifest\.webmanifest$|\.png$/i.test(p)),
    }));

    expect(r.caricata, 'la app si carica per intero da sola').toBe(true);
    expect(r.dipendenze,
      'nessuno script né foglio di stile esterno: è ciò che la fa funzionare da chiavetta USB')
      .toEqual([]);
  });

  test('la copia di emergenza non registra nessun service worker', async ({ page }) => {
    // dist/CronoStrada.html è la copia per la chiavetta. Anche se qualcuno la
    // apre da un server, non deve lasciare registrazioni in giro né rubare la
    // cache alla app vera.
    await page.goto('/dist/CronoStrada.html');
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);
    await page.waitForTimeout(700);

    const regs = await page.evaluate(async () =>
      'serviceWorker' in navigator
        ? (await navigator.serviceWorker.getRegistrations()).map(r => r.scope)
        : []);
    expect(regs, 'la copia di emergenza non registra niente').toEqual([]);

    // e funziona lo stesso
    expect(await page.evaluate(() => typeof calcola === 'function')).toBe(true);
  });
});

test.describe('Aggiornamenti', () => {
  /*
   * Questo gruppo lavora su una copia della app in una cartella temporanea,
   * con un server suo: per simulare l'uscita di una versione nuova bisogna
   * modificare i file, e non si possono toccare quelli veri.
   */
  let cartella, server, porta, base;

  test.beforeAll(async () => {
    cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'cronostrada-pwa-'));
    fs.mkdirSync(path.join(cartella, 'icone'), { recursive: true });
    for (const f of FILE_APP) {
      fs.copyFileSync(path.join(RADICE, f), path.join(cartella, f));
    }
    porta = 8850 + Math.floor(Number(process.env.TEST_PARALLEL_INDEX || 0));
    base = `http://127.0.0.1:${porta}`;
    server = spawn(process.execPath,
      [path.join(RADICE, 'tools', 'serve.js'), String(porta), cartella],
      { cwd: RADICE, stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 1200));
  });

  test.afterAll(async () => {
    if (server) server.kill();
    if (cartella) fs.rmSync(cartella, { recursive: true, force: true });
  });

  /**
   * Finge l'uscita di una versione nuova: cambia la app e allinea la versione
   * del service worker, come farebbe `npm run versione`.
   *
   * Il marchio è un <meta>, non il titolo: il titolo lo riscrive la app a
   * ogni ridisegno e non servirebbe a distinguere le versioni.
   */
  let numeroVersione = 1;
  function pubblicaVersioneNuova() {
    numeroVersione++;
    const etichetta = 'v' + numeroVersione;
    const app = path.join(cartella, 'index.html');
    const marchio = `<meta name="versione-prova" content="${etichetta}">`;
    let testo = fs.readFileSync(app, 'utf8');
    testo = /<meta name="versione-prova"[^>]*>/.test(testo)
      ? testo.replace(/<meta name="versione-prova"[^>]*>/, marchio)
      : testo.replace('</head>', marchio + '\n</head>');
    fs.writeFileSync(app, testo, 'utf8');

    // La versione si ricalcola con lo stesso strumento che si usa davvero,
    // puntato sulla copia temporanea: qui interessa che la pubblicazione sia
    // fedele, non ricontrollare la formula (a quello pensa il test sopra).
    const sw = path.join(cartella, 'sw.js');
    const testoSw = fs.readFileSync(sw, 'utf8');
    fs.writeFileSync(sw, testoSw.replace(/const VERSIONE = '[^']+'/,
      `const VERSIONE = '${versioneAttesa(testoSw, cartella)}'`), 'utf8');
    return etichetta;
  }

  const versioneCaricata = page => page.evaluate(() => {
    const m = document.querySelector('meta[name="versione-prova"]');
    return m ? m.content : 'v1';
  });

  test('a gara in corso l\'aggiornamento aspetta in silenzio', async ({ page }) => {
    await page.goto(`${base}/index.html`);
    await attendiControllo(page);

    // gara avviata: S.start valorizzato, S.stop no
    await page.evaluate(() => {
      S.iscritti = [{
        id: 'a', pett: 5, cognome: 'ROSSI', nome: 'MARCO', sesso: 'M',
        societa: 'ATL', nascita: '1990-01-01', conferma: 'S',
      }];
      touched(); go('traguardo');
    });
    await page.click('#btnStart');
    await page.evaluate(() => { segnaArrivo(5); });
    expect(await page.evaluate(() => !!S.start && !S.stop), 'la gara è in corso').toBe(true);

    // marchio la pagina: se si ricarica, sparisce
    await page.evaluate(() => { window.__vivo = 'si'; });

    pubblicaVersioneNuova();
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      await r.update();
    });
    // do tempo alla versione nuova di installarsi e mettersi in attesa
    await page.waitForFunction(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      return !!(r && r.waiting);
    }, null, { timeout: 20_000 });
    await page.waitForTimeout(600);

    const durante = await page.evaluate(() => ({
      viva: window.__vivo === 'si',
      avvisoVisibile: document.querySelector('#aggiorna').classList.contains('on'),
      arrivi: S.arrivi.length,
      inGara: !!S.start && !S.stop,
    }));

    if (!durante.viva) {
      throw new Error(
        '\nLa pagina si è ricaricata da sola mentre la gara era in corso.\n\n' +
        "  Con S.start valorizzato e S.stop no non ci si ricarica per nessun\n" +
        '  motivo: si perderebbero gli arrivi di chi sta passando.\n');
    }
    if (durante.avvisoVisibile) {
      throw new Error(
        "\nL'avviso di versione nuova è comparso a gara in corso.\n\n" +
        '  Deve aspettare in silenzio: al traguardo non si legge niente e un\n' +
        '  avviso è solo un modo per far premere il pulsante sbagliato.\n');
    }
    expect(durante.arrivi, "l'arrivo registrato è intatto").toBe(1);
    expect(durante.inGara, 'e la gara risulta ancora in corso').toBe(true);

    // Finita la gara, l'avviso può comparire.
    await page.evaluate(() => { S.stop = Date.now(); touched(); });
    await expect(page.locator('#aggiorna'),
      'a gara finita l\'avviso compare').toBeVisible();
    await expect(page.locator('#aggiorna'))
      .toContainText('È disponibile una versione aggiornata');
    await expect(page.locator('#btnRicarica')).toHaveText('Ricarica');

    // e la pagina non si è ancora ricaricata: decide chi guarda
    expect(await page.evaluate(() => window.__vivo === 'si'),
      'nemmeno adesso si ricarica da sola').toBe(true);
  });

  test('premendo Ricarica si passa alla versione nuova', async ({ page }) => {
    await page.goto(`${base}/index.html`);
    await attendiControllo(page);
    const prima = await versioneCaricata(page);

    const attesa = pubblicaVersioneNuova();
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      await r.update();
    });
    await expect(page.locator('#aggiorna'), "l'avviso compare (nessuna gara in corso)")
      .toBeVisible({ timeout: 20_000 });

    // la pagina è ancora quella vecchia finché non si preme
    expect(await versioneCaricata(page), 'prima di premere resta la versione vecchia')
      .toBe(prima);

    await Promise.all([
      page.waitForEvent('load'),
      page.click('#btnRicarica'),
    ]);
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null, null, { timeout: 20_000 });

    const dopo = await versioneCaricata(page);
    expect(dopo, `dopo Ricarica deve girare la versione nuova (prima era ${prima})`)
      .toBe(attesa);
    await expect(page.locator('#aggiorna'), "e l'avviso sparisce").toBeHidden();
  });
});
