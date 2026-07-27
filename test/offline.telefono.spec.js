'use strict';
/*
 * MODALITÀ AEREO, SUL TELEFONO VERO
 *
 * Gira sui due profili di dispositivo (iPhone 14 su WebKit, Pixel 7 su
 * Chromium) e spegne davvero il server invece di emulare l'assenza di rete.
 *
 * Non è pignoleria: l'offline emulato di Playwright manda WebKit in errore
 * interno sul ricaricamento, e con quello si sarebbe concluso che su iPhone
 * la app non riparte. Spegnendo il server — che è poi quello che succede in
 * modalità aereo — riparte in 73 ms.
 *
 * Ogni test ha un server suo, che poi uccide: non può spegnere quello degli
 * altri.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const { spawn } = require('child_process');
const { RADICE } = require('./aiuto');

test.use({ serviceWorkers: 'allow' });

/** Avvia un server solo per questo test, su una porta che non collide. */
function avviaServer() {
  const porta = 8870 + Number(process.env.TEST_PARALLEL_INDEX || 0);
  const proc = spawn(process.execPath, [path.join(RADICE, 'tools', 'serve.js'), String(porta)],
    { cwd: RADICE, stdio: 'ignore' });
  return { proc, base: `http://127.0.0.1:${porta}` };
}

test.describe('Modalità aereo', () => {
  test('la app installata riparte senza rete, con la gara dentro', async ({ page }) => {
    const { proc, base } = avviaServer();
    try {
      await page.waitForTimeout(1200);
      await page.goto(`${base}/index.html`);
      await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);

      // il service worker deve aver preso il controllo, altrimenti offline
      // non c'è niente da cui ripartire
      await page.waitForFunction(
        () => 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null,
        null, { timeout: 20_000 });

      const guscio = await page.evaluate(async () => {
        const dentro = [];
        for (const n of await caches.keys()) {
          const c = await caches.open(n);
          for (const r of await c.keys()) dentro.push(new URL(r.url).pathname.split('/').pop() || 'radice');
        }
        return dentro.sort();
      });
      expect(guscio, 'la pagina deve essere in cache prima di staccare la rete')
        .toContain('index.html');

      // una gara vera in corso
      await page.evaluate(() => {
        S.iscritti = [{
          id: 'a', pett: 126, cognome: 'ROSSI', nome: 'MARCO', sesso: 'M',
          societa: 'ATL. TEST', nascita: '1990-01-01', conferma: 'S',
        }];
        touched(); go('traguardo');
      });
      await page.tap('#btnStart');
      await page.evaluate(() => { segnaArrivo(126); });

      // ---- MODALITÀ AEREO: il server sparisce davvero ----
      proc.kill();
      await page.waitForTimeout(700);

      const t0 = Date.now();
      await page.reload({ timeout: 25_000 });
      await page.waitForFunction(() => typeof S !== 'undefined' && C !== null,
        null, { timeout: 25_000 });
      const impiegato = Date.now() - t0;

      const r = await page.evaluate(() => ({
        completa: typeof calcola === 'function' && typeof csvWiseRows === 'function',
        arrivi: S.arrivi.length,
        pettorale: S.arrivi[0] && S.arrivi[0].pett,
        partenza: !!S.start,
        iscritti: S.iscritti.length,
        tastierino: document.querySelectorAll('#padGrid button').length,
      }));

      expect(r.completa, 'senza rete la app deve essere caricata per intero').toBe(true);
      expect(r.arrivi, "l'arrivo registrato prima è ancora lì").toBe(1);
      expect(r.pettorale, 'con il suo pettorale').toBe(126);
      expect(r.partenza, "e l'orario di partenza").toBe(true);
      expect(r.iscritti, 'e gli iscritti').toBe(1);
      expect(r.tastierino, 'e il tastierino è al suo posto').toBe(12);

      if (impiegato > 3000) {
        throw new Error(
          `\nSenza rete la app ci ha messo ${impiegato} ms a ripartire.\n` +
          `  Al traguardo deve partire in un secondo.\n`);
      }

      // e senza rete si continua a lavorare
      await page.tap('#btnArrivo');
      const dopo = await page.evaluate(() => ({
        arrivi: S.arrivi.length,
        salvati: (JSON.parse(localStorage.getItem('cronostrada.v1') || '{}').arrivi || []).length,
      }));
      expect(dopo.arrivi, 'senza rete si registra ancora').toBe(2);
      expect(dopo.salvati, 'e si salva ancora').toBe(2);
    } finally {
      proc.kill();
    }
  });
});
