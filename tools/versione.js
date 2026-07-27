'use strict';
/*
 * Allinea la versione del service worker all'impronta di index.html.
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
 * Il sito è statico e senza passaggio di build, quindi la versione non può
 * essere calcolata al volo: viene scritta qui dentro e un test controlla che
 * sia rimasta allineata.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RADICE = path.resolve(__dirname, '..');
const APP = path.join(RADICE, 'index.html');
const SW = path.join(RADICE, 'sw.js');

/** L'impronta della app, nella forma che compare dentro sw.js. */
function versioneAttesa() {
  const impronta = crypto.createHash('sha256').update(fs.readFileSync(APP)).digest('hex');
  return 'i-' + impronta.slice(0, 12);
}

function versioneScritta(testo) {
  const m = /const VERSIONE = '([^']+)'/.exec(testo);
  return m ? m[1] : null;
}

const attesa = versioneAttesa();
const testoSw = fs.readFileSync(SW, 'utf8');
const scritta = versioneScritta(testoSw);

if (scritta === null) {
  console.error("ERRORE: in sw.js non trovo la riga \"const VERSIONE = '...'\".");
  process.exit(1);
}

const soloControllo = process.argv.includes('--controlla');

if (scritta === attesa) {
  console.log(`versione allineata: ${attesa}`);
  process.exit(0);
}

if (soloControllo) {
  console.error(`versione NON allineata:\n  sw.js dice   ${scritta}\n  dovrebbe dire ${attesa}\n`);
  console.error('Sistemala con:  npm run versione');
  process.exit(1);
}

fs.writeFileSync(SW, testoSw.replace(
  /const VERSIONE = '[^']+'/, `const VERSIONE = '${attesa}'`), 'utf8');
console.log(`versione aggiornata: ${scritta} -> ${attesa}`);
