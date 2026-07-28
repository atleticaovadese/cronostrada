'use strict';
/*
 * PROVA DELLA RETE DI SICUREZZA
 *
 *     npm run mutazioni
 *     npm run mutazioni -- troncamento     solo quelle che contengono la parola
 *
 * Rompe la app di proposito, una rottura per volta, e verifica che i test se
 * ne accorgano. Una suite verde non dice niente finché non si è visto che sa
 * anche diventare rossa: questo script lo dimostra ogni volta, invece di
 * lasciarlo alla memoria di chi c'era.
 *
 * Le rotture sono quelle che farebbero il danno peggiore: sbagliano i
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

  /* Le rotture che riguardano la gara che scende dal server. Nessuna di
     queste dà un errore a schermo: sono tutte guasti che sembrano
     funzionare. */
  {
    nome: 'un pezzo che non arriva passa per una lista vuota',
    spiega: 'scaricaTutte ingoia la risposta sbagliata invece di fermarsi',
    danno: 'La gara viene scritta senza gli iscritti, e sembra completa. Una gara scaricata a metà è peggio di una assente.',
    cerca: '    if (!r.ok) throw new Error(`${cosa}: il server ha risposto ${r.status}`);',
    sostituisci: '    if (!r.ok) return righe;',
    test: 'tutto o niente',
  },
  {
    nome: 'le pagine si contano invece delle righe',
    spiega: 'scaricaTutte riparte dal numero di pagina, non da quante righe ha davvero',
    danno: 'Con un server che manda meno righe di quante gliene chiedi, la gara arriva con dei buchi in mezzo.',
    cerca: '    const da = righe.length;',
    sostituisci: '    const da = ((righe.giro = (righe.giro || 0) + 1) - 1) * PAGINA_SCARICO;',
    test: 'troncata',
  },
  {
    nome: 'lo scarico non guarda più la coda',
    spiega: 'si sovrascrive la copia locale senza controllare se ha roba non inviata',
    danno: "Gli arrivi registrati e non ancora partiti spariscono, e nessuno lo dice. Erano l'unica copia.",
    cerca: '  let coda = await codaDellaGara(id);\n  if (coda.ops.length) {',
    sostituisci: '  let coda = await codaDellaGara(id);\n  if (false) {',
    test: 'non si perde in silenzio|non passa in silenzio',
  },
  {
    nome: 'una gara in corso si lascia sovrascrivere',
    spiega: 'ostacoloAlloScarico non trova più nessun ostacolo',
    danno: 'Si scarica sopra una gara mentre il cronometro cammina: gli arrivi appena presi non esistono più.',
    cerca: 'function ostacoloAlloScarico(id, remota) {\n  if (S && S.start && !S.stop) {',
    sostituisci: 'function ostacoloAlloScarico(id, remota) {\n  if (false) {',
    test: 'non si scarica e non si sovrascrive',
  },
  {
    nome: 'quello che è appena sceso risale',
    spiega: 'dopo lo scarico le impronte restano vuote',
    danno: 'Trecento richieste inutili dal telefono e una correzione doppia per ogni arrivo, ogni volta che si apre una gara.',
    cerca: '  const giaSulServer = prendiImpronteDelloScarico();   // subito, senza cedere il turno',
    sostituisci: '  const giaSulServer = [];',
    test: 'non rifà il lavoro',
  },
  {
    nome: 'lo scarto della partenza sommato invece che sottratto',
    spiega: 'scendendo, i tempi grezzi non vengono riportati alla partenza corrente',
    danno: 'Chi scarica una gara con la partenza spostata legge tempi diversi da chi l\'ha cronometrata.',
    cerca: '        ms: Number(a.ms) - scarto,      // qui dentro i tempi sono già traslati',
    sostituisci: '        ms: Number(a.ms) + scarto,',
    test: 'partenza spostata',
  },
  {
    nome: 'la riga della gara perde la precedenza',
    spiega: "le operazioni partono nell'ordine in cui capitano, gara compresa",
    danno: 'Con una gara piccola la configurazione parte prima della gara, il server la rifiuta e non arriva mai.',
    cerca: 'const PRECEDENZA = { gara: 0 };',
    sostituisci: 'const PRECEDENZA = {};',
    test: "ordine di invio",
  },
  {
    nome: 'le righe rifiutate restano da parte per sempre',
    spiega: 'la coda non rimette mai in gioco quello che il server ha respinto',
    danno: 'Un rifiuto passeggero diventa definitivo: quelle righe non partono più, e nessuno ci riprova.',
    cerca: '      await sbloccaCoda();',
    sostituisci: '      ;',
    test: 'riprova al giro dopo',
  },
  {
    nome: "una richiesta di invio arrivata durante un invio si perde",
    spiega: 'chi chiede di inviare mentre si sta gia\' inviando viene ignorato',
    danno: 'La coda si ferma a meta\' e non riparte piu\': a gara finita quelle righe non partono mai, e l\'indicatore dice "Da inviare" per sempre.',
    cerca: '  if (invioInCorso) { invioRichiesto = true; return; }',
    sostituisci: '  if (invioInCorso) return;',
    // Anche il collaudo finale: e' la rottura per cui esiste, ed e' l'unica
    // prova che percorre il volume in cui il difetto compariva davvero.
    test: 'riprova al giro dopo|non si ferma a metà|dall.inizio alla fine',
  },
  {
    nome: 'la sessione azzerata torna in gara',
    spiega: 'scendendo non si filtra più per sessione',
    danno: 'Gli arrivi di una falsa partenza rientrano in classifica insieme a quelli buoni.',
    cerca: '    .filter(a => Number(a.sessione || 1) === sessione)   // le sessioni azzerate non contano',
    sostituisci: '    .filter(a => true)',
    test: 'sessione azzerata',
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
const scappa = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* L'ancoraggio si cerca senza badare a come sono scritti gli a capo:
   index.html sta su Windows con CRLF, e una rottura che ne attraversa due
   righe non si troverebbe mai cercando '\n'. Lo si è scoperto qui: due
   rotture su dodici risultavano "ancoraggio non trovato" e passavano per
   applicate a vuoto — cioè per rotture che nessuno stava provando. */
function applica(m) {
  const testo = ORIGINALE.toString('utf8');
  const rx = new RegExp(m.cerca.split('\n').map(scappa).join('\\r?\\n'));
  if (!rx.test(testo)) return null;
  const aCapo = testo.includes('\r\n') ? '\r\n' : '\n';
  const nuovo = m.sostituisci.split('\n').join(aCapo);
  const mutato = testo.replace(rx, () => nuovo);
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

/* Un filtro sul nome, per riprovarne una sola senza aspettare le altre.
   Non cambia niente per chi lancia `npm run mutazioni` e basta. */
const filtro = process.argv.slice(2).filter(a => !a.startsWith('-')).join(' ').toLowerCase();
const SCELTE = filtro
  ? MUTAZIONI.filter(m => m.nome.toLowerCase().includes(filtro))
  : MUTAZIONI;

if (!SCELTE.length) {
  console.error(`Nessuna rottura contiene "${filtro}". Ci sono:`);
  for (const m of MUTAZIONI) console.error('  ' + m.nome);
  process.exit(1);
}

console.log('Prova della rete di sicurezza: rompo la app di proposito, una volta per rottura.');
if (filtro) console.log(`filtro: "${filtro}" — ${SCELTE.length} rotture su ${MUTAZIONI.length}`);
console.log(`index.html   ${IMPRONTA.slice(0, 16)}…  (${ORIGINALE.length} byte)\n`);

const esiti = [];
try {
  for (const [i, m] of SCELTE.entries()) {
    process.stdout.write(`${i + 1}/${SCELTE.length}  ${m.nome}\n`);
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
  console.error(`\n${sfuggite.length} rotture su ${SCELTE.length} non sono state intercettate.`);
  console.error('La rete di sicurezza ha dei buchi: quei difetti arriverebbero in gara senza');
  console.error('che nessun test se ne accorga. Vanno coperti prima di andare avanti.');
  process.exit(1);
}
console.log(`\nTutte e ${SCELTE.length} le rotture sono state intercettate: la rete tiene.`);
