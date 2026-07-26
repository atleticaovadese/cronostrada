'use strict';
/*
 * LA VERITÀ DI RIFERIMENTO
 *
 * Questi test confrontano quello che la app calcola con i risultati veri della
 * 7ª Stradolcetto, presi dal foglio Excel che la app sostituisce.
 *
 * Se uno di questi fallisce, la app ha smesso di essere d'accordo con una gara
 * realmente disputata: non si va avanti finché non si è capito perché.
 */

const { test, expect } = require('@playwright/test');
const {
  RIFERIMENTO, ANNO_RIFERIMENTO,
  confronta, confrontaNumero, apriApp, iniettaRiferimento, leggiCalcolati,
} = require('./aiuto');

const ISCRITTI = RIFERIMENTO.iscritti;
const ARRIVI = RIFERIMENTO.arrivi;

test.describe('Risultati della gara reale (7ª Stradolcetto)', () => {
  test.beforeEach(async ({ page }) => {
    await apriApp(page);
    await iniettaRiferimento(page);
  });

  test(`1. le ${ISCRITTI.length} categorie FIDAL`, async ({ page }) => {
    const c = await leggiCalcolati(page);
    confrontaNumero(
      'numero di iscritti elaborati', ISCRITTI.length, c.iscritti.length);

    // L'ordine è conservato: calcola() mappa S.iscritti uno a uno.
    confronta('categoria FIDAL', ISCRITTI.map((atteso, n) => ({
      pett: atteso.pett,
      atteso: atteso.catFidal,
      ottenuto: c.iscritti[n].catFidal,
    })));
  });

  test(`2. le ${ISCRITTI.length} fasce di premiazione`, async ({ page }) => {
    const c = await leggiCalcolati(page);
    confronta('fascia di premiazione', ISCRITTI.map((atteso, n) => ({
      pett: atteso.pett,
      atteso: atteso.catGara,
      ottenuto: c.iscritti[n].catGara,
    })));
  });

  test(`3. le ${ARRIVI.length} posizioni assolute`, async ({ page }) => {
    const c = await leggiCalcolati(page);
    confrontaNumero('numero di arrivi elaborati', ARRIVI.length, c.ris.length);

    // C.ris è ordinato per tempo, il riferimento per posizione: appaio per
    // pettorale, che negli arrivi è univoco.
    const perPett = new Map(c.ris.map(r => [String(r.pett), r]));
    confronta('posizione assoluta', ARRIVI.map(a => ({
      pett: a.pett,
      atteso: a.posAss,
      ottenuto: perPett.has(String(a.pett)) ? perPett.get(String(a.pett)).pos : 'nessun arrivo',
    })));
  });

  test(`4. le ${ARRIVI.length} etichette di posizione di categoria`, async ({ page }) => {
    const c = await leggiCalcolati(page);
    const perPett = new Map(c.ris.map(r => [String(r.pett), r]));

    // Comprende l'esclusione dei primi tre assoluti maschili e femminili dalla
    // classifica della loro categoria.
    confronta('etichetta di categoria', ARRIVI.map(a => ({
      pett: a.pett,
      atteso: a.etich,
      ottenuto: perPett.has(String(a.pett)) ? perPett.get(String(a.pett)).etichetta : 'nessun arrivo',
    })));
  });

  test('4b. i primi tre assoluti, maschili e femminili, sono esclusi dalla categoria', async ({ page }) => {
    const c = await leggiCalcolati(page);

    const assolute = c.ris.filter(r => /^\d Assoluta$/.test(r.etichetta));
    const assoluti = c.ris.filter(r => /^\d Assoluto$/.test(r.etichetta));
    confrontaNumero('premiate assolute femminili', 3, assolute.length,
      'La app deve assegnare esattamente 3 etichette "N Assoluta".');
    confrontaNumero('premiati assoluti maschili', 3, assoluti.length,
      'La app deve assegnare esattamente 3 etichette "N Assoluto".');

    // Nessun assoluto deve comparire anche con un'etichetta di categoria, e
    // nessuna categoria deve saltare una posizione per colpa dell'esclusione.
    const perCat = new Map();
    for (const r of c.ris) {
      const m = /^(\d+) (.+)$/.exec(r.etichetta || '');
      if (!m || /^Assolut[oa]$/.test(m[2])) continue;
      if (!perCat.has(m[2])) perCat.set(m[2], []);
      perCat.get(m[2]).push(Number(m[1]));
    }
    const buchi = [];
    for (const [cat, pos] of perCat) {
      const ordinate = pos.slice().sort((a, b) => a - b);
      const atteso = ordinate.map((_, i) => i + 1);
      if (JSON.stringify(ordinate) !== JSON.stringify(atteso)) {
        buchi.push(`  fascia ${cat}: posizioni ${ordinate.join(', ')} — attese 1..${ordinate.length}`);
      }
    }
    if (buchi.length) {
      throw new Error('\nAlcune fasce hanno posizioni di categoria non consecutive:\n'
        + buchi.join('\n') + '\n');
    }
  });

  test('5. i conteggi: 269 confermati, 11 DNS, 4 DNF, 51 società', async ({ page }) => {
    const c = await leggiCalcolati(page);
    confrontaNumero('iscritti', 280, c.n.iscritti);
    confrontaNumero('confermati', 269, c.n.conf,
      'Confermati = iscritti con conferma "S".');
    confrontaNumero('DNS (non partiti)', 11, c.n.dns,
      'DNS = iscritti non confermati.');
    confrontaNumero('DNF (ritirati)', 4, c.n.dnf,
      'DNF = confermati che non sono arrivati.');
    confrontaNumero('arrivi', 265, c.n.arrivi);
    confrontaNumero('società in classifica', 51, c.n.societa,
      'Le società escluse (RUNCARD) non fanno squadra e non si contano.');

    // Coerenza interna: nessun atleta deve restare in un limbo.
    confrontaNumero('confermati = arrivati + ritirati + attesi',
      c.n.conf, c.n.arrivati + c.n.dnf + c.n.attesi);
    confrontaNumero('atleti ancora "attesi" a gara chiusa', 0, c.n.attesi);
  });

  test('6. il CSV per WISE tronca i tempi: il primo è 33:59, non 34:00', async ({ page }) => {
    const c = await leggiCalcolati(page);

    const intestazione = c.csv[0];
    expect(intestazione, 'intestazione del CSV WISE')
      .toEqual(['CLASSIFICA', 'PETTORALE', 'TIPO CLASSIFICA', 'PRESTAZIONE']);

    const primo = c.csv[1];
    const primoRif = ARRIVI.find(a => a.posAss === 1);
    const msPrimo = primoRif.ms;

    if (primo[3] !== '33:59') {
      throw new Error(
        `\nIl tempo del primo arrivato è "${primo[3]}", atteso "33:59".\n\n` +
        `  Tempo reale: ${msPrimo} millisecondi = ` +
        `${Math.floor(msPrimo / 60000)} minuti e ${(msPrimo % 60000) / 1000} secondi.\n` +
        `  I tempi si TRONCANO al secondo, non si arrotondano: ` +
        `33:59.68 vale 33:59.\n` +
        `  Se qui compare 34:00 qualcuno ha introdotto un arrotondamento: ` +
        `è un requisito di regolamento, non una preferenza.\n`);
    }

    confrontaNumero('posizione del primo nel CSV', 1, Number(primo[0]));
    confrontaNumero('pettorale del primo nel CSV', primoRif.pett, Number(primo[1]));
    expect(primo[2], 'tipo classifica della prima riga').toBe('TIME');

    // La struttura: 265 arrivi, poi i DNS, poi i DNF.
    const tipi = c.csv.slice(1).map(r => r[2]);
    confrontaNumero('righe TIME nel CSV', 265, tipi.filter(t => t === 'TIME').length);
    confrontaNumero('righe DNS nel CSV', 11, tipi.filter(t => t === 'DNS').length);
    confrontaNumero('righe DNF nel CSV', 4, tipi.filter(t => t === 'DNF').length);

    const primoDns = tipi.indexOf('DNS');
    const ultimoTime = tipi.lastIndexOf('TIME');
    expect(ultimoTime, 'i blocchi DNS e DNF vanno dopo tutti gli arrivi')
      .toBeLessThan(primoDns);

    // Nessun tempo deve essere arrotondato per eccesso, su nessuna riga.
    const perPett = new Map(ARRIVI.map(a => [String(a.pett), a.ms]));
    const arrotondati = [];
    for (const r of c.csv.slice(1)) {
      if (r[2] !== 'TIME') continue;
      const ms = perPett.get(String(r[1]));
      const tot = Math.floor(ms / 1000);
      const h = Math.floor(tot / 3600), m = Math.floor(tot % 3600 / 60), s = tot % 60;
      const atteso = h > 0
        ? `${h}h${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (r[3] !== atteso) arrotondati.push({ pett: r[1], atteso, ottenuto: r[3], ms });
    }
    if (arrotondati.length) {
      const righe = arrotondati.slice(0, 8).map(a =>
        `  pettorale ${a.pett}: ${a.ms} ms → atteso ${a.atteso}, ottenuto ${a.ottenuto}`);
      throw new Error(
        `\n${arrotondati.length} tempi nel CSV non sono troncati al secondo:\n`
        + righe.join('\n') + '\n');
    }
  });

  test("7. l'omonimia voluta viene rilevata: VOLPI LUCA, due atleti distinti", async ({ page }) => {
    const c = await leggiCalcolati(page);

    const segnalati = c.iscritti.filter(i => i.alert.includes('NOME'));
    const attesi = (() => {
      const conta = new Map();
      for (const i of RIFERIMENTO.iscritti) {
        const k = `${i.cognome.trim().toUpperCase()}|${i.nome.trim().toUpperCase()}`;
        conta.set(k, (conta.get(k) || 0) + 1);
      }
      return RIFERIMENTO.iscritti.filter(i =>
        conta.get(`${i.cognome.trim().toUpperCase()}|${i.nome.trim().toUpperCase()}`) > 1);
    })();

    confrontaNumero('atleti segnalati come possibili omonimi',
      attesi.length, segnalati.length,
      'Nei dati c\'è una omonimia voluta: due atleti diversi con lo stesso ' +
      'cognome e nome. La app deve accorgersene e segnalarla.');

    const pettSegnalati = segnalati.map(i => Number(i.pett)).sort((a, b) => a - b);
    const pettAttesi = attesi.map(i => Number(i.pett)).sort((a, b) => a - b);
    expect(pettSegnalati, 'pettorali degli omonimi rilevati').toEqual(pettAttesi);

    // Sono due persone diverse, non un doppione: anno di nascita e società
    // differenti. Devono restare entrambe in classifica.
    const [a, b] = attesi;
    expect(a.nascita.slice(0, 4), 'i due omonimi hanno anni di nascita diversi')
      .not.toBe(b.nascita.slice(0, 4));

    for (const atleta of attesi) {
      const suo = c.ris.find(r => String(r.pett) === String(atleta.pett));
      if (!suo || !suo.pos) {
        throw new Error(
          `\nL'omonimo con pettorale ${atleta.pett} (${atleta.cognome} ${atleta.nome}) ` +
          `non risulta in classifica.\n  Un'omonimia va segnalata, non trattata ` +
          `come un doppione da scartare: sono due atleti distinti.\n`);
      }
    }

    // L'omonimia è l'UNICO problema nei dati: nessun pettorale duplicato,
    // nessuna data mancante, nessuna categoria senza fascia.
    const altri = c.iscritti.filter(i => i.alert.some(a => a !== 'NOME'));
    if (altri.length) {
      const righe = altri.slice(0, 8).map(i => `  pettorale ${i.pett}: ${i.alert.join(', ')}`);
      throw new Error(
        `\n${altri.length} iscritti hanno segnalazioni impreviste ` +
        `(nei dati di riferimento l'unica attesa è l'omonimia):\n` + righe.join('\n') + '\n');
    }
  });

  test(`8. l'anno di riferimento ${ANNO_RIFERIMENTO} è quello che riproduce le categorie`, async ({ page }) => {
    // Difesa contro il regresso più insidioso: se qualcuno cambiasse il calcolo
    // dell'anno di riferimento, le categorie slitterebbero tutte di una fascia
    // e nessuno se ne accorgerebbe fino alle premiazioni.
    const anno = await page.evaluate(() => S.cfg.anno);
    confrontaNumero('anno di riferimento delle categorie', ANNO_RIFERIMENTO, anno);

    const sbagliato = await page.evaluate(() => {
      S.cfg.anno = S.cfg.anno + 1;
      ricalcola();
      const n = C.iscritti.length;
      const diversi = C.iscritti.filter((i, k) => i.catFidal !== undefined).length;
      const cat = C.iscritti.map(i => i.catFidal);
      S.cfg.anno = S.cfg.anno - 1;
      ricalcola();
      return { cat, n, diversi };
    });
    const uguali = RIFERIMENTO.iscritti
      .filter((i, n) => i.catFidal === sbagliato.cat[n]).length;
    expect(uguali, `con un anno di riferimento sbagliato le categorie devono cambiare, ` +
      `invece ne restano identiche ${uguali} su ${RIFERIMENTO.iscritti.length}`)
      .toBeLessThan(RIFERIMENTO.iscritti.length);
  });
});
