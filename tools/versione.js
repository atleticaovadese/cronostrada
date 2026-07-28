'use strict';
/*
 * Allinea la versione del service worker all'impronta del guscio.
 *
 *     npm run versione          scrive la versione giusta in sw.js
 *     npm run versione -- --controlla   dice solo se è allineata (esce 1 se no)
 *
 * PERCHÉ SERVE
 * Il browser si accorge di un aggiornamento solo se sw.js cambia byte per
 * byte. Se si modifica la app e sw.js resta identico, chi ha la app
 * installata continua a usare la versione vecchia per sempre, senza che
 * nessun avviso glielo dica. È un guasto silenzioso, il peggiore.
 *
 * COSA ENTRA NELL'IMPRONTA
 * Tutti i file elencati in GUSCIO dentro sw.js, non solo index.html: sono
 * quelli che finiscono in cache e restano lì finché la versione non cambia.
 * Cambiare un'icona o il manifest senza toccare la app è un caso vero — le
 * icone si rigenerano da sole con `npm run icone` — e se non entrasse
 * nell'impronta chi ha la app installata terrebbe le icone vecchie per
 * sempre.
 *
 * Nell'impronta entra anche il NOME di ogni file, non solo il contenuto:
 * così aggiungere, togliere o rinominare una voce del guscio cambia la
 * versione anche se i byte dei file sono gli stessi.
 *
 * Il sito è statico e senza passaggio di build, quindi la versione non può
 * essere calcolata al volo: viene scritta qui dentro e un test controlla che
 * sia rimasta allineata.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { scriviTesto } = require('./testo');

const RADICE = path.resolve(__dirname, '..');
const SW = path.join(RADICE, 'sw.js');

/**
 * I file del guscio, letti da sw.js: l'elenco sta scritto in un posto solo.
 * './' è la stessa risorsa di './index.html' (la navigazione risponde con
 * quella), quindi si riconduce lì e non si conta due volte.
 */
function fileDelGuscio(testoSw) {
  const blocco = /const GUSCIO = \[([\s\S]*?)\]/.exec(testoSw);
  if (!blocco) return null;
  const voci = [...blocco[1].matchAll(/'([^']+)'/g)]
    .map(m => m[1].replace(/^\.\//, ''))
    .map(v => (v === '' ? 'index.html' : v));
  return [...new Set(voci)].sort();
}

/**
 * L'impronta combinata del guscio, nella forma che compare dentro sw.js.
 * `radice` serve ai test, che lavorano su una copia della app in una cartella
 * temporanea per fingere l'uscita di una versione nuova.
 */
function versioneAttesa(testoSw, radice = RADICE) {
  const file = fileDelGuscio(testoSw);
  if (!file) throw new Error("in sw.js non trovo l'elenco GUSCIO");

  const mancanti = file.filter(f => !fs.existsSync(path.join(radice, f)));
  if (mancanti.length) {
    throw new Error(
      'in GUSCIO ci sono file che non esistono:\n' + mancanti.map(f => '  ' + f).join('\n'));
  }

  const combinata = crypto.createHash('sha256');
  for (const f of file) {
    combinata.update(f + '\n');
    combinata.update(crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(radice, f))).digest('hex') + '\n');
  }
  return 'g-' + combinata.digest('hex').slice(0, 12);
}

function versioneScritta(testo) {
  const m = /const VERSIONE = '([^']+)'/.exec(testo);
  return m ? m[1] : null;
}

module.exports = { fileDelGuscio, versioneAttesa, versioneScritta, RADICE, SW };

function principale() {
  const testoSw = fs.readFileSync(SW, 'utf8');
  const scritta = versioneScritta(testoSw);

  if (scritta === null) {
    console.error("ERRORE: in sw.js non trovo la riga \"const VERSIONE = '...'\".");
    process.exit(1);
  }

  let attesa;
  try { attesa = versioneAttesa(testoSw); }
  catch (e) { console.error('ERRORE: ' + e.message); process.exit(1); }

  if (scritta === attesa) {
    console.log(`versione allineata: ${attesa}`);
    console.log('guscio: ' + fileDelGuscio(testoSw).join(', '));
    return;
  }

  if (process.argv.includes('--controlla')) {
    console.error(`versione NON allineata:\n  sw.js dice   ${scritta}\n  dovrebbe dire ${attesa}\n`);
    console.error('Sistemala con:  npm run versione');
    process.exit(1);
  }

  // scriviTesto e non writeFileSync: sw.js deve restare a fine-riga LF, o
  // l'impronta calcolata qui smette di coincidere con quella di un clone.
  scriviTesto(SW, testoSw.replace(
    /const VERSIONE = '[^']+'/, `const VERSIONE = '${attesa}'`));
  console.log(`versione aggiornata: ${scritta} -> ${attesa}`);
}

if (require.main === module) principale();
