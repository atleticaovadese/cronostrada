'use strict';
/*
 * IL COLLAUDO FINALE
 *
 * Una sola sequenza, la gara vera dall'inizio alla fine, tutta senza rete, e
 * poi la rete che torna. È il collaudo che nessun altro test fa: gli altri
 * provano un pezzo per volta, questo prova la giornata.
 *
 * PERCHÉ ESISTE. L'invio si fermava a 555 righe su 834 e non ripartiva più.
 * Nessun test se n'era accorto perché nessuno percorreva una gara intera:
 * con venti righe la coda si svuotava al primo giro e il difetto non aveva
 * modo di comparire. Serviva il volume vero — 280 iscritti, 265 arrivi, le
 * correzioni, i ritiri — per farlo uscire. Da qui in avanti quel volume si
 * percorre a ogni pubblicazione.
 *
 * COSA PROVA, nell'ordine in cui succede al campo:
 *   - i 280 iscritti importati dal file WISE, con il riconoscimento colonne
 *   - il grosso degli arrivi SENZA RETE, con la coda che cresce e non parte
 *   - la rete che torna A GARA IN CORSO, non a gara finita: gli ultimi
 *     sessantacinque arrivi entrano in coda mentre i primi duecento stanno
 *     ancora partendo. È in quella sovrapposizione che l'invio si fermava,
 *     e il test controlla di esserci finito davvero dentro
 *   - i pettorali dettati dopo, qualche tempo corretto a mano, un ritiro
 *   - la partenza spostata a gara conclusa, perché lo sparo era prima
 *   - e poi nessuno che tocca più niente: la coda deve arrivare a zero da sola
 *   - sul server i conteggi esatti, e gli stessi valori che si leggono qui
 *   - due sincronizzazioni forzate in più che non aggiungono una riga
 *
 * L'ultimo punto è quello che vale di più: è la prova che l'invio non fa
 * doppioni. Una riga in più per arrivo, moltiplicata per ogni volta che
 * torna la rete, è il modo in cui un archivio si rovina in silenzio.
 */

const { test, expect } = require('@playwright/test');
const { RIFERIMENTO, ANNO_RIFERIMENTO, PERCORSO_XLSX, confrontaNumero } = require('./aiuto');
const { nuovoServer, montaServerFinto, accediNellaApp, attendiCodaVuota, codaDi } =
  require('./finto-server');

/** Quanti arrivi si registrano senza pettorale, per assegnarlo dopo. */
const SENZA_PETTORALE = 40;
/** Quanti tempi si correggono a mano dopo averli registrati. */
const TEMPI_CORRETTI = 5;

const conteggi = db => Object.fromEntries(
  Object.entries(db.tabelle).map(([k, v]) => [k, v.length]));

test('La gara vera dall\'inizio alla fine, senza rete e poi con la rete', async ({ browser }) => {
  /* Un minuto e mezzo quando va bene, sul computer di casa. Il margine è
     per le macchine della CI, che hanno due processori e li dividono con
     gli altri test. Il tempo massimo che conta davvero è quello dell'attesa
     finale sulla coda, più sotto: quella scade in novanta secondi. */
  test.setTimeout(300_000);

  const db = nuovoServer();
  const contesto = await browser.newContext();
  await montaServerFinto(contesto, db);
  const page = await contesto.newPage();
  page.on('dialog', d => d.accept().catch(() => { }));
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof S !== 'undefined' && typeof calcola === 'function' && C !== null);
  await accediNellaApp(page);

  /* ---------------------------------------------------------------
     1. LA SERA PRIMA — la gara e i 280 iscritti dal file WISE
     --------------------------------------------------------------- */
  await page.evaluate(anno => {
    nuovaGara();
    S.cfg.nome = '7ª Stradolcetto'; S.cfg.data = anno + '-09-14';
    S.cfg.luogo = 'Ovada'; S.cfg.km = 10; S.cfg.anno = anno;
    touched();
    go('iscritti');
  }, ANNO_RIFERIMENTO);

  const [scelta] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#btnIscImport'),
  ]);
  await scelta.setFiles(PERCORSO_XLSX);
  await expect(page.locator('#dlgImport')).toBeVisible();
  await page.click('#impOk');
  await expect(page.locator('#dlgImport')).toBeHidden();

  confrontaNumero('iscritti importati dal file WISE', 280,
    await page.evaluate(() => S.iscritti.length));

  /* La sera prima c'è il wifi di casa: la gara e i suoi iscritti partono
     subito. Si aspetta che la coda si svuoti, così quello che viene dopo
     parte da una situazione pulita e i conti si leggono senza ambiguità. */
  await page.evaluate(() => sincronizzaSubito());
  await attendiCodaVuota(page, 120_000);
  confrontaNumero('iscritti già sul server la sera prima', 280, db.tabelle.iscritti.length);

  /* ---------------------------------------------------------------
     2. DA QUI IN POI NON C'È RETE. È la condizione normale a un
        traguardo in mezzo alle colline, non un caso eccezionale.
     --------------------------------------------------------------- */
  db.giu = true;

  /* ---------------------------------------------------------------
     3. LO SPARO E IL GROSSO DEGLI ARRIVI, ancora senza rete
        Si passa dal vero segnaArrivo — quello che preme il pulsante —
        e subito dopo si scrive il tempo della gara reale al posto di
        quello dell'orologio: aspettare quaranta minuti veri non è una
        prova migliore, è la stessa prova più lenta.
     --------------------------------------------------------------- */
  await page.evaluate(() => { go('traguardo'); });
  await page.click('#btnStart');

  const PRIMA_TRANCHE = RIFERIMENTO.arrivi.length - 65;

  await page.evaluate(async arrivi => {
    for (const a of arrivi) {
      segnaArrivo(a.pett);
      S.arrivi[S.arrivi.length - 1].ms = a.ms;      // il tempo vero della gara
    }
    touched();
    await sincronizzaSubito();                      // senza rete: si accoda e basta
  }, RIFERIMENTO.arrivi.slice(0, PRIMA_TRANCHE));

  /* LA PROVA CHE ERA DAVVERO SENZA RETE: duecento arrivi registrati e
     nessuno arrivato dall'altra parte. */
  expect(await codaDi(page), 'senza rete la coda deve essersi riempita').toBeGreaterThan(300);
  confrontaNumero('arrivi finiti sul server mentre non c\'era rete', 0, db.tabelle.arrivi.length);
  confrontaNumero('correzioni finite sul server mentre non c\'era rete',
    0, db.tabelle.arrivi_correzioni.length);

  /* ---------------------------------------------------------------
     4. TORNA LA RETE, MA LA GARA NON È FINITA
        È il punto esatto in cui l'invio si fermava. Il primo giro parte
        con la coda che ha già cinquecento righe, e mentre le manda ne
        entrano altre: gli ultimi sessantacinque arrivi, i pettorali
        dettati dopo, i tempi corretti. Chi legge la coda una volta sola
        manda la fotografia e lascia dentro tutto il resto — e a gara
        finita nessuno tocca più niente, quindi non riparte mai.

        Il server si fa lento apposta, così l'invio è ancora in volo
        mentre la gara continua. Senza questa sovrapposizione la prova
        non proverebbe niente, ed è per questo che più sotto si controlla
        che ci sia stata davvero.
     --------------------------------------------------------------- */
  db.giu = false;
  db.lento = 20;
  await page.evaluate(() => { window.dispatchEvent(new Event('online')); });

  const ultimi = RIFERIMENTO.arrivi.slice(PRIMA_TRANCHE);
  const registrati = await page.evaluate(async ({ arrivi, senzaPett }) => {
    // gli ultimi N si registrano senza pettorale: il giudice li detta dopo
    const senza = new Set(arrivi.slice(-senzaPett).map(a => a.pett));
    for (const a of arrivi) {
      segnaArrivo(senza.has(a.pett) ? null : a.pett);
      S.arrivi[S.arrivi.length - 1].ms = a.ms;
    }
    touched();
    await sincronizzaSubito();
    return {
      totale: S.arrivi.length,
      senzaPettorale: S.arrivi.filter(a => a.pett === null).length,
    };
  }, { arrivi: ultimi, senzaPett: SENZA_PETTORALE });

  confrontaNumero('arrivi registrati', RIFERIMENTO.arrivi.length, registrati.totale);
  confrontaNumero('arrivi ancora senza pettorale', SENZA_PETTORALE, registrati.senzaPettorale);

  /* ---------------------------------------------------------------
     5. I PETTORALI DETTATI DOPO, con lo stesso tastierino del traguardo
     --------------------------------------------------------------- */
  await page.evaluate(async ({ arrivi, senzaPett }) => {
    const petti = arrivi.slice(-senzaPett).map(a => a.pett);
    const daFare = S.arrivi.filter(a => a.pett === null);
    for (let i = 0; i < daFare.length; i++) {
      apriAssegnazione(daFare[i].id);
      document.querySelector('#quickBib').value = String(petti[i]);
      padConferma();
    }
    await sincronizzaSubito();
  }, { arrivi: ultimi, senzaPett: SENZA_PETTORALE });

  confrontaNumero('arrivi rimasti senza pettorale', 0,
    await page.evaluate(() => S.arrivi.filter(a => a.pett === null).length));

  /* ---------------------------------------------------------------
     6. QUALCHE TEMPO CORRETTO A MANO
        Capita: un arrivo preso in ritardo di un paio di secondi, uno
        anticipato. Sono righe di correzione in più, non riscritture.
     --------------------------------------------------------------- */
  const corretti = await page.evaluate(async n => {
    const scelti = [];
    for (let i = 0; i < n; i++) {
      const a = S.arrivi[i * 7 + 3];
      a.corr = (i % 2 ? 1 : -1) * (i + 1);
      scelti.push({ pett: a.pett, corr: a.corr });
    }
    touched();
    await sincronizzaSubito();
    return scelti;
  }, TEMPI_CORRETTI);
  expect(corretti.length).toBe(TEMPI_CORRETTI);

  /* ---------------------------------------------------------------
     7. UN RITIRO
     --------------------------------------------------------------- */
  const ritirato = await page.evaluate(async () => {
    const attesi = C.stati.filter(s => s.stato === 'Atteso');
    const pett = attesi.length ? attesi[0].pett : S.iscritti[0].pett;
    S.dnf = [...new Set([...S.dnf, pett])];
    touched();
    await sincronizzaSubito();
    return pett;
  });

  /* ---------------------------------------------------------------
     8. LA PARTENZA SPOSTATA
        Lo sparo era 45 secondi prima di come era stato segnato. Qui i
        tempi si traslano tutti; sul server i grezzi non devono muoversi
        di un millisecondo.
     --------------------------------------------------------------- */
  const spostamento = await page.evaluate(() => {
    const primaLocali = S.arrivi.map(a => a.ms);
    stNew = S.start - 45_000;
    applicaStart();
    return {
      scarto: S.scartoPartenza,
      traslati: S.arrivi.every((a, i) => a.ms === primaLocali[i] + 45_000),
    };
  });
  // Lo sparo si sposta indietro di 45 secondi: lo scarto è negativo di
  // altrettanto, e i tempi che si leggono qui crescono tutti di 45 secondi.
  confrontaNumero('scarto della partenza', -45_000, spostamento.scarto);
  expect(spostamento.traslati, 'i tempi locali si sono traslati tutti').toBe(true);

  await page.evaluate(async () => { S.stop = Date.now(); touched(); await sincronizzaSubito(); });

  /* ---------------------------------------------------------------
     9. LA SOVRAPPOSIZIONE C'È STATA, e adesso non si tocca più niente

        Qui la gara è finita. Il computer resta acceso sul tavolo e
        nessuno preme più un tasto: la coda deve arrivare a zero da
        sola. Prima però si controlla che ci sia ancora qualcosa dentro
        E che qualcosa sia già partito — se la coda fosse già vuota,
        tutto quello che viene dopo passerebbe senza aver provato niente.
     --------------------------------------------------------------- */
  const restanti = await codaDi(page);
  const giaSulServer = Object.values(conteggi(db)).reduce((a, b) => a + b, 0);
  if (!restanti || !giaSulServer) {
    throw new Error(
      '\nLa prova non si è messa nella condizione che deve provare.\n' +
      `  in coda adesso: ${restanti}\n  righe già sul server: ${giaSulServer}\n\n` +
      "  Servono tutte e due diverse da zero: il difetto compare solo quando\n" +
      '  la coda cresce MENTRE il primo giro sta ancora inviando.\n');
  }

  db.lento = 0;
  /* Novanta secondi: a server sciolto le ottocento righe partono in una
     quindicina. Il margine serve a una macchina lenta, non a dare tempo a
     un invio che si è fermato — quello non riparte comunque, e tanto vale
     accorgersene subito. */
  await attendiCodaVuota(page, 90_000);

  /* ---------------------------------------------------------------
     10. I CONTEGGI SUL SERVER
     --------------------------------------------------------------- */
  const dopo = conteggi(db);
  const attesi = {
    gare: 1,
    configurazione: 1,
    fasce: await page.evaluate(() => S.matrice.length),
    iscritti: 280,
    arrivi: 265,
    // Una correzione per arrivo — il pettorale, dettato subito o dopo — più
    // una per ogni tempo corretto a mano dopo che la prima era già partita.
    arrivi_correzioni: 265 + TEMPI_CORRETTI,
    ritiri: 1,
    risultati_pubblici: 0,
  };
  const storti = Object.keys(attesi).filter(k => dopo[k] !== attesi[k]);
  if (storti.length) {
    throw new Error(
      '\nSul server i conteggi non tornano dopo una gara intera:\n' +
      storti.map(k => `  ${k}: attese ${attesi[k]} righe, ce ne sono ${dopo[k]}`).join('\n') +
      '\n\n  Tutte le tabelle:\n' +
      Object.entries(dopo).map(([k, v]) => `    ${k}: ${v}`).join('\n') + '\n');
  }

  /* I VALORI, non solo il numero delle righe. Il grezzo sul server deve
     essere il tempo locale più lo scarto, per tutti e 265, e la correzione
     più recente di ogni arrivo deve dire quello che si legge qui. */
  const qui = await page.evaluate(() => ({
    scarto: S.scartoPartenza,
    arrivi: S.arrivi.map(a => ({ id: a.id, ms: a.ms, pett: a.pett, corr: a.corr || 0 })),
    dnf: S.dnf.slice(),
  }));

  const grezziAttesi = qui.arrivi.map(a => a.ms + qui.scarto).sort((x, y) => x - y);
  const grezziSulServer = db.tabelle.arrivi.map(a => a.ms).sort((x, y) => x - y);
  expect(grezziSulServer, 'i tempi grezzi sul server sono quelli misurati dalla partenza originale')
    .toEqual(grezziAttesi);

  const ultima = new Map();
  for (const k of db.tabelle.arrivi_correzioni.slice()
    .sort((a, b) => String(a.creato_il).localeCompare(String(b.creato_il)))) {
    ultima.set(k.arrivo_id, k);
  }
  const diversi = qui.arrivi.filter(a => {
    const k = ultima.get(a.id);
    return !k || (k.pett ?? null) !== a.pett || (k.corr_s || 0) !== a.corr;
  });
  if (diversi.length) {
    throw new Error(
      `\n${diversi.length} arrivi su ${qui.arrivi.length} risultano diversi sul server.\n` +
      diversi.slice(0, 5).map(a => {
        const k = ultima.get(a.id) || {};
        return `  qui: pettorale ${a.pett}, correzione ${a.corr}s — ` +
          `sul server: pettorale ${k.pett ?? '(nessuno)'}, correzione ${k.corr_s ?? '(nessuna)'}s`;
      }).join('\n') + '\n');
  }

  expect(db.tabelle.ritiri.map(r => r.pett), 'il ritiro è quello segnato qui').toEqual([ritirato]);
  expect(qui.dnf).toEqual([ritirato]);

  /* ---------------------------------------------------------------
     11. DUE SINCRONIZZAZIONI IN PIÙ, A VUOTO
         Non devono aggiungere una riga. Se ne aggiungessero, ogni volta
         che torna la rete l'archivio crescerebbe di una copia.
     --------------------------------------------------------------- */
  const scritturePrima = db.richieste.filter(r => r.metodo === 'POST' && r.percorso.startsWith('/rest')).length;

  for (const giro of [1, 2]) {
    await page.evaluate(() => sincronizzaSubito());
    await attendiCodaVuota(page, 60_000);
    const adesso = conteggi(db);
    const cresciute = Object.keys(adesso).filter(k => adesso[k] !== dopo[k]);
    if (cresciute.length) {
      throw new Error(
        `\nLa sincronizzazione forzata numero ${giro} ha aggiunto righe:\n` +
        cresciute.map(k => `  ${k}: da ${dopo[k]} a ${adesso[k]}`).join('\n') +
        '\n\n  Quello che è già sul server non ci deve tornare. Una riga in più\n' +
        "  per arrivo, a ogni ritorno della rete, rovina l'archivio in silenzio.\n");
    }
  }

  const scrittureDopo = db.richieste.filter(r => r.metodo === 'POST' && r.percorso.startsWith('/rest')).length;
  confrontaNumero('richieste di scrittura nelle due sincronizzazioni a vuoto',
    0, scrittureDopo - scritturePrima,
    'Non solo non devono aggiungere righe: non devono nemmeno partire.');

  await contesto.close();
});
