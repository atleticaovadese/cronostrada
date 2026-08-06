'use strict';
/*
 * IL CODICE QR CHE PORTA ALLA APP.
 *
 *     npm run qr                genera e riscrive il blocco dentro index.html
 *     npm run qr -- --controlla dice solo se quello dentro è ancora giusto
 *
 * PERCHÉ NON SI DISEGNA NEL BROWSER. La app è un file solo, senza librerie e
 * senza passaggio di build: mettere dentro un generatore di codici QR
 * vorrebbe dire centinaia di righe di correzione d'errore Reed-Solomon per
 * disegnare sempre lo stesso quadrato, visto che l'indirizzo non cambia mai.
 * Si genera una volta qui e si incolla: nella app resta un'immagine SVG
 * inerte, che funziona anche da chiavetta e anche senza rete.
 *
 * LA LIBRERIA STA SOLO QUI. `qrcode` è una dipendenza di sviluppo, come
 * Playwright: nel sito non finisce niente. E un test rigenera il codice e lo
 * confronta con quello incollato, così non può restare indietro in silenzio.
 */

const fs = require('fs');
const path = require('path');
const QR = require('qrcode');
const { scriviTesto } = require('./testo');

const RADICE = path.resolve(__dirname, '..');
const APP = path.join(RADICE, 'index.html');

/** L'indirizzo pubblico della app. È questo che finisce nel quadrato. */
const INDIRIZZO = 'https://atleticaovadese.github.io/cronostrada/';

const APRI = '<!-- QR:inizio -->';
const CHIUDI = '<!-- QR:fine -->';

/**
 * Il quadrato, come SVG scritto a mano.
 * Non si usa l'SVG della libreria: quello porta dentro attributi e stili che
 * cambiano da una versione all'altra, e il confronto del test diventerebbe
 * una lotteria. Qui si prende solo la matrice di moduli — l'unica cosa che
 * conta davvero — e il disegno è nostro.
 */
function disegna(indirizzo) {
  const q = QR.create(indirizzo, { errorCorrectionLevel: 'M' });
  const lato = q.modules.size;
  const dati = q.modules.data;

  // il bordo bianco: senza, molti telefoni non lo leggono
  const QUIETE = 4;
  const tot = lato + QUIETE * 2;

  /* Un percorso solo invece di migliaia di rettangoli: l'SVG resta sotto i
     tre kilobyte e index.html non si gonfia. */
  const pezzi = [];
  for (let y = 0; y < lato; y++) {
    let x = 0;
    while (x < lato) {
      if (!dati[y * lato + x]) { x++; continue; }
      let largo = 1;
      while (x + largo < lato && dati[y * lato + x + largo]) largo++;
      pezzi.push(`M${x + QUIETE} ${y + QUIETE}h${largo}v1h-${largo}z`);
      x += largo;
    }
  }

  return [
    `<svg class="qr" viewBox="0 0 ${tot} ${tot}" xmlns="http://www.w3.org/2000/svg"`,
    ` role="img" aria-label="Codice QR per aprire CronoStrada">`,
    `<rect width="${tot}" height="${tot}" fill="#fff"/>`,
    `<path fill="#101828" d="${pezzi.join('')}"/>`,
    `</svg>`,
  ].join('');
}

/** Il blocco intero che va dentro index.html, marcatori compresi. */
function blocco(indirizzo = INDIRIZZO) {
  return APRI + disegna(indirizzo) + CHIUDI;
}

function bloccoScritto(testo) {
  const da = testo.indexOf(APRI);
  const a = testo.indexOf(CHIUDI);
  if (da < 0 || a < 0) return null;
  return testo.slice(da, a + CHIUDI.length);
}

module.exports = { INDIRIZZO, disegna, blocco, bloccoScritto, APRI, CHIUDI };

function principale() {
  const testo = fs.readFileSync(APP, 'utf8');
  const scritto = bloccoScritto(testo);
  if (scritto === null) {
    console.error(`ERRORE: in index.html non trovo i marcatori ${APRI} … ${CHIUDI}.`);
    process.exit(1);
  }
  const giusto = blocco();

  if (scritto === giusto) {
    console.log(`codice QR allineato — ${INDIRIZZO}`);
    return;
  }
  if (process.argv.includes('--controlla')) {
    console.error('codice QR NON allineato con l\'indirizzo ' + INDIRIZZO);
    console.error('Sistemalo con:  npm run qr');
    process.exit(1);
  }
  scriviTesto(APP, testo.replace(scritto, () => giusto));
  console.log(`codice QR aggiornato — ${INDIRIZZO}`);
}

if (require.main === module) principale();
