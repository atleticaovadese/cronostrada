'use strict';
/*
 * PROVA DELLA RETE DI SICUREZZA
 *
 *     npm run mutazioni
 *
 * Rompe la app di proposito, una rottura per volta, e verifica che i test se
 * ne accorgano. Una suite verde non dice niente finché non si è visto che sa
 * anche diventare rossa: questo script lo dimostra ogni volta, invece di
 * lasciarlo alla memoria di chi c'era.
 *
 * Le quattro rotture sono quelle che farebbero il danno peggiore: sbagliano i
 * risultati in silenzio, senza errori a schermo, e ci si accorgerebbe di loro
 * a premiazione già fatta.
 *
 * GARANZIA: index.html e dist/CronoStrada.html vengono ripristinati al byte
 * in ogni caso — a fine corsa, se un test va storto, se lo script viene
 * interrotto con Ctrl+C, o se qualcosa esplode a metà. L'impronta SHA-256
 * viene ricontrollata alla fine e, se non torna, lo script lo urla.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const RADICE = path.resolve(__dirname, '..');
const APP = path.join(RADICE, 'index.html');
const COPIA = path.join(RADICE, 'dist', 'CronoStrada.html');
const CLI = path.join(RADICE, 'node_modules', '@playwright', 'test', 'cli.js');

const sha = b => crypto.createHash('sha256').update(b).digest('hex');

const MUTAZIONI = [
  {
    nome: 'arrotondamento al posto del troncamento',
    spiega: 'fmtWise arrotonda invece di troncare: il primo arrivato passa da 33:59 a 34:00',
    danno: 'Tempi ufficiali sbagliati di un secondo su tutta la gara. Viola il regolamento.',
    cerca: `function fmtWise(ms) {
  if (ms === null || ms === undefined || isNaN(ms)) return '';
  const tot = Math.floor(ms / 1000);`,
    sostituisci: `function fmtWise(ms) {
  if (ms === null || ms === undefined || isNaN(ms)) return '';
  const tot = Math.round(ms / 1000);`,
    test: 'CSV per WISE',
  },
  {
    nome: 'soglia Senior spostata di un anno',
    spiega: "catFidal passa da e > 22 a e > 21: chi ha 22 anni di differenza cambia categoria",
    danno: 'Atleti nella fascia sbagliata, e quindi premiati al posto di altri.',
    cerca: "  if (e > 22) return 'S' + s;     // Senior",
    sostituisci: "  if (e > 21) return 'S' + s;     // Senior",
    test: 'categorie FIDAL',
  },
  {
    nome: 'assoluti non esclusi dalla categoria',
    spiega: 'la posizione di categoria non sottrae più i premiati assoluti',
    danno: 'Chi è già salito sul podio assoluto vince anche la sua fascia: doppio premio a uno, niente a un altro.',
    cerca: '        r.posCat = prima + 1 - (catAbs.get(r.catGara) || 0);',
    sostituisci: '        r.posCat = prima + 1;',
    test: 'etichette di posizione',
  },
  {
    nome: 'soglia omonimi alzata',
    spiega: "il rilevamento scatta solo da tre atleti in su, quindi una coppia sfugge",
    danno: 'Due atleti diversi con lo stesso nome passano inosservati e i tempi finiscono scambiati.',
    cerca: "    if (dupNome.get(norm(o.cognome) + '|' + norm(o.nome)) > 1) o.alert.push('NOME');",
    sostituisci: "    if (dupNome.get(norm(o.cognome) + '|' + norm(o.nome)) > 2) o.alert.push('NOME');",
    test: 'omonimia',
  },
];

// ---------------------------------------------------------------- ripristino
/*
 * Salvagente su disco.
 *
 * I gestori di segnale coprono Ctrl+C e le chiusure ordinate, ma non una
 * terminazione forzata (su Windows Stop-Process non è un segnale): lì il
 * processo muore senza poter ripristinare niente e la app resterebbe rotta.
 * Per questo prima di toccare qualcosa se ne mette una copia in un file, e
 * all'avvio successivo la si ritrova e si rimette a posto da sola.
 */
const RIFUGIO = path.join(RADICE, 'node_modules', '.cache', 'cronostrada-mutazioni');
const RIF_APP = path.join(RIFUGIO, 'index.html');
const RIF_COPIA = path.join(RIFUGIO, 'CronoStrada.html');

if (fs.existsSync(RIF_APP)) {
  console.log('Trovata una copia lasciata da un\'esecuzione interrotta: la rimetto a posto.');
  fs.copyFileSync(RIF_APP, APP);
  if (fs.existsSync(RIF_COPIA)) fs.copyFileSync(RIF_COPIA, COPIA);
  fs.rmSync(RIFUGIO, { recursive: true, force: true });
  console.log('index.html ripristinato dalla copia di sicurezza.\n');
}

const ORIGINALE = fs.readFileSync(APP);
const ORIGINALE_COPIA = fs.readFileSync(COPIA);
const IMPRONTA = sha(ORIGINALE);

fs.mkdirSync(RIFUGIO, { recursive: true });
fs.writeFileSync(RIF_APP, ORIGINALE);
fs.writeFileSync(RIF_COPIA, ORIGINALE_COPIA);

let ripristinato = true;
function ripristina() {
  fs.writeFileSync(APP, ORIGINALE);
  fs.writeFileSync(COPIA, ORIGINALE_COPIA);
  ripristinato = true;
}

// Rete di sicurezza a più strati: qualunque strada prenda l'uscita, la app
// torna com'era. writeFileSync è sincrona, quindi funziona anche in 'exit'.
process.on('exit', () => { if (!ripristinato) ripristina(); });
for (const segnale of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(segnale, () => {
    ripristina();
    console.log(`\ninterrotto (${segnale}): index.html ripristinato.`);
    process.exit(130);
  });
}
process.on('uncaughtException', e => {
  ripristina();
  console.error('\nerrore imprevisto: index.html ripristinato.');
  console.error(e);
  process.exit(1);
});

// ---------------------------------------------------------------- esecuzione
function applica(m) {
  const testo = ORIGINALE.toString('utf8');
  if (!testo.includes(m.cerca)) return null;
  const mutato = testo.replace(m.cerca, m.sostituisci);
  if (mutato === testo) return null;
  ripristinato = false;
  fs.writeFileSync(APP, mutato, 'utf8');
  fs.writeFileSync(COPIA, mutato, 'utf8');
  return true;
}

function girano(grep) {
  const r = spawnSync(process.execPath,
    [CLI, 'test', '--project=computer', '--grep', grep, '--reporter=line'],
    { cwd: RADICE, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } });
  const uscita = (r.stdout || '') + (r.stderr || '');
  const quanti = (uscita.match(/(\d+) (passed|failed)/g) || []).join(', ');
  return { passati: r.status === 0, quanti, uscita };
}

console.log('Prova della rete di sicurezza: rompo la app di proposito, una volta per rottura.');
console.log(`index.html   ${IMPRONTA.slice(0, 16)}…  (${ORIGINALE.length} byte)\n`);

const esiti = [];
try {
  for (const [i, m] of MUTAZIONI.entries()) {
    process.stdout.write(`${i + 1}/${MUTAZIONI.length}  ${m.nome}\n`);
    process.stdout.write(`        ${m.spiega}\n`);

    if (!applica(m)) {
      esiti.push({ m, esito: 'ancoraggio', nota: 'il punto da rompere non esiste più nel codice' });
      console.log('        ANCORAGGIO NON TROVATO — la rottura non è stata applicata\n');
      continue;
    }

    const r = girano(m.test);
    ripristina();

    if (r.passati) {
      esiti.push({ m, esito: 'sfuggita', nota: r.quanti });
      console.log(`        SFUGGITA: i test sono passati lo stesso (${r.quanti})\n`);
    } else {
      esiti.push({ m, esito: 'intercettata', nota: r.quanti });
      console.log(`        intercettata (${r.quanti})\n`);
    }
  }
} finally {
  ripristina();
}

// ---------------------------------------------------------------- verifica
const finale = sha(fs.readFileSync(APP));
const finaleCopia = sha(fs.readFileSync(COPIA));
const integro = finale === IMPRONTA && finaleCopia === sha(ORIGINALE_COPIA);

console.log('─'.repeat(72));
for (const e of esiti) {
  const segno = e.esito === 'intercettata' ? 'ok  ' : 'NO  ';
  console.log(`${segno}${e.m.nome}`);
  if (e.esito !== 'intercettata') console.log(`      ${e.m.danno}`);
}
console.log('─'.repeat(72));

console.log(integro
  ? `index.html ripristinato al byte (${finale.slice(0, 16)}…)`
  : `ATTENZIONE: index.html NON corrisponde all'originale!\n  atteso  ${IMPRONTA}\n  trovato ${finale}`);

// La copia di sicurezza si butta solo se la app è davvero tornata a posto.
if (integro) fs.rmSync(RIFUGIO, { recursive: true, force: true });

const sfuggite = esiti.filter(e => e.esito !== 'intercettata');
if (!integro) {
  console.error('\nLa app non è tornata come prima: controlla con "git diff index.html".');
  process.exit(1);
}
if (sfuggite.length) {
  console.error(`\n${sfuggite.length} rotture su ${MUTAZIONI.length} non sono state intercettate.`);
  console.error('La rete di sicurezza ha dei buchi: quei difetti arriverebbero in gara senza');
  console.error('che nessun test se ne accorga. Vanno coperti prima di andare avanti.');
  process.exit(1);
}
console.log(`\nTutte e ${MUTAZIONI.length} le rotture sono state intercettate: la rete tiene.`);
