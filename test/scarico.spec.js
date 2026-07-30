'use strict';
/*
 * LA GARA CHE ARRIVA DAL SERVER
 *
 * Fin qui il verso era uno solo: da questo dispositivo verso il server. Da
 * adesso la porta Organizzatore mostra anche le gare nate altrove e le sa
 * scaricare. La regola che tiene tutto in piedi è una sola — aprirla la
 * scarica, e da quel momento la spinge questo dispositivo — e tutto il resto
 * di questo file esiste per proteggere i dati mentre quella regola si applica.
 *
 * I DUE DISPOSITIVI SONO VERI. Sono due contesti distinti del browser, con
 * memoria e coda separate, che parlano con lo stesso server finto in Node. È
 * l'unico modo per provare la sequenza che al campo capita davvero: due
 * telefoni che hanno lavorato offline sulla stessa gara.
 */

const { test, expect } = require('@playwright/test');
const { RIFERIMENTO, confrontaNumero, leggiCalcolati } = require('./aiuto');
const { nuovoServer, montaServerFinto, accediNellaApp, attendiCoda, attendiCodaVuota, attendiCodaPiena, codaDi } = require('./finto-server');

/** Un dispositivo: contesto suo, memoria sua, coda sua. */
async function dispositivo(browser, db, opzioni = {}) {
  const contesto = await browser.newContext(opzioni);
  await montaServerFinto(contesto, db);
  const page = await contesto.newPage();
  page.on('dialog', d => d.accept().catch(() => { }));
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof S !== 'undefined' && typeof calcola === 'function' && C !== null);
  await raccogliAvvisi(page);
  return { contesto, page };
}

/* Gli avvisi a un pulsante solo bloccano finché qualcuno non preme. Qui si
   prendono nota e si chiudono da soli, così il test può leggere COSA è stato
   detto invece di limitarsi a constatare che qualcosa non è successo. */
async function raccogliAvvisi(page) {
  await page.evaluate(() => {
    window.__avvisi = [];
    window.__avvisiAuto = true;
    const d = document.querySelector('#dlgConfirm');
    new MutationObserver(() => {
      if (!d.open) return;
      window.__avvisi.push(document.querySelector('#cfTitle').textContent + ' — ' +
        document.querySelector('#cfMsg').textContent);
      if (window.__avvisiAuto) document.querySelector('#cfYes').click();
    }).observe(d, { attributes: true, attributeFilter: ['open'] });
  });
}

/** Per i test che vogliono rispondere loro all'avviso, invece di subirlo. */
const rispondoIo = page => page.evaluate(() => { window.__avvisiAuto = false; });

const avvisi = page => page.evaluate(() => window.__avvisi.slice());

/** Quello che è rimasto in coda, con il motivo se è stato messo da parte. */
const tuttoInCoda = page => page.evaluate(async () => {
  try { return (await leggiCoda()).map(o => ({ tipo: o.tipo, motivo: o.motivo || null })); }
  catch (e) { return []; }
});

/** Aspetta che almeno una riga sia stata messa da parte, e torna quelle. */
async function attendiMotivo(page, timeout = 15_000) {
  const fine = Date.now() + timeout;
  for (;;) {
    const messe = (await tuttoInCoda(page)).filter(o => o.motivo);
    if (messe.length) return messe;
    if (Date.now() > fine) {
      throw new Error('\nIl server ha respinto delle righe ma nessuna risulta messa da parte ' +
        'con il suo motivo.\n');
    }
    await page.waitForTimeout(100);
  }
}

/** Entra nella porta Organizzatore, come farebbe chiunque. */
async function apriPortaOrganizzatore(page) {
  await page.evaluate(() => { tornaAlMenu('organizzatore'); });
  await page.waitForFunction(() => !!document.querySelector('#menuCorpo .card'));
}

/** Quello che si vede nell'elenco: nome e dove sta. */
const righeElenco = page => page.evaluate(() =>
  Array.from(document.querySelectorAll('#elencoGare .garariga')).map(r => ({
    nome: r.querySelector('.gnome').textContent,
    dove: r.dataset.dove,
    etichetta: (r.querySelector('.dove') || {}).textContent || '',
    sotto: r.querySelector('.gsotto').textContent,
  })));

/** Prepara una gara con nome e iscritti, e la manda sul server. */
async function preparaEInvia(page, nome, iscritti) {
  const id = await page.evaluate(async ({ nome, iscritti }) => {
    nuovaGara();
    S.cfg.nome = nome; S.cfg.data = '2026-09-14'; S.cfg.luogo = 'Ovada'; S.cfg.km = 10;
    S.iscritti = iscritti.map((x, n) => ({
      id: nid(), pett: x.pett, cognome: x.cognome, nome: x.nome, sesso: x.sesso,
      societa: x.societa, nascita: x.nascita, conferma: x.conferma,
    }));
    touched();
    await sincronizzaSubito();
    return S.garaId;
  }, { nome, iscritti });
  await attendiCodaVuota(page);
  return id;
}

const iscrittiFinti = n => Array.from({ length: n }, (_, i) => ({
  pett: i + 1, cognome: 'ROSSI', nome: 'N' + i, sesso: i % 2 ? 'F' : 'M',
  societa: 'ATL. PROVA', nascita: '1990-01-01', conferma: 'S',
}));

/* ============================================================
   1. L'elenco dice a colpo d'occhio dove sta ogni gara
   ============================================================ */
test.describe("L'elenco tiene insieme il locale e il server", () => {
  test('distingue le tre condizioni: solo qui, solo sul server, in entrambi', async ({ browser }) => {
    const db = nuovoServer();

    // IL COMPUTER prepara due gare e le manda su.
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const primaId = await preparaEInvia(pc.page, 'Prima', iscrittiFinti(3));
    await preparaEInvia(pc.page, 'Seconda', iscrittiFinti(4));

    // IL TELEFONO ne prepara una sua mentre è senza rete: quella resta qui,
    // in coda, e sul server non c'è. È l'unico modo onesto di avere una gara
    // "solo qui" con un account collegato — appena c'è rete parte da sola.
    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    db.giu = true;
    await tel.page.evaluate(async () => {
      nuovaGara(); S.cfg.nome = 'Fatta sul telefono'; S.cfg.data = '2026-09-15';
      touched();
      await sincronizzaSubito();
    });
    await attendiCodaPiena(tel.page);
    db.giu = false;

    await tel.page.evaluate(() => { riponiGaraAttiva(); scordaGareRemote(); });
    await apriPortaOrganizzatore(tel.page);
    await tel.page.waitForFunction(() => gareRemote !== null);
    await tel.page.evaluate(() => renderMenu());

    const dove = r => Object.fromEntries(r.map(x => [x.nome, x.dove]));
    const etichetta = r => Object.fromEntries(r.map(x => [x.nome, x.etichetta]));

    const prima = await righeElenco(tel.page);
    expect(dove(prima), 'le tre condizioni si distinguono').toEqual({
      'Prima': 'server',
      'Seconda': 'server',
      'Fatta sul telefono': 'qui',
    });
    expect(etichetta(prima)['Prima']).toBe('solo sul server');
    expect(etichetta(prima)['Fatta sul telefono']).toBe('solo qui');

    // Scaricandone una, quella passa alla terza condizione.
    await tel.page.evaluate(gara => scaricaGara(gara), primaId);
    await apriPortaOrganizzatore(tel.page);
    await tel.page.evaluate(() => renderMenu());

    const dopo = await righeElenco(tel.page);
    expect(dove(dopo), 'quella scaricata sta adesso in tutti e due i posti').toEqual({
      'Prima': 'entrambi',
      'Seconda': 'server',
      'Fatta sul telefono': 'qui',
    });
    expect(etichetta(dopo)['Prima']).toBe('qui e sul server');

    await pc.contesto.close(); await tel.contesto.close();
  });

  /* Il caso "eliminando una gara che sta anche sul server, lo dice prima"
     stava qui. Adesso quella domanda non è più un avviso da leggere ma una
     scelta fra tre strade, e la prova sta in
     "dal menu si sceglie fra togliere solo di qui e togliere ovunque". */

  test('le gare di un altro account non compaiono', async ({ browser }) => {
    const db = nuovoServer();
    const A = await dispositivo(browser, db);
    await accediNellaApp(A.page, 'primo@esempio.it');
    await preparaEInvia(A.page, 'Del primo', iscrittiFinti(2));

    const B = await dispositivo(browser, db);
    await accediNellaApp(B.page, 'secondo@esempio.it');
    await apriPortaOrganizzatore(B.page);
    await B.page.waitForFunction(() => gareRemote !== null);
    await B.page.evaluate(() => renderMenu());

    expect(await B.page.evaluate(() => gareRemote.length),
      "il secondo account non vede le gare del primo").toBe(0);
    await A.contesto.close(); await B.contesto.close();
  });
});

/* ============================================================
   2. La sequenza vera: preparo sul computer, apro dal telefono
   ============================================================ */
test.describe('La sequenza vera', () => {
  test('preparo i 280 iscritti sul computer, apro dal telefono, registro gli arrivi, ritrovo tutto', async ({ browser }) => {
    test.setTimeout(180_000);
    const db = nuovoServer();

    // --- IL COMPUTER, la sera prima
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const garaId = await preparaEInvia(pc.page, '7ª Stradolcetto', RIFERIMENTO.iscritti);
    confrontaNumero('iscritti finiti sul server', RIFERIMENTO.iscritti.length,
      db.tabelle.iscritti.length);

    // --- IL TELEFONO, la mattina al campo
    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    await apriPortaOrganizzatore(tel.page);
    await tel.page.waitForFunction(() => gareRemote !== null);
    await tel.page.evaluate(() => renderMenu());

    const prima = await righeElenco(tel.page);
    expect(prima.length, 'il telefono vede la gara preparata sul computer').toBe(1);
    expect(prima[0].dove).toBe('server');
    expect(prima[0].sotto, "e sa già quanti iscritti ha").toContain('280 iscritti');

    // Si apre, e aprirla la scarica.
    await tel.page.click('#elencoGare .garariga');
    await tel.page.waitForFunction(id => S.garaId === id && ui.schermata === 'app', garaId,
      { timeout: 60_000 });

    const scaricata = await tel.page.evaluate(() => ({
      nome: S.cfg.nome, luogo: S.cfg.luogo, km: S.cfg.km,
      iscritti: S.iscritti.length,
      conNascita: S.iscritti.filter(i => i.nascita).length,
      fasce: S.matrice.length,
      arrivi: S.arrivi.length,
    }));
    confrontaNumero('iscritti scaricati sul telefono', RIFERIMENTO.iscritti.length, scaricata.iscritti);
    confrontaNumero('con la data di nascita', RIFERIMENTO.iscritti.length, scaricata.conNascita);
    expect(scaricata.nome).toBe('7ª Stradolcetto');
    expect(scaricata.luogo).toBe('Ovada');
    expect(Number(scaricata.km)).toBe(10);
    expect(scaricata.fasce, 'anche le fasce sono arrivate').toBeGreaterThan(0);

    // --- IL TRAGUARDO. Si cronometra dal telefono, come sempre.
    const arrivi = RIFERIMENTO.arrivi.slice(0, 12);
    await tel.page.evaluate(async lista => {
      S.start = Date.now() - 3600_000;
      touched();
      for (const a of lista) {
        const id = nid();
        S.arrivi.push({ id, pett: a.pett, ms: a.ms, corr: 0 });
      }
      S.stop = Date.now();
      touched();
      await sincronizzaSubito();
    }, arrivi);
    await attendiCodaVuota(tel.page);

    // --- RITROVO TUTTO. Sul telefono, dopo aver chiuso e riaperto.
    await tel.page.reload();
    await tel.page.waitForFunction(() => typeof S !== 'undefined' && C !== null);
    const dopoRiapertura = await tel.page.evaluate(() => ({
      nome: S.cfg.nome, iscritti: S.iscritti.length, arrivi: S.arrivi.length,
      classificati: C.ris.filter(r => r.pos).length,
    }));
    confrontaNumero('iscritti dopo la riapertura', 280, dopoRiapertura.iscritti);
    confrontaNumero('arrivi dopo la riapertura', arrivi.length, dopoRiapertura.arrivi);
    confrontaNumero('classificati', arrivi.length, dopoRiapertura.classificati);

    // --- E sul server, che è quello che vede il computer.
    confrontaNumero('arrivi finiti sul server', arrivi.length, db.tabelle.arrivi.length);
    const pettSulServer = new Set(db.tabelle.arrivi_correzioni.map(c => c.pett));
    for (const a of arrivi) {
      expect(pettSulServer.has(a.pett),
        `il pettorale ${a.pett} registrato dal telefono deve essere sul server`).toBe(true);
    }

    await pc.contesto.close(); await tel.contesto.close();
  });

  test('un giro completo su e giù non cambia un solo numero della gara vera', async ({ browser }) => {
    test.setTimeout(240_000);
    const db = nuovoServer();

    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    // La gara vera per intero: iscritti, arrivi, ritiri, tutto.
    const atteso = await pc.page.evaluate(async ({ anno, iscritti, arrivi }) => {
      nuovaGara();
      S.cfg.anno = anno; S.cfg.data = anno + '-09-14';
      S.cfg.nome = 'Gara di riferimento'; S.cfg.km = 10;
      S.iscritti = iscritti.map(x => ({
        id: nid(), pett: x.pett, cognome: x.cognome, nome: x.nome, sesso: x.sesso,
        societa: x.societa, nascita: x.nascita, conferma: x.conferma,
      }));
      const base = Date.now() - 6 * 3600 * 1000;
      S.start = base;
      S.arrivi = arrivi.map(a => ({ id: nid(), pett: a.pett, ms: a.ms, corr: 0 }));
      S.stop = base + Math.max(...arrivi.map(a => a.ms)) + 60_000;
      ricalcola();
      S.dnf = C.stati.filter(s => s.stato === 'Atteso').map(s => s.pett);
      touched();
      await sincronizzaSubito();
      return { id: S.garaId, dnf: S.dnf.length };
    }, { anno: RIFERIMENTO._annoRiferimento, iscritti: RIFERIMENTO.iscritti, arrivi: RIFERIMENTO.arrivi });
    // 834 operazioni: la gara vera per intero, una richiesta per riga.
    await attendiCodaVuota(pc.page, 180_000);

    const primaDelGiro = await leggiCalcolati(pc.page);

    // Sul telefono: si scarica e si ricalcola tutto da capo.
    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    const esito = await tel.page.evaluate(async id => {
      await caricaGareRemote();
      return scaricaGara(id);
    }, atteso.id);
    expect(esito.ok, 'lo scarico deve riuscire').toBe(true);
    await tel.page.evaluate(() => ricalcola());

    const dopoIlGiro = await leggiCalcolati(tel.page);

    confrontaNumero('iscritti dopo il giro', primaDelGiro.iscritti.length, dopoIlGiro.iscritti.length);
    confrontaNumero('arrivi dopo il giro', primaDelGiro.ris.length, dopoIlGiro.ris.length);
    confrontaNumero('ritiri dopo il giro', atteso.dnf, esito.dnf);

    const perPett = lista => new Map(lista.map(r => [String(r.pett), r]));
    const dopoIsc = perPett(dopoIlGiro.iscritti);
    const dopoRis = perPett(dopoIlGiro.ris);

    const { confronta } = require('./aiuto');
    confronta('categoria FIDAL dopo un giro su e giù', primaDelGiro.iscritti.map(i => ({
      pett: i.pett, atteso: i.catFidal, ottenuto: (dopoIsc.get(String(i.pett)) || {}).catFidal,
    })));
    confronta('fascia di gara dopo un giro su e giù', primaDelGiro.iscritti.map(i => ({
      pett: i.pett, atteso: i.catGara, ottenuto: (dopoIsc.get(String(i.pett)) || {}).catGara,
    })));
    confronta('posizione assoluta dopo un giro su e giù', primaDelGiro.ris.map(r => ({
      pett: r.pett, atteso: r.pos, ottenuto: (dopoRis.get(String(r.pett)) || {}).pos,
    })));
    confronta('tempo dopo un giro su e giù', primaDelGiro.ris.map(r => ({
      pett: r.pett, atteso: r.tempo, ottenuto: (dopoRis.get(String(r.pett)) || {}).tempo,
    })));
    confronta('etichetta di premiazione dopo un giro su e giù', primaDelGiro.ris.map(r => ({
      pett: r.pett, atteso: r.etichetta, ottenuto: (dopoRis.get(String(r.pett)) || {}).etichetta,
    })));
    /* IL CSV PER WISE.
       Le righe dei classificati devono stare nella stessa sequenza, perché
       quella è la classifica. Le righe DNS e DNF invece seguono l'ordine
       degli iscritti, che sul server non esiste: le posizioni del foglio da
       cui erano stati importati non viaggiano. Scaricando, la app li rimette
       in ordine di pettorale — quindi lì si confronta l'insieme, non la
       sequenza. Nessun valore cambia, e non è un dettaglio lasciato correre:
       è scritto qui perché si veda. */
    const soloTempi = c => c.filter(r => r[2] === 'TIME');
    expect(soloTempi(dopoIlGiro.csv), 'la parte a tempo del CSV è identica, riga per riga')
      .toEqual(soloTempi(primaDelGiro.csv));
    const ordinato = c => c.map(r => r.join('|')).sort();
    expect(ordinato(dopoIlGiro.csv), 'e nel CSV non manca né avanza una riga')
      .toEqual(ordinato(primaDelGiro.csv));

    await pc.contesto.close(); await tel.contesto.close();
  });
});

/* ============================================================
   1b. Cancellare una gara dal server, per sempre
   ============================================================ */
test.describe('Eliminare una gara anche dal server', () => {
  test('sparisce tutto: gara, iscritti, arrivi, correzioni, ritiri', async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'Da buttare', iscrittiFinti(6));
    await pc.page.evaluate(async () => {
      S.start = Date.now() - 600_000;
      for (let i = 0; i < 4; i++) S.arrivi.push({ id: nid(), pett: i + 1, ms: 60_000 + i * 1000, corr: 0 });
      S.dnf = [5];
      S.stop = Date.now(); touched();
      await sincronizzaSubito();
    });
    await attendiCodaVuota(pc.page);

    const prima = Object.fromEntries(Object.entries(db.tabelle).map(([k, v]) => [k, v.length]));
    expect(prima.arrivi, 'la gara è sul server con i suoi arrivi').toBe(4);

    const esito = await pc.page.evaluate(gara => eliminaGaraSulServer(gara), id);
    expect(esito.ok).toBe(true);
    expect(esito.cera, 'e il server dice di averla trovata e tolta').toBe(true);

    const dopo = Object.fromEntries(Object.entries(db.tabelle).map(([k, v]) => [k, v.length]));
    const rimasti = Object.entries(dopo).filter(([, n]) => n > 0);
    if (rimasti.length) {
      throw new Error('\nDopo aver cancellato la gara sul server è rimasto qualcosa:\n' +
        rimasti.map(([t, n]) => `  ${t}: ${n} righe`).join('\n') +
        "\n\n  Basta togliere la riga della gara: il resto se ne va per cascata.\n" +
        '  Se resta, la cascata non sta funzionando.\n');
    }

    await pc.contesto.close();
  });

  test('non risorge dalla coda: quello che era in attesa non la ricrea', async ({ browser }) => {
    /* Il modo in cui una cancellazione si annulla da sola. La gara viene
       tolta dal server, ma nella coda di uscita è rimasta qualche operazione
       sua: al primo invio il server se la ritrova davanti, identica, un
       attimo dopo averla cancellata. */
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'Da buttare', iscrittiFinti(5));

    // roba non ancora partita, come capita staccando la rete un momento
    db.giu = true;
    await pc.page.evaluate(async () => {
      S.start = Date.now() - 60_000;
      S.arrivi.push({ id: nid(), pett: 2, ms: 3210, corr: 0 });
      S.stop = Date.now(); touched();
      await sincronizzaSubito();
    });
    await attendiCodaPiena(pc.page);
    db.giu = false;

    // come fa la app: prima di là, poi di qui
    const esito = await pc.page.evaluate(async gara => {
      const r = await eliminaGaraSulServer(gara);
      if (r.ok) eliminaGara(gara);
      return r;
    }, id);
    expect(esito.ok).toBe(true);

    // e adesso si insiste: due giri di sincronia, come farebbe la app da sola
    await pc.page.evaluate(async () => { await sincronizzaSubito(); await inviaCoda(); });
    await attendiCodaVuota(pc.page, 20_000);

    const risorte = db.tabelle.gare.length + db.tabelle.arrivi.length + db.tabelle.iscritti.length;
    if (risorte) {
      throw new Error(
        `\nLa gara è tornata sul server dopo essere stata cancellata: ` +
        `${db.tabelle.gare.length} gare, ${db.tabelle.iscritti.length} iscritti, ` +
        `${db.tabelle.arrivi.length} arrivi.\n\n` +
        '  Le operazioni rimaste in coda l\'hanno ricreata. Vanno tolte insieme\n' +
        '  alla gara, e mentre si cancella la sincronia deve stare ferma.\n');
    }

    await pc.contesto.close();
  });

  test('una gara vuota non arriva mai sul server', async ({ browser }) => {
    /* Eliminando la gara aperta ne resta in mano una nuova e vuota. Se la
       sincronia le crea comunque la riga, l'elenco si riempie di gare senza
       nome e senza niente, che uno si ritrova lì e non sa da dove vengano.
       Sul server vero erano quattro su cinque. */
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'La prima', iscrittiFinti(3));

    await pc.page.evaluate(async gara => {
      const r = await eliminaGaraSulServer(gara);
      if (r.ok) eliminaGara(gara);          // in mano resta una gara nuova e vuota
      await sincronizzaSubito();
      await inviaCoda();
    }, id);
    await attendiCodaVuota(pc.page, 20_000);

    confrontaNumero('gare sul server dopo aver eliminato tutto', 0, db.tabelle.gare.length,
      'Una gara senza nome, senza iscritti, senza arrivi e senza partenza non ha niente da mandare.');

    // ma appena le si dà un nome, quella sì che parte
    await pc.page.evaluate(async () => {
      S.cfg.nome = 'La seconda'; touched();
      await sincronizzaSubito();
    });
    await attendiCodaVuota(pc.page, 20_000);
    confrontaNumero('e appena ha un nome parte', 1, db.tabelle.gare.length);
    expect(db.tabelle.gare[0].nome).toBe('La seconda');

    await pc.contesto.close();
  });

  test('senza rete non cancella niente, e lo dice', async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'Da buttare', iscrittiFinti(3));

    db.giu = true;
    const esito = await pc.page.evaluate(gara => eliminaGaraSulServer(gara), id);
    expect(esito.ok, 'senza rete non si cancella').toBe(false);
    expect(esito.motivo).toBe('rete');
    db.giu = false;
    confrontaNumero('la gara è ancora tutta sul server', 1, db.tabelle.gare.length);
    confrontaNumero('con i suoi iscritti', 3, db.tabelle.iscritti.length);

    await pc.contesto.close();
  });

  test("la gara di un altro account non si tocca", async ({ browser }) => {
    const db = nuovoServer();
    const A = await dispositivo(browser, db);
    await accediNellaApp(A.page, 'primo@esempio.it');
    const id = await preparaEInvia(A.page, 'Del primo', iscrittiFinti(4));

    const B = await dispositivo(browser, db);
    await accediNellaApp(B.page, 'secondo@esempio.it');
    const esito = await B.page.evaluate(gara => eliminaGaraSulServer(gara), id);

    expect(esito.ok, 'la chiamata riesce, ma non trova niente da cancellare').toBe(true);
    expect(esito.cera, "e lo dice: non c'era nessuna gara sua da togliere").toBe(false);
    confrontaNumero('la gara del primo è intatta', 1, db.tabelle.gare.length);
    confrontaNumero('e i suoi iscritti pure', 4, db.tabelle.iscritti.length);

    await A.contesto.close(); await B.contesto.close();
  });

  test('dal menu si sceglie fra togliere solo di qui e togliere ovunque', async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'In due posti', iscrittiFinti(4));
    await apriPortaOrganizzatore(pc.page);
    await pc.page.waitForFunction(() => gareRemote !== null);
    await pc.page.evaluate(() => renderMenu());

    // la riga risulta in entrambi i posti, e ha il cestino
    const riga = await pc.page.evaluate(() => {
      const r = document.querySelector('#elencoGare .garariga');
      return { dove: r.dataset.dove, cestino: !!r.querySelector('[data-elimina]') };
    });
    expect(riga.dove).toBe('entrambi');
    expect(riga.cestino, 'il cestino c\'è').toBe(true);

    await rispondoIo(pc.page);
    await pc.page.click('#elencoGare .garariga [data-elimina]');
    await pc.page.waitForSelector('#dlgScelte[open]');

    const scelte = await pc.page.evaluate(() => ({
      testo: document.querySelector('#dlgScelte').textContent,
      tasti: Array.from(document.querySelectorAll('#scPiede button')).map(b => b.dataset.scelta),
    }));
    expect(scelte.tasti, 'tre strade, e la prima non fa danni')
      .toEqual(['annulla', 'qui', 'tutto']);
    expect(scelte.testo, 'e spiega la differenza').toContain('solo di qui la lascia sul server');

    // si sceglie "anche dal server", poi si scrive la parola
    await pc.page.click('#scPiede button[data-scelta="tutto"]');
    await pc.page.waitForSelector('#dlgConfirm[open]');
    await pc.page.fill('#cfMsg input', 'ELIMINA');
    await pc.page.click('#cfYes');

    await pc.page.waitForFunction(() => document.querySelectorAll('#elencoGare .garariga').length === 0,
      null, { timeout: 15_000 });
    confrontaNumero('sul server non è rimasta nessuna gara', 0, db.tabelle.gare.length);
    confrontaNumero('e nemmeno un iscritto', 0, db.tabelle.iscritti.length);
    confrontaNumero('e in locale è sparita', 0,
      await pc.page.evaluate(() => elencoGareTutte().length));

    await pc.contesto.close();
  });
});

/* ============================================================
   2b. I due conti che il giro giù deve rifare all'incontrario
   ============================================================ */
test.describe('Scendendo, i tempi tornano quelli giusti', () => {
  test('una partenza spostata non sposta i tempi di chi scarica', async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);

    const prima = await pc.page.evaluate(async () => {
      nuovaGara(); S.cfg.nome = 'Partenza spostata';
      S.start = Date.now() - 100_000;
      S.arrivi = [10_000, 20_000, 30_000].map((ms, i) => ({ id: nid(), pett: i + 1, ms, corr: 0 }));
      // lo sparo era 60 secondi prima di come l'avevo segnato
      stNew = S.start - 60_000; applicaStart();
      S.stop = Date.now(); touched();
      await sincronizzaSubito();
      return { locali: S.arrivi.map(a => a.ms), scarto: S.scartoPartenza, id: S.garaId };
    });
    await attendiCodaVuota(pc.page);
    expect(prima.locali, 'in locale i tempi si sono traslati').toEqual([70_000, 80_000, 90_000]);
    expect(prima.scarto).toBe(-60_000);
    expect(db.tabelle.arrivi.map(a => a.ms).sort((a, b) => a - b),
      'ma sul server restano i grezzi, misurati dalla partenza originale')
      .toEqual([10_000, 20_000, 30_000]);

    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    await tel.page.evaluate(async gara => { await caricaGareRemote(); await scaricaGara(gara); }, prima.id);

    const dopo = await tel.page.evaluate(() => ({
      tempi: S.arrivi.map(a => a.ms).sort((a, b) => a - b),
      scarto: S.scartoPartenza,
    }));
    expect(dopo.scarto, 'lo scarto scende insieme alla gara').toBe(-60_000);
    expect(dopo.tempi, 'e i tempi tornano quelli che si leggevano sul computer')
      .toEqual(prima.locali);

    await pc.contesto.close(); await tel.contesto.close();
  });

  test('gli arrivi di una sessione azzerata non ritornano indietro', async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);

    const id = await pc.page.evaluate(async () => {
      nuovaGara(); S.cfg.nome = 'Falsa partenza';
      S.start = Date.now() - 100_000;
      S.arrivi = [1000, 2000, 3000, 4000].map((ms, i) => ({ id: nid(), pett: i + 1, ms, corr: 0 }));
      touched();
      await sincronizzaSubito();
      // falsa partenza: si azzera e si ricomincia
      S.sessione = (S.sessione || 1) + 1;
      S.arrivi = []; S.scartoPartenza = 0;
      S.start = Date.now() - 50_000;
      S.arrivi = [5000, 6000].map((ms, i) => ({ id: nid(), pett: 20 + i, ms, corr: 0 }));
      S.stop = Date.now(); touched();
      await sincronizzaSubito();
      return S.garaId;
    });
    await attendiCodaVuota(pc.page);
    confrontaNumero('sul server restano le righe di tutte e due le sessioni',
      6, db.tabelle.arrivi.length,
      'Azzerare non cancella niente sul server: incrementa la sessione.');

    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    const esito = await tel.page.evaluate(async gara => {
      await caricaGareRemote(); return scaricaGara(gara);
    }, id);

    confrontaNumero('ma a scendere sono solo quelli della sessione buona', 2, esito.arrivi,
      'Le righe della falsa partenza restano come traccia, non tornano in gara.');
    expect(await tel.page.evaluate(() => S.arrivi.map(a => a.pett).sort((a, b) => a - b)))
      .toEqual([20, 21]);

    await pc.contesto.close(); await tel.contesto.close();
  });
});

/* ============================================================
   3. O arriva tutta o non arriva niente
   ============================================================ */
test.describe("Lo scarico è tutto o niente", () => {
  test('se un pezzo non arriva, in locale non viene scritto niente', async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'Gara a metà', iscrittiFinti(40));

    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);

    // Gli iscritti non arriveranno: è il pezzo grosso, quello che fa la
    // differenza fra una gara e una gara finta.
    db.rompi = 'iscritti';
    const esito = await tel.page.evaluate(async gara => {
      await caricaGareRemote();
      return scaricaGara(gara);
    }, id);

    expect(esito.ok, 'lo scarico deve fallire').toBe(false);
    expect(esito.motivo).toBe('incompleta');
    expect((await avvisi(tel.page)).join(' '), 'e lo deve dire, non fallire in silenzio')
      .toContain('Non è stato scritto niente');

    const rimasto = await tel.page.evaluate(gara => ({
      inElenco: elencoGareTutte().some(g => g.id === gara),
      inMemoria: !!localStorage.getItem('cronostrada.gara.' + gara),
      attiva: S.garaId === gara,
      iscritti: S.iscritti.length,
    }), id);

    if (rimasto.inElenco || rimasto.inMemoria || rimasto.attiva) {
      throw new Error(
        '\nLo scarico si è interrotto ma qualcosa è stato scritto lo stesso:\n' +
        `  nell'elenco: ${rimasto.inElenco}\n  in memoria: ${rimasto.inMemoria}\n` +
        `  aperta: ${rimasto.attiva}\n\n` +
        '  Una gara scaricata a metà è peggio di una gara assente, perché\n' +
        '  sembra completa. O arriva tutta o non arriva niente.\n');
    }

    // E riprovando quando il server risponde, arriva per intero.
    db.rompi = null;
    const secondo = await tel.page.evaluate(gara => scaricaGara(gara), id);
    expect(secondo.ok).toBe(true);
    confrontaNumero('iscritti al secondo tentativo', 40, secondo.iscritti);

    await pc.contesto.close(); await tel.contesto.close();
  });

  test('una risposta troncata non passa per una gara intera', async ({ browser }) => {
    const db = nuovoServer({ massimoRighe: 25 });   // il server tronca, come PostgREST
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'Gara lunga', iscrittiFinti(120));

    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    const esito = await tel.page.evaluate(async gara => {
      await caricaGareRemote();
      return scaricaGara(gara);
    }, id);

    expect(esito.ok, 'a pagine deve arrivare lo stesso').toBe(true);
    confrontaNumero('iscritti scaricati a pagine di 25', 120, esito.iscritti,
      'La app deve chiedere le pagine successive invece di fermarsi alla prima.');

    await pc.contesto.close(); await tel.contesto.close();
  });
});

/* ============================================================
   4. Non si sovrascrive mai roba non ancora inviata
   ============================================================ */
test.describe('Quello che è solo qui non si perde in silenzio', () => {
  test('con la coda piena si ferma e dice quante e di che tipo', async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'Gara condivisa', iscrittiFinti(5));

    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    await tel.page.evaluate(async gara => {
      await caricaGareRemote();
      await scaricaGara(gara);
    }, id);

    // Il telefono lavora senza rete: tre arrivi che esistono solo qui.
    db.giu = true;
    await tel.page.evaluate(async () => {
      S.start = Date.now() - 60_000; touched();
      for (let i = 0; i < 3; i++) S.arrivi.push({ id: nid(), pett: i + 1, ms: 1000 * (i + 1), corr: 0 });
      S.stop = Date.now(); touched();
      await sincronizzaSubito();
    });
    await attendiCodaPiena(tel.page);
    db.giu = false;

    // Adesso si prova a riscaricare la stessa gara dal server.
    const domanda = tel.page.evaluate(gara => scaricaGara(gara), id);
    await tel.page.waitForSelector('#dlgScelte[open]');

    const testo = await tel.page.evaluate(() => document.querySelector('#dlgScelte').textContent);
    expect(testo, 'deve dire quante sono').toMatch(/\b[3-9]\d* operazioni\b|\b1 operazione\b/);
    expect(testo, 'e di che tipo').toContain('arrivi');
    expect(testo, "e che nel dubbio vince il telefono").toContain("vince quello che hai qui");

    // La prima scelta è quella che non fa danni.
    const scelte = await tel.page.evaluate(() =>
      Array.from(document.querySelectorAll('#scPiede button')).map(b =>
        ({ k: b.dataset.scelta, testo: b.textContent })));
    expect(scelte.map(s => s.k), 'la strada di default deve essere quella che tiene i dati')
      .toEqual(['tieni', 'invia', 'scarta']);
    // I pulsanti si leggono: il conteggio va dentro la frase, non appiccicato
    // davanti. "Scarta 15 le 15 operazioni" era quello che si leggeva prima.
    expect(scelte[2].testo, "l'etichetta del pulsante rosso deve essere una frase italiana")
      .toMatch(/^Scarta le \d+ operazioni$/);

    await tel.page.click('#scPiede button[data-scelta="tieni"]');
    const esito = await domanda;
    expect(esito.ok).toBe(false);
    expect(esito.motivo).toBe('coda');

    const dopo = await tel.page.evaluate(() => ({ arrivi: S.arrivi.length }));
    confrontaNumero('gli arrivi registrati qui sono ancora tutti', 3, dopo.arrivi);

    await pc.contesto.close(); await tel.contesto.close();
  });

  test('su uno schermo da telefono le tre strade ci stanno tutte', async ({ browser }) => {
    /* Trovato guardando uno scatto, non con un test: in fila su 390 punti i
       tre pulsanti non ci stavano, e quello che usciva a sinistra era il
       primo — cioè l'unico che non fa danni. Una scelta che non si vede è
       una scelta che non c'è. */
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'Gara condivisa', iscrittiFinti(5));

    const tel = await dispositivo(browser, db, { viewport: { width: 390, height: 844 } });
    await accediNellaApp(tel.page);
    await tel.page.evaluate(async gara => { await caricaGareRemote(); await scaricaGara(gara); }, id);

    db.giu = true;
    await tel.page.evaluate(async () => {
      S.start = Date.now() - 60_000; touched();
      S.arrivi.push({ id: nid(), pett: 3, ms: 9999, corr: 0 });
      S.stop = Date.now(); touched();
      await sincronizzaSubito();
    });
    await attendiCodaPiena(tel.page);
    db.giu = false;

    const domanda = tel.page.evaluate(gara => scaricaGara(gara), id);
    await tel.page.waitForSelector('#dlgScelte[open]');

    const fuori = [];
    for (const k of ['tieni', 'invia', 'scarta']) {
      const b = tel.page.locator(`#scPiede button[data-scelta="${k}"]`);
      const r = await b.boundingBox();
      if (!r) { fuori.push(`${k}: non è nemmeno disegnato`); continue; }
      if (r.x < 0 || r.x + r.width > 390) {
        fuori.push(`${k}: da ${Math.round(r.x)} a ${Math.round(r.x + r.width)}, ` +
          'lo schermo arriva a 390');
      }
      if (r.height < 44) fuori.push(`${k}: alto ${Math.round(r.height)}px, troppo poco per un dito`);
    }
    if (fuori.length) {
      throw new Error('\nNel dialogo delle scelte, su uno schermo da telefono:\n' +
        fuori.map(x => '  ' + x).join('\n') +
        '\n\n  Una strada che non si vede è una strada che non c\'è, e quella che\n' +
        '  esce dallo schermo è la prima: quella che non fa danni.\n');
    }

    await tel.page.click('#scPiede button[data-scelta="tieni"]');
    await domanda;
    await pc.contesto.close(); await tel.contesto.close();
  });

  test('scegliendo "invia prima" la coda parte e poi la gara si scarica', async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'Gara condivisa', iscrittiFinti(5));

    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    await tel.page.evaluate(async gara => { await caricaGareRemote(); await scaricaGara(gara); }, id);

    db.giu = true;
    await tel.page.evaluate(async () => {
      S.start = Date.now() - 60_000; touched();
      S.arrivi.push({ id: nid(), pett: 2, ms: 4321, corr: 0 });
      S.stop = Date.now(); touched();
      await sincronizzaSubito();
    });
    await attendiCodaPiena(tel.page);
    db.giu = false;

    const domanda = tel.page.evaluate(gara => scaricaGara(gara), id);
    await tel.page.waitForSelector('#dlgScelte[open]');
    await tel.page.click('#scPiede button[data-scelta="invia"]');
    const esito = await domanda;

    expect(esito.ok, "dopo aver inviato, la gara si scarica").toBe(true);
    confrontaNumero("l'arrivo registrato qui è arrivato sul server", 1, db.tabelle.arrivi.length);
    confrontaNumero('e torna giù con la gara', 1, esito.arrivi);

    await pc.contesto.close(); await tel.contesto.close();
  });
});

/* ============================================================
   5. Una gara in corso non si tocca
   ============================================================ */
test.describe('Una gara in corso non si scarica e non si sovrascrive', () => {
  test('col cronometro che cammina lo scarico si rifiuta', async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'Gara del server', iscrittiFinti(4));

    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    await tel.page.evaluate(async () => {
      nuovaGara(); S.cfg.nome = 'Quella che sto cronometrando';
      S.start = Date.now() - 30_000; S.stop = null;    // in corso
      touched();
    });

    const esito = await tel.page.evaluate(async gara => {
      await caricaGareRemote();
      return scaricaGara(gara);
    }, id);

    expect(esito.ok).toBe(false);
    expect(esito.motivo).toBe('in-corso');
    expect((await avvisi(tel.page)).join(' '), 'e spiega perché')
      .toContain('gara in corso su questo dispositivo');
    const stato = await tel.page.evaluate(() => ({ nome: S.cfg.nome, inCorso: !!S.start && !S.stop }));
    expect(stato.nome, 'la gara in corso è ancora quella aperta').toBe('Quella che sto cronometrando');
    expect(stato.inCorso, 'e sta ancora andando').toBe(true);

    await pc.contesto.close(); await tel.contesto.close();
  });

  test('la copia locale in corso non viene sovrascritta da quella del server', async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'La stessa gara', iscrittiFinti(4));

    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    await tel.page.evaluate(async gara => { await caricaGareRemote(); await scaricaGara(gara); }, id);

    // Il telefono la fa partire e registra due arrivi, poi torna al menu.
    await tel.page.evaluate(() => {
      S.start = Date.now() - 10_000; S.stop = null;
      S.arrivi.push({ id: nid(), pett: 1, ms: 3000, corr: 0 });
      S.arrivi.push({ id: nid(), pett: 2, ms: 5000, corr: 0 });
      touched();
      riponiGaraAttiva();
      S = VUOTO(); save();       // come se avesse aperto un'altra gara
    });

    const esito = await tel.page.evaluate(gara => scaricaGara(gara), id);

    expect(esito.ok).toBe(false);
    expect(esito.motivo).toBe('in-corso');
    expect((await avvisi(tel.page)).join(' '), 'e dice che è la copia locale a essere in corso')
      .toContain('copia che hai qui');
    const salvata = await tel.page.evaluate(gara =>
      JSON.parse(localStorage.getItem('cronostrada.gara.' + gara)), id);
    confrontaNumero('gli arrivi della copia in corso sono ancora lì', 2, salvata.arrivi.length);

    await pc.contesto.close(); await tel.contesto.close();
  });
});

/* ============================================================
   6. Senza rete
   ============================================================ */
test.describe("Senza rete l'elenco locale funziona identico", () => {
  test('il server non compare e non appare nessun errore', async ({ browser }) => {
    const db = nuovoServer();
    const A = await dispositivo(browser, db);
    await accediNellaApp(A.page);
    await preparaEInvia(A.page, 'Sul server', iscrittiFinti(3));
    await A.page.evaluate(() => { nuovaGara(); S.cfg.nome = 'Solo qui'; touched(); riponiGaraAttiva(); });

    db.giu = true;                                  // rete staccata
    await A.page.evaluate(() => scordaGareRemote());
    await apriPortaOrganizzatore(A.page);
    await A.page.waitForTimeout(400);               // il tempo di provarci e fallire
    await A.page.evaluate(() => renderMenu());

    const righe = await righeElenco(A.page);
    expect(righe.map(r => r.nome).sort(), "l'elenco locale è quello di sempre")
      .toEqual(['Solo qui', 'Sul server'].sort());
    expect(righe.every(r => r.dove === 'qui'), 'nessuna risulta sul server').toBe(true);

    const testo = await A.page.evaluate(() => document.querySelector('#menuCorpo').textContent);
    for (const parola of ['rrore', 'allit', 'Impossibile', 'non riuscit']) {
      expect(testo.toLowerCase(), `la parola "${parola}" non deve comparire`)
        .not.toContain(parola.toLowerCase());
    }
    expect(await A.page.evaluate(() => !!document.querySelector('.banner.bad')),
      'nessun riquadro rosso').toBe(false);

    await A.contesto.close();
  });
});

/* ============================================================
   7. La sequenza cattiva: due dispositivi che hanno lavorato offline
   ============================================================ */
test.describe('Due dispositivi che hanno lavorato offline sulla stessa gara', () => {
  test('nessuno dei due perde qualcosa senza dirlo', async ({ browser }) => {
    test.setTimeout(90_000);
    const db = nuovoServer();

    // Partono dalla stessa gara: il computer la prepara, il telefono la scarica.
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'Stradolcetto', iscrittiFinti(20));

    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    await tel.page.evaluate(async gara => { await caricaGareRemote(); await scaricaGara(gara); }, id);

    // --- LA RETE CADE PER TUTTI E DUE, E TUTTI E DUE LAVORANO
    db.giu = true;
    const registra = (page, petti) => page.evaluate(async lista => {
      if (!S.start) { S.start = Date.now() - 600_000; }
      S.stop = null;
      for (const [i, p] of lista.entries()) {
        S.arrivi.push({ id: nid(), pett: p, ms: 60_000 + i * 1000, corr: 0 });
      }
      S.stop = Date.now(); touched();
      await sincronizzaSubito();
      return S.arrivi.length;
    }, petti);

    const suPc = await registra(pc.page, [1, 2, 3]);
    const suTel = await registra(tel.page, [11, 12]);
    confrontaNumero('arrivi sul computer', 3, suPc);
    confrontaNumero('arrivi sul telefono', 2, suTel);

    // Ognuno ha in coda i suoi, e nessuno dei due vede quelli dell'altro:
    // è la conseguenza voluta del non fondere niente in tempo reale.
    const inCoda = page => page.evaluate(async () => (await leggiCoda()).length);
    expect(await inCoda(pc.page), 'il computer ha roba in coda').toBeGreaterThan(0);
    expect(await inCoda(tel.page), 'il telefono ha roba in coda').toBeGreaterThan(0);

    // --- TORNA LA RETE
    db.giu = false;
    await pc.page.evaluate(() => inviaCoda());
    await tel.page.evaluate(() => inviaCoda());
    await attendiCodaVuota(pc.page);
    await attendiCodaVuota(tel.page);

    // SUL SERVER CI SONO TUTTI E CINQUE. Gli arrivi nascono con un
    // identificativo generato dal dispositivo: due telefoni che premono
    // insieme non si sovrascrivono, si sommano.
    confrontaNumero('arrivi arrivati sul server dai due dispositivi insieme',
      5, db.tabelle.arrivi.length,
      'Nessuno dei due deve aver cancellato il lavoro dell\'altro.');
    const pettSulServer = db.tabelle.arrivi_correzioni.map(c => c.pett).sort((a, b) => a - b);
    expect(pettSulServer, 'ci sono i pettorali di entrambi').toEqual([1, 2, 3, 11, 12]);

    // MA IN LOCALE OGNUNO HA ANCORA SOLO I SUOI, e questo è dichiarato: la
    // regola è "aprire scarica", non "fondere in continuazione".
    confrontaNumero('in locale il computer ha ancora i suoi tre', 3,
      await pc.page.evaluate(() => S.arrivi.length));
    confrontaNumero('in locale il telefono ha ancora i suoi due', 2,
      await tel.page.evaluate(() => S.arrivi.length));

    // Il telefono riscarica: adesso ha l'unione, e non ha perso niente,
    // perché la sua coda era già partita.
    const esito = await tel.page.evaluate(async gara => {
      await caricaGareRemote();
      return scaricaGara(gara);
    }, id);
    expect(esito.ok, 'a coda vuota lo scarico non chiede niente').toBe(true);
    confrontaNumero("riscaricando, il telefono ha l'unione dei due", 5, esito.arrivi);
    const pettDopo = await tel.page.evaluate(() => S.arrivi.map(a => a.pett).sort((a, b) => a - b));
    expect(pettDopo, 'compresi quelli registrati dal computer').toEqual([1, 2, 3, 11, 12]);

    await pc.contesto.close(); await tel.contesto.close();
  });

  test('se la coda non è ancora partita, riscaricare non passa in silenzio', async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'Stradolcetto', iscrittiFinti(20));

    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    await tel.page.evaluate(async gara => { await caricaGareRemote(); await scaricaGara(gara); }, id);

    // Il computer manda i suoi; il telefono resta offline con i suoi in coda.
    db.giu = true;
    await tel.page.evaluate(async () => {
      S.start = Date.now() - 600_000;
      S.arrivi.push({ id: nid(), pett: 11, ms: 61_000, corr: 0 });
      S.arrivi.push({ id: nid(), pett: 12, ms: 62_000, corr: 0 });
      S.stop = Date.now(); touched();
      await sincronizzaSubito();
    });
    await attendiCodaPiena(tel.page);
    db.giu = false;
    await pc.page.evaluate(async () => {
      S.start = Date.now() - 600_000;
      S.arrivi.push({ id: nid(), pett: 1, ms: 60_000, corr: 0 });
      S.stop = Date.now(); touched();
      await sincronizzaSubito();
    });
    await attendiCodaVuota(pc.page);

    // Il telefono prova a riscaricare per "vedere anche quelli del computer".
    const domanda = tel.page.evaluate(gara => scaricaGara(gara), id);
    await tel.page.waitForSelector('#dlgScelte[open]');
    const testo = await tel.page.evaluate(() => document.querySelector('#dlgScelte').textContent);
    expect(testo, 'lo dice invece di sovrascrivere').toContain('non ancora inviata');
    expect(testo, 'e dice che sono arrivi').toContain('arrivi');

    await tel.page.click('#scPiede button[data-scelta="tieni"]');
    const esito = await domanda;
    expect(esito.ok).toBe(false);

    const suTel = await tel.page.evaluate(() => S.arrivi.map(a => a.pett).sort((a, b) => a - b));
    expect(suTel, 'i due arrivi del telefono sono ancora tutti lì').toEqual([11, 12]);

    await pc.contesto.close(); await tel.contesto.close();
  });
});

/* ============================================================
   8. La coda non si ferma a metà

   Difetto trovato scrivendo questi test, e non da questi test: caricando la
   gara vera per intero, l'invio si fermava a 555 righe su 834 e non
   ripartiva più. La causa è che il giro leggeva la coda una volta sola, e
   tutto ciò che entrava mentre inviava restava dentro fino al gesto
   successivo. Al traguardo non si vedeva, perché ogni arrivo ne fa partire
   uno nuovo; a gara finita — cioè quando nessuno tocca più niente — quelle
   righe restavano lì per sempre, con l'indicatore che diceva "Da inviare".
   ============================================================ */
test.describe('La coda non si ferma a metà', () => {
  test("quello che entra mentre il primo giro invia parte lo stesso", async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);

    // Server lento apposta: così il primo giro è ancora in volo quando
    // arrivano le operazioni successive.
    db.lento = 40;
    await pc.page.evaluate(async iscritti => {
      nuovaGara(); S.cfg.nome = 'Gara grossa';
      S.iscritti = iscritti.map(x => ({
        id: nid(), pett: x.pett, cognome: x.cognome, nome: x.nome, sesso: x.sesso,
        societa: x.societa, nascita: x.nascita, conferma: x.conferma,
      }));
      touched();
      sincronizzaSubito();                       // parte e non si aspetta

      // Mentre quello invia, entrano altri iscritti — e da qui in poi
      // NESSUNO tocca più niente: è la gara finita, il computer lasciato lì.
      await new Promise(r => setTimeout(r, 300));
      for (let i = 0; i < 15; i++) {
        S.iscritti.push({
          id: nid(), pett: 900 + i, cognome: 'TARDIVO', nome: 'N' + i, sesso: 'M',
          societa: 'ATL. PROVA', nascita: '1990-01-01', conferma: 'S',
        });
      }
      save();                                    // salva, ma non chiama la sincronia
      const inviati = new Set(await leggiInviati());
      for (const op of operazioniDaMandare(inviati)) {
        await accoda(Object.assign({ creato: Date.now() }, op));
      }
    }, iscrittiFinti(25));

    db.lento = 0;
    const rimaste = await codaDi(pc.page);
    expect(rimaste, 'la prova ha senso solo se qualcosa è entrato a giro iniziato')
      .toBeGreaterThan(0);

    await attendiCoda(pc.page, n => n === 0, {
      timeout: 20_000,
      cosa: "l'invio si è fermato e non è ripartito da solo",
    });
    confrontaNumero('iscritti arrivati sul server senza che nessuno tocchi più niente',
      40, db.tabelle.iscritti.length,
      'Il giro deve rileggere la coda finché fa strada, non fermarsi alla fotografia iniziale.');

    await pc.contesto.close();
  });

  test("una richiesta arrivata durante l'invio non si perde", async ({ browser }) => {
    /* Trovato dalla contesa fra i test, non a tavolino: se qualcuno chiede
       di sincronizzare mentre un invio è già in volo, quella richiesta
       veniva buttata via. Quando il motivo della richiesta era che qualcosa
       ERA CAMBIATO — il server aveva ripreso a funzionare, per esempio — la
       coda restava indietro fino al gesto successivo, che a gara finita non
       arriva mai. */
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);

    db.lento = 40;                 // l'invio dura, così ci si può cadere dentro
    db.rifiuta = 'iscritti';       // e intanto il server respinge gli iscritti

    /* Si accoda a mano e si fa partire l'invio senza passare da touched():
       touched() programma una sincronia fra quattrocento millisecondi, e
       quella basterebbe da sola a rimettere in gioco le righe respinte.
       Qui devono esserci due sole richieste — questa e quella di sotto —
       altrimenti la prova non prova niente. */
    await pc.page.evaluate(async iscritti => {
      nuovaGara(); S.cfg.nome = 'Richiesta durante invio';
      S.iscritti = iscritti.map(x => ({
        id: nid(), pett: x.pett, cognome: x.cognome, nome: x.nome, sesso: x.sesso,
        societa: x.societa, nascita: x.nascita, conferma: x.conferma,
      }));
      save();
      const inviati = new Set(await leggiInviati());
      for (const op of operazioniDaMandare(inviati)) {
        await accoda(Object.assign({ creato: Date.now() }, op));
      }
      inviaCoda();                 // parte e NON si aspetta
    }, iscrittiFinti(25));

    /* Si aspetta che qualche iscritto sia stato davvero respinto: prima di
       allora non c'è niente da rimettere in gioco, e il tolto-il-difetto
       passerebbe lo stesso. */
    const respinti = () => db.richieste
      .filter(r => r.metodo === 'POST' && r.percorso.startsWith('/rest/v1/iscritti')).length;
    const fine = Date.now() + 15_000;
    while (respinti() < 5 && Date.now() < fine) await pc.page.waitForTimeout(50);
    expect(respinti(), 'il server deve aver respinto qualche iscritto').toBeGreaterThanOrEqual(5);

    // Il server riprende a funzionare e si richiede l'invio: siamo dentro
    // il primo, che di quel cambiamento non sa niente.
    db.rifiuta = null;
    const durante = await pc.page.evaluate(() => {
      inviaCoda();                 // cade sul ramo "sto già inviando"
      return { inCorso: invioInCorso, presaNota: invioRichiesto };
    });
    expect(durante.inCorso, "la prova ha senso solo se l'invio era ancora in volo").toBe(true);

    db.lento = 0;
    /* E adesso nessuno chiede più niente. La coda deve arrivare a zero da
       sola, grazie al giro in più che la richiesta di prima ha prenotato. */
    await attendiCoda(pc.page, n => n === 0, {
      timeout: 12_000,
      cosa: "la richiesta arrivata durante l'invio è stata buttata via",
    });
    confrontaNumero('iscritti arrivati sul server', 25, db.tabelle.iscritti.length);

    await pc.contesto.close();
  });
});

/* ============================================================
   8b. La riga della gara parte per prima
   ============================================================ */
test.describe("L'ordine di invio", () => {
  test('la gara arriva sul server prima delle sue tabelle figlie', async ({ browser }) => {
    /* Difetto trovato dai messaggi di questi test, non a tavolino: la coda
       si legge da IndexedDB in ordine di CHIAVE, e 'conf:…' viene prima di
       'gara:…'. Con una gara piccola tutte le operazioni cadono nello stesso
       millisecondo, l'istante di accodamento non le separa, e la
       configurazione parte per prima. Il server la rifiuta — quella gara non
       esiste ancora — e l'operazione resta in coda per sempre.
       Comparve solo con le gare piccole: con le grosse i millisecondi
       bastavano a rimetterle in fila. Il guasto peggiore, quello che dipende
       da quanto è veloce il computer. */
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);

    /* Prima la regola, presa da sola e senza dipendere dall'orologio: tutte
       le operazioni accodate nello stesso istante, nell'ordine peggiore —
       quello alfabetico delle chiavi, che è poi quello vero con cui
       IndexedDB le restituisce. */
    const ordine = await pc.page.evaluate(() => [
      { id: 'conf:zzz', tipo: 'configurazione', creato: 1000 },
      { id: 'fascia:aaa', tipo: 'fasce', creato: 1000 },
      { id: 'gara:zzz', tipo: 'gara', creato: 1000 },
      { id: 'iscritto:bbb', tipo: 'iscritti', creato: 1000 },
    ].sort(perOrdineDiInvio).map(o => o.tipo));
    expect(ordine[0], 'a parità di istante, la gara passa davanti a tutte').toBe('gara');

    // E poi la stessa cosa vista da fuori: una gara piccola, e niente che
    // resti indietro.
    await preparaEInvia(pc.page, 'Gara minuscola', iscrittiFinti(1));
    const scritture = db.richieste
      .filter(r => r.metodo === 'POST' && r.percorso.startsWith('/rest/v1/'))
      .map(r => r.percorso.replace('/rest/v1/', '').split('?')[0]);
    expect(scritture[0], 'la prima scrittura deve essere la riga della gara').toBe('gare');

    const rifiutate = await tuttoInCoda(pc.page);
    if (rifiutate.length) {
      throw new Error('\nSono rimaste operazioni rifiutate dal server:\n' +
        rifiutate.map(o => `  ${o.tipo}: ${o.motivo || 'senza motivo'}`).join('\n') +
        "\n\n  Una riga rifiutata resta in coda e non arriva mai. Se il motivo è\n" +
        "  l'ordine, la gara sul server resta senza la sua configurazione.\n");
    }
    await pc.contesto.close();
  });

  test('una riga rifiutata si riprova al giro dopo, non resta lì per sempre', async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);

    /* Il server RESPINGE gli iscritti — 422, non 500. La differenza conta:
       un guasto del server si riprova subito, una riga respinta viene messa
       da parte per non bloccare le altre. Ed è proprio quella che rischia di
       restarci per sempre. */
    db.rifiuta = 'iscritti';
    await pc.page.evaluate(async iscritti => {
      nuovaGara(); S.cfg.nome = 'Rifiutata e ripresa';
      S.iscritti = iscritti.map(x => ({
        id: nid(), pett: x.pett, cognome: x.cognome, nome: x.nome, sesso: x.sesso,
        societa: x.societa, nascita: x.nascita, conferma: x.conferma,
      }));
      touched();
      await sincronizzaSubito();
    }, iscrittiFinti(4));
    /* Si aspetta che le righe siano state DAVVERO messe da parte, non solo
       che la coda abbia qualcosa dentro: con una macchina carica il primo
       controllo arriva prima che il server abbia risposto, e il resto della
       prova girerebbe a vuoto. */
    const messeDaParte = await attendiMotivo(pc.page, 15_000);
    confrontaNumero('iscritti sul server mentre li respinge', 0, db.tabelle.iscritti.length);
    expect(messeDaParte.length, 'le righe respinte devono risultare messe da parte, con il motivo')
      .toBeGreaterThan(0);

    // Il server torna a funzionare: al giro dopo quelle righe ripartono da
    // sole, senza che nessuno le rimetta in coda a mano.
    db.rifiuta = null;
    await pc.page.evaluate(() => sincronizzaSubito());
    await attendiCodaVuota(pc.page, 20_000);
    confrontaNumero('iscritti arrivati al giro dopo', 4, db.tabelle.iscritti.length,
      'Una riga messa da parte non deve restarci per sempre: il motivo del rifiuto può passare.');

    await pc.contesto.close();
  });
});

/* ============================================================
   9. Quello che è appena sceso non risale
   ============================================================ */
test.describe('Dopo lo scarico la sincronizzazione non rifà il lavoro', () => {
  test('una gara appena scaricata non rimanda tutto su', async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'Gara piena', iscrittiFinti(30));
    await pc.page.evaluate(async () => {
      S.start = Date.now() - 600_000;
      for (let i = 0; i < 10; i++) S.arrivi.push({ id: nid(), pett: i + 1, ms: 60_000 + i * 1000, corr: 0 });
      S.stop = Date.now(); touched();
      await sincronizzaSubito();
    });
    await attendiCodaVuota(pc.page);

    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    await tel.page.evaluate(async gara => { await caricaGareRemote(); await scaricaGara(gara); }, id);

    // Il conto delle scritture prima e dopo un giro di sincronizzazione.
    const scritte = () => db.richieste.filter(r => r.metodo === 'POST' && r.percorso.startsWith('/rest'));
    const scrittePrima = scritte().length;
    await tel.page.evaluate(() => sincronizzaSubito());
    await attendiCodaVuota(tel.page);
    const dopo = scritte().slice(scrittePrima);

    if (dopo.length > 2) {
      const perTabella = {};
      for (const r of dopo) {
        const t = r.percorso.replace('/rest/v1/', '').split('?')[0];
        perTabella[t] = (perTabella[t] || 0) + 1;
      }
      throw new Error(
        `\nDopo lo scarico la sincronizzazione ha rimandato su ${dopo.length} righe:\n` +
        Object.entries(perTabella).map(([t, n]) => `  ${n} in ${t}`).join('\n') + '\n\n' +
        '  Quello che si è appena scaricato È già sul server, per definizione.\n' +
        '  Rimandarlo vuol dire 300 richieste inutili dal telefono al traguardo,\n' +
        '  e una correzione doppia per ogni arrivo.\n');
    }

    // E soprattutto: nessuna correzione in più rispetto a quelle che c'erano.
    confrontaNumero('correzioni sul server dopo il giro', 10, db.tabelle.arrivi_correzioni.length,
      'Un identificativo di correzione legato al tempo, invece che al contenuto, ne creerebbe una copia per arrivo.');

    await pc.contesto.close(); await tel.contesto.close();
  });
});

/* ============================================================
   RIPRENDERE DAL SERVER UNA GARA CHE C'È GIÀ QUI

   Da una domanda: "prima modificavo la gara dal computer e la vedevo dal
   telefono, adesso no, come mai?". L'invio non era rotto — le modifiche
   partivano, in tutte e due le direzioni. Mancava il verso opposto: una
   gara che sta già su questo dispositivo si apre da qui, e la copia del
   server non la va a leggere nessuno. La prima volta sembrava funzionare
   perché quella prima volta era uno scarico: sul telefono la gara non
   c'era ancora.

   Resta la regola di sempre: premere la riga apre quello che c'è QUI, e non
   chiede niente alla rete. Andarsi a prendere le modifiche è un gesto in
   più, esplicito, con gli stessi controlli dello scarico.
   ============================================================ */
test.describe("Riprendere dal server una gara che c'è già qui", () => {
  test('il gesto c\'è solo dove ha senso: nelle gare che stanno in due posti', async ({ browser }) => {
    /* Le tre condizioni si costruiscono decidendo cosa risulta sul server,
       invece di provare a farcele capitare: una gara che resti "solo qui"
       dipenderebbe da quando parte la coda, e la coda parte da sola. Qui si
       prova la regola del disegno — su quali righe compare il gesto — e
       quella si guarda dalle tre condizioni, comunque ci si sia arrivati. */
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const idLocale = await preparaEInvia(pc.page, 'La mia gara', iscrittiFinti(3));

    await pc.page.evaluate(() => { riponiGaraAttiva(); });
    await apriPortaOrganizzatore(pc.page);

    const guarda = (page, gareFinte) => page.evaluate(remote => {
      gareRemote = remote;
      renderMenu();
      return Array.from(document.querySelectorAll('#elencoGare .garariga')).map(r => ({
        nome: r.querySelector('.gnome').textContent,
        dove: r.dataset.dove,
        aggiorna: !!r.querySelector('[data-aggiorna]'),
      }));
    }, gareFinte);

    // 1. il server non ha niente: la gara sta solo qui
    let righe = await guarda(pc.page, []);
    expect(righe[0].dove).toBe('qui');
    expect(righe[0].aggiorna, 'su una gara che il server non ha, non ha senso').toBe(false);

    // 2. il server ha anche lei: adesso il gesto serve
    righe = await guarda(pc.page, [{ id: idLocale, nome: 'La mia gara', iscritti: 3, arrivi: 0 }]);
    expect(righe[0].dove).toBe('entrambi');
    expect(righe[0].aggiorna, "dove c'è da riprendere, il gesto c'è").toBe(true);

    // 3. una che sta solo sul server: basta premere la riga, che la scarica
    righe = await guarda(pc.page, [{ id: 'altra-gara-uuid', nome: 'Di un altro coso', iscritti: 9, arrivi: 0 }]);
    const soloServer = righe.find(r => r.nome === 'Di un altro coso');
    expect(soloServer.dove).toBe('server');
    expect(soloServer.aggiorna, 'e su quella da scaricare basta premere la riga').toBe(false);

    await pc.contesto.close();
  });

  test('la sequenza vera: modifico dal computer, riprendo dal telefono', async ({ browser }) => {
    test.setTimeout(120_000);
    const db = nuovoServer();

    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'Stradolcetto', iscrittiFinti(5));

    // il telefono la scarica una prima volta
    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    await tel.page.evaluate(async gara => { await caricaGareRemote(); await scaricaGara(gara); }, id);
    confrontaNumero('iscritti sul telefono dopo il primo scarico', 5,
      await tel.page.evaluate(() => S.iscritti.length));

    // il computer modifica: cambia il nome e aggiunge un iscritto
    await pc.page.evaluate(async () => {
      S.cfg.nome = 'Stradolcetto 2026';
      S.iscritti.push({
        id: nid(), pett: 99, cognome: 'ARRIVATO', nome: 'DOPO', sesso: 'M',
        societa: 'ATL. OVADESE', nascita: '1985-05-05', conferma: 'S',
      });
      touched(); await sincronizzaSubito();
    });
    await attendiCodaVuota(pc.page);

    // dal telefono: aprire la riga NON deve andare a chiedere niente
    await tel.page.evaluate(() => { riponiGaraAttiva(); scordaGareRemote(); });
    await apriPortaOrganizzatore(tel.page);
    await tel.page.waitForFunction(() => gareRemote !== null);
    await tel.page.evaluate(() => renderMenu());
    await tel.page.click('#elencoGare .garariga');
    await tel.page.waitForTimeout(200);
    const aperta = await tel.page.evaluate(() => ({ nome: S.cfg.nome, iscritti: S.iscritti.length }));
    expect(aperta.nome, "premendo la riga si apre quello che c'è qui, senza rete di mezzo")
      .toBe('Stradolcetto');
    confrontaNumero('e con gli iscritti che aveva qui', 5, aperta.iscritti);

    // e adesso il gesto in più: riprendi dal server
    await tel.page.evaluate(() => { riponiGaraAttiva(); scordaGareRemote(); });
    await apriPortaOrganizzatore(tel.page);
    await tel.page.waitForFunction(() => gareRemote !== null);
    await tel.page.evaluate(() => renderMenu());
    await tel.page.click('#elencoGare [data-aggiorna]');
    await tel.page.waitForFunction(() => S.cfg.nome === 'Stradolcetto 2026', null, { timeout: 30_000 });

    const dopo = await tel.page.evaluate(() => ({
      nome: S.cfg.nome,
      iscritti: S.iscritti.length,
      ultimo: S.iscritti.map(i => i.cognome).includes('ARRIVATO'),
    }));
    expect(dopo.nome, 'il nome è quello nuovo').toBe('Stradolcetto 2026');
    confrontaNumero("e l'iscritto aggiunto sul computer è arrivato", 6, dopo.iscritti);
    expect(dopo.ultimo).toBe(true);

    await pc.contesto.close(); await tel.contesto.close();
  });

  test("se qui c'è roba non inviata, si ferma e chiede prima di sostituire", async ({ browser }) => {
    const db = nuovoServer();
    const pc = await dispositivo(browser, db);
    await accediNellaApp(pc.page);
    const id = await preparaEInvia(pc.page, 'Stradolcetto', iscrittiFinti(4));

    const tel = await dispositivo(browser, db);
    await accediNellaApp(tel.page);
    await tel.page.evaluate(async gara => { await caricaGareRemote(); await scaricaGara(gara); }, id);

    // il telefono registra due arrivi senza rete
    db.giu = true;
    await tel.page.evaluate(async () => {
      S.start = Date.now() - 60_000; touched();
      S.arrivi.push({ id: nid(), pett: 1, ms: 3000, corr: 0 });
      S.arrivi.push({ id: nid(), pett: 2, ms: 5000, corr: 0 });
      S.stop = Date.now(); touched();
      await sincronizzaSubito();
    });
    await attendiCodaPiena(tel.page);
    db.giu = false;

    await tel.page.evaluate(() => { riponiGaraAttiva(); scordaGareRemote(); });
    await apriPortaOrganizzatore(tel.page);
    await tel.page.waitForFunction(() => gareRemote !== null);
    await tel.page.evaluate(() => renderMenu());
    await tel.page.click('#elencoGare [data-aggiorna]');

    // la domanda a tre strade, quella dello scarico
    await tel.page.waitForSelector('#dlgScelte[open]', { timeout: 15_000 });
    const testo = await tel.page.evaluate(() => document.querySelector('#dlgScelte').textContent);
    expect(testo, "dice che qui c'è roba non ancora inviata").toContain('non ancora inviata');
    expect(testo, 'e che sono arrivi').toContain('arrivi');
    await tel.page.click('#scPiede button[data-scelta="tieni"]');
    await tel.page.waitForTimeout(300);

    confrontaNumero('gli arrivi registrati qui sono ancora tutti', 2,
      await tel.page.evaluate(() => S.arrivi.length));

    await pc.contesto.close(); await tel.contesto.close();
  });
});
