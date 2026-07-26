'use strict';
/*
 * Funzioni di appoggio per i test.
 *
 * Il pezzo importante qui è `confronta()`: quando un valore non torna, il
 * messaggio deve dire in italiano QUALE ATLETA e QUALE VALORE non corrisponde.
 * Un test che dice solo "expected 280 to equal 279" non serve a niente alle
 * sette del mattino del giorno della gara.
 */

const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const PERCORSO_RIFERIMENTO = path.join(RADICE, 'reference_anon.json');
const PERCORSO_XLSX = path.join(RADICE, 'wise_iscritti_anon.xlsx');

if (!fs.existsSync(PERCORSO_RIFERIMENTO)) {
  throw new Error(
    `Manca il file dei dati di riferimento: ${PERCORSO_RIFERIMENTO}\n` +
    'Rigeneralo con: npm run dati');
}

const RIFERIMENTO = JSON.parse(fs.readFileSync(PERCORSO_RIFERIMENTO, 'utf8'));
const ANNO_RIFERIMENTO = RIFERIMENTO._annoRiferimento;

// Indice pettorale -> iscritto, per i messaggi di errore.
const PER_PETT = new Map(RIFERIMENTO.iscritti.map(i => [String(i.pett), i]));

/** Descrizione leggibile di un atleta: compare nei messaggi di errore. */
function descriviAtleta(pett) {
  const i = PER_PETT.get(String(pett));
  if (!i) return `pettorale ${pett} (non presente fra gli iscritti)`;
  const anno = String(i.nascita).slice(0, 4);
  const soc = i.societa && i.societa.trim() ? i.societa.trim() : 'senza società';
  return `pettorale ${pett} — ${i.cognome} ${i.nome} (${i.sesso}, ${anno}, ${soc})`;
}

const mostra = v => (v === '' || v === null || v === undefined) ? '(vuoto)' : String(v);

/**
 * Confronta una lista di {pett, atteso, ottenuto} e fallisce con un messaggio
 * dettagliato in italiano al primo scostamento.
 */
function confronta(nomeCampo, coppie, { massimo = 8 } = {}) {
  const diff = coppie.filter(c => String(c.atteso) !== String(c.ottenuto));
  if (diff.length === 0) return;

  const righe = diff.slice(0, massimo).map(c =>
    `  ${descriviAtleta(c.pett)}\n` +
    `      ${nomeCampo} atteso dal foglio Excel: ${mostra(c.atteso)}\n` +
    `      ${nomeCampo} calcolato dalla app:     ${mostra(c.ottenuto)}`);

  const restanti = diff.length > massimo
    ? `\n  … e altri ${diff.length - massimo} atleti con lo stesso problema.`
    : '';

  throw new Error(
    `\n${nomeCampo}: ${diff.length} valori su ${coppie.length} non corrispondono ` +
    `ai risultati della gara reale.\n\n` +
    righe.join('\n') + restanti +
    `\n\nI valori attesi vengono dalla 7ª Stradolcetto (${RIFERIMENTO.iscritti.length} iscritti, ` +
    `${RIFERIMENTO.arrivi.length} arrivi), anno di riferimento ${ANNO_RIFERIMENTO}.\n`);
}

/** Confronto di un singolo numero, con messaggio parlante. */
function confrontaNumero(descrizione, atteso, ottenuto, spiegazione = '') {
  if (Number(atteso) === Number(ottenuto)) return;
  throw new Error(
    `\n${descrizione}: atteso ${atteso}, ottenuto ${ottenuto}.` +
    (spiegazione ? `\n  ${spiegazione}` : '') + '\n');
}

/** Apre la app e attende che sia pronta. */
async function apriApp(page, percorso = '/index.html') {
  // La app avvisa prima di abbandonare la pagina se ci sono arrivi non salvati
  // su file: nei test accettiamo sempre.
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(percorso);
  await page.waitForFunction(
    () => typeof S !== 'undefined' && typeof calcola === 'function' && C !== null);
}

/**
 * Inietta i dati della gara reale nella app e ricalcola.
 *
 * Gli arrivi arrivano con i millisecondi dallo start già registrati, quindi
 * `start` è un istante qualsiasi nel passato: la app lavora sui delta, mai su
 * orari assoluti, e il risultato non dipende da quando girano i test.
 */
async function iniettaRiferimento(page, { segnaDnf = true } = {}) {
  const esito = await page.evaluate(({ anno, iscritti, arrivi, segnaDnf }) => {
    S = VUOTO();
    S.cfg.anno = anno;
    S.cfg.data = anno + '-09-14';
    S.cfg.nome = 'Gara di riferimento';
    S.cfg.km = 10;

    S.iscritti = iscritti.map((x, n) => ({
      id: 'i' + n,
      pett: x.pett,
      cognome: x.cognome,
      nome: x.nome,
      sesso: x.sesso,
      societa: x.societa,
      nascita: x.nascita,
      conferma: x.conferma,
    }));

    const base = Date.now() - 6 * 3600 * 1000;   // gara di sei ore fa
    S.start = base;
    S.arrivi = arrivi.map((a, n) => ({ id: 'a' + n, pett: a.pett, ms: a.ms, corr: 0 }));
    S.stop = base + Math.max(...arrivi.map(a => a.ms)) + 60_000;

    ricalcola();

    if (segnaDnf) {
      // Come fa il pulsante "Chiudi arrivi": i confermati che non sono
      // arrivati risultano ritirati.
      S.dnf = C.stati.filter(s => s.stato === 'Atteso').map(s => s.pett);
      ricalcola();
    }

    return { iscritti: C.iscritti.length, arrivi: C.ris.length, dnf: S.dnf.length };
  }, {
    anno: ANNO_RIFERIMENTO,
    iscritti: RIFERIMENTO.iscritti,
    arrivi: RIFERIMENTO.arrivi,
    segnaDnf,
  });

  confrontaNumero('iscritti iniettati', RIFERIMENTO.iscritti.length, esito.iscritti);
  confrontaNumero('arrivi iniettati', RIFERIMENTO.arrivi.length, esito.arrivi);
  return esito;
}

/** Legge dalla app tutto ciò che i test devono confrontare. */
async function leggiCalcolati(page) {
  return page.evaluate(() => ({
    iscritti: C.iscritti.map(i => ({
      pett: i.pett,
      catFidal: i.catFidal,
      catGara: i.catGara,
      alert: i.alert,
      confermato: i.confermato,
    })),
    ris: C.ris.map(r => ({
      pett: r.pett,
      pos: r.pos === undefined ? null : r.pos,
      etichetta: r.etichetta === undefined ? '' : r.etichetta,
      tempo: r.tempo,
    })),
    stati: C.stati.map(s => ({ pett: s.pett, stato: s.stato })),
    n: C.n,
    csv: csvWiseRows(),
  }));
}

/** Forza il salvataggio e attende che sia finito in localStorage (debounce 350ms). */
async function salvaEAspetta(page) {
  await page.evaluate(() => { save(); });
  await page.waitForFunction(() => !!localStorage.getItem('cronostrada.v1'), null,
    { timeout: 5_000 });
}

module.exports = {
  RADICE,
  RIFERIMENTO,
  ANNO_RIFERIMENTO,
  PERCORSO_XLSX,
  descriviAtleta,
  confronta,
  confrontaNumero,
  apriApp,
  iniettaRiferimento,
  leggiCalcolati,
  salvaEAspetta,
};
