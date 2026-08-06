'use strict';
/*
 * IL CODICE QR CHE PORTA ALLA APP
 *
 * È un'immagine inerte incollata dentro index.html: nella app non c'è nessun
 * generatore. Da qui due domande a cui questi test rispondono:
 *
 *   - quello incollato è ancora quello giusto? (se l'indirizzo cambia, o se
 *     qualcuno ci mette le mani, deve saltare fuori subito)
 *   - il quadrato disegnato corrisponde davvero alla matrice del generatore,
 *     giusto per il verso giusto? Un codice QR ruotato o specchiato resta un
 *     bel quadrato nero e non lo legge nessuno.
 *
 * La seconda si verifica rileggendo l'SVG e ricostruendo la matrice modulo
 * per modulo, poi confrontandola con quella della libreria. Il lettore di
 * codici del browser (BarcodeDetector) sarebbe stato più diretto, ma non
 * c'è su tutte le piattaforme e in CI non ci sarebbe.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const QR = require('qrcode');
const { RADICE } = require('./aiuto');
const { INDIRIZZO, blocco, bloccoScritto } = require('../tools/qr');

const APP = () => fs.readFileSync(path.join(RADICE, 'index.html'), 'utf8');

/** Rilegge l'SVG e ricostruisce la matrice: 1 = modulo scuro. */
function matriceDaSvg(svg) {
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  if (!vb) throw new Error('nel codice QR non trovo il viewBox');
  const tot = Number(vb[1]);
  const QUIETE = 4;
  const lato = tot - QUIETE * 2;

  const m = Array.from({ length: lato }, () => new Array(lato).fill(0));
  const d = /<path[^>]*d="([^"]+)"/.exec(svg);
  if (!d) throw new Error('nel codice QR non trovo il tracciato');
  for (const [, x, y, largo] of d[1].matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(largo); i++) {
      m[Number(y) - QUIETE][Number(x) - QUIETE + i] = 1;
    }
  }
  return { m, lato };
}

test.describe('Il codice QR porta alla app', () => {
  test('quello incollato dentro la app è quello giusto', async () => {
    const scritto = bloccoScritto(APP());
    expect(scritto, 'i marcatori QR:inizio e QR:fine devono essere in index.html').not.toBeNull();

    if (scritto !== blocco()) {
      throw new Error(
        '\nIl codice QR dentro index.html non corrisponde più a\n' +
        `  ${INDIRIZZO}\n\n` +
        '  Chi lo inquadra finirebbe da un\'altra parte, o da nessuna parte.\n' +
        '  Rigeneralo con:  npm run qr\n');
    }
  });

  test('il quadrato disegnato è la matrice del generatore, per il verso giusto', async () => {
    const svg = bloccoScritto(APP());
    const { m, lato } = matriceDaSvg(svg);

    const atteso = QR.create(INDIRIZZO, { errorCorrectionLevel: 'M' });
    expect(lato, 'il lato deve essere quello della matrice vera').toBe(atteso.modules.size);

    const diversi = [];
    for (let y = 0; y < lato; y++) {
      for (let x = 0; x < lato; x++) {
        const vero = atteso.modules.data[y * lato + x] ? 1 : 0;
        if (m[y][x] !== vero) diversi.push(`${x},${y}`);
      }
    }
    if (diversi.length) {
      throw new Error(
        `\n${diversi.length} moduli su ${lato * lato} non corrispondono alla matrice vera.\n` +
        '  primi: ' + diversi.slice(0, 8).join(' ') + '\n\n' +
        '  Un codice QR ruotato, specchiato o disegnato storto resta un bel\n' +
        '  quadrato nero che non legge nessuno.\n');
    }
  });

  test('ha i tre occhi ai suoi angoli, e il bordo bianco intorno', async () => {
    /* Le tre squadrette servono al telefono per capire come è girato il
       codice. Se mancano o stanno nel posto sbagliato, non c'è verso. */
    const { m, lato } = matriceDaSvg(bloccoScritto(APP()));
    const occhio = (ox, oy) => {
      // 7x7: bordo pieno, anello bianco, cuore 3x3 pieno
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const bordo = x === 0 || x === 6 || y === 0 || y === 6;
          const cuore = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          if (m[oy + y][ox + x] !== (bordo || cuore ? 1 : 0)) return false;
        }
      }
      return true;
    };
    expect(occhio(0, 0), 'squadretta in alto a sinistra').toBe(true);
    expect(occhio(lato - 7, 0), 'squadretta in alto a destra').toBe(true);
    expect(occhio(0, lato - 7), 'squadretta in basso a sinistra').toBe(true);

    // il bordo di quiete: quattro moduli bianchi tutt'intorno
    const svg = bloccoScritto(APP());
    const tot = Number(/viewBox="0 0 (\d+)/.exec(svg)[1]);
    expect(tot - lato, 'servono quattro moduli bianchi per lato, o molti telefoni non lo leggono')
      .toBe(8);
  });

  test('si vede nel menu, e sparisce dentro le pagine', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);
    await page.evaluate(() => tornaAlMenu('porte'));

    const nelMenu = await page.evaluate(() => {
      const b = document.querySelector('#qrBox');
      const s = b && b.querySelector('svg.qr');
      const r = s ? s.getBoundingClientRect() : null;
      return {
        c: !!s,
        visibile: b ? getComputedStyle(b).display !== 'none' : false,
        largo: r ? Math.round(r.width) : 0,
        testo: b ? b.textContent.replace(/\s+/g, ' ').trim() : '',
      };
    });
    expect(nelMenu.c, 'il codice QR sta nella pagina principale').toBe(true);
    expect(nelMenu.visibile).toBe(true);
    expect(nelMenu.largo, 'grande abbastanza da inquadrare').toBeGreaterThanOrEqual(100);
    expect(nelMenu.testo, 'e dice cosa succede a inquadrarlo').toContain('Inquadra');

    // dentro una pagina interna non c'entra niente e se ne va
    await page.evaluate(() => tornaAlMenu('organizzatore'));
    expect(await page.evaluate(() =>
      getComputedStyle(document.querySelector('#qrBox')).display), 'dentro una pagina sparisce')
      .toBe('none');
  });
});
