'use strict';
/*
 * Converte le icone da SVG a PNG.
 *
 *     npm run icone
 *
 * Usa Chromium (che è già installato per i test) come convertitore: nessuna
 * dipendenza in più, e il risultato è riproducibile. Gli SVG in icone/ sono
 * la fonte: i PNG si rigenerano da lì e non vanno modificati a mano.
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
const CARTELLA = path.join(RADICE, 'icone');

const DA_FARE = [
  { da: 'icona.svg', a: 'icona-192.png', lato: 192, perche: 'Android, schermata home' },
  { da: 'icona.svg', a: 'icona-512.png', lato: 512, perche: 'Android, schermata di avvio' },
  { da: 'icona-maskable.svg', a: 'icona-maskable-512.png', lato: 512, perche: 'Android, icona ritagliata' },
  { da: 'icona.svg', a: 'icona-ios-180.png', lato: 180, perche: 'iPhone, Aggiungi a Home' },
];

(async () => {
  const browser = await chromium.launch();
  try {
    for (const x of DA_FARE) {
      const svg = fs.readFileSync(path.join(CARTELLA, x.da), 'utf8');
      const page = await browser.newPage({
        viewport: { width: x.lato, height: x.lato },
        deviceScaleFactor: 1,
      });
      // sfondo trasparente della pagina: quello dell'icona lo mette l'SVG
      await page.setContent(
        `<style>html,body{margin:0;padding:0;background:transparent}
         svg{display:block;width:${x.lato}px;height:${x.lato}px}</style>${svg}`,
        { waitUntil: 'load' });
      const file = path.join(CARTELLA, x.a);
      await page.screenshot({ path: file, omitBackground: true });
      await page.close();
      const kb = fs.statSync(file).size / 1024;
      console.log(`  ${x.a.padEnd(26)} ${x.lato}x${x.lato}  ${kb.toFixed(1)} KB   ${x.perche}`);
    }
  } finally {
    await browser.close();
  }
  console.log('\nicone rigenerate dagli SVG in icone/');
})();
