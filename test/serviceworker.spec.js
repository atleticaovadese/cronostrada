'use strict';
/*
 * VINCOLI PER QUANDO ARRIVERÀ IL SERVICE WORKER
 *
 * Oggi la app NON è una PWA e non registra nessun service worker: questi
 * controlli passano perché non c'è ancora niente da controllare, e lo
 * dichiarano invece di far finta di aver verificato qualcosa.
 *
 * Sono scritti adesso perché sono i due modi in cui una PWA fatta in fretta
 * rovina una gara:
 *   1. mettendo in cache i dati di test (che nel repository pubblico sono
 *      anonimi, ma restano roba che non c'entra nulla con la app);
 *   2. ricaricandosi da sola per applicare un aggiornamento mentre qualcuno
 *      sta cronometrando.
 *
 * Quando il service worker esisterà, questi test cominceranno a mordere da
 * soli, senza che nessuno debba ricordarsi di scriverli.
 */

const { test, expect } = require('@playwright/test');
const { apriApp } = require('./aiuto');

/** Elenca cosa c'è nelle cache del browser, se c'è un service worker. */
async function statoServiceWorker(page) {
  return page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      return { presente: false, motivo: 'il browser non supporta i service worker' };
    }
    const registrazioni = await navigator.serviceWorker.getRegistrations();
    if (!registrazioni.length) {
      return { presente: false, motivo: 'la app non ne registra nessuno' };
    }
    const contenuto = [];
    if ('caches' in window) {
      for (const nome of await caches.keys()) {
        const c = await caches.open(nome);
        for (const req of await c.keys()) {
          contenuto.push(new URL(req.url).pathname);
        }
      }
    }
    return { presente: true, contenuto };
  });
}

test.describe('Service worker: vincoli da rispettare quando ci sarà', () => {
  test('la cache non deve contenere i dati di test né gli strumenti', async ({ page }) => {
    await apriApp(page);
    const sw = await statoServiceWorker(page);

    if (!sw.presente) {
      test.info().annotations.push({
        type: 'non ancora applicabile',
        description: `Nessun service worker (${sw.motivo}): la app non è ancora una PWA. `
          + 'Questo controllo scatterà da solo quando lo diventerà.',
      });
      return;
    }

    const vietati = sw.contenuto.filter(p => /(reference(_anon)?\.json|wise_iscritti|\/test\/|\/tools\/|playwright\.config|package(-lock)?\.json|\.github\/)/i.test(p));
    if (vietati.length) {
      throw new Error(
        `\nIl service worker sta mettendo in cache file che non appartengono alla app:\n` +
        vietati.map(p => `  ${p}`).join('\n') +
        `\n\n  In cache va SOLO ciò che serve alla app per partire offline al\n` +
        `  traguardo: index.html, il manifest, le icone. I dati di prova e gli\n` +
        `  strumenti di sviluppo occupano spazio e non servono a nessuno.\n`);
    }
  });

  test('con una gara in corso un aggiornamento non deve ricaricare la pagina', async ({ page }) => {
    /*
     * La regola: se S.start è valorizzato e S.stop no, la gara è in corso e
     * la pagina non si ricarica per nessun motivo. L'aggiornamento aspetta.
     * Ricaricarsi mentre qualcuno preme ARRIVO è il modo più veloce per
     * perdere un arrivo e la fiducia di chi sta al traguardo.
     */
    await apriApp(page);
    await page.evaluate(() => {
      S.iscritti = [{
        id: 'a', pett: 10, cognome: 'ROSSI', nome: 'MARCO', sesso: 'M',
        societa: 'ATL', nascita: '1990-01-01', conferma: 'S',
      }];
      touched();
      go('traguardo');
    });
    await page.click('#btnStart');
    await page.evaluate(() => { segnaArrivo(10); });

    const inGara = await page.evaluate(() => !!S.start && !S.stop);
    expect(inGara, 'la gara deve risultare in corso').toBe(true);

    // Marchio la pagina: se si ricarica, il marchio sparisce.
    await page.evaluate(() => { window.__marchio = 'viva'; });

    // Simulo quello che fa una PWA quando trova una versione nuova.
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.dispatchEvent) {
        navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
      }
      window.dispatchEvent(new Event('online'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(700);

    const dopo = await page.evaluate(() => ({
      viva: window.__marchio === 'viva',
      arrivi: S.arrivi.length,
      inGara: !!S.start && !S.stop,
    }));

    if (!dopo.viva) {
      throw new Error(
        `\nLa pagina si è ricaricata mentre la gara era in corso.\n\n` +
        `  Con S.start valorizzato e S.stop no non ci si ricarica per nessun\n` +
        `  motivo: l'aggiornamento va rimandato in silenzio a gara finita.\n`);
    }
    expect(dopo.arrivi, "e l'arrivo registrato è ancora lì").toBe(1);
    expect(dopo.inGara, 'e la gara risulta ancora in corso').toBe(true);
  });

  test('la app funziona senza service worker, come fa oggi', async ({ page }) => {
    // Il contrario del vincolo: la app non deve MAI dipendere dal service
    // worker per funzionare. Oggi non c'è e tutto gira: è la condizione che
    // permette di aprirla con un doppio clic dalla chiavetta USB.
    await apriApp(page);
    const r = await page.evaluate(() => ({
      caricata: typeof S !== 'undefined' && typeof calcola === 'function',
      richieste: performance.getEntriesByType('resource')
        .map(e => new URL(e.name).pathname)
        .filter(p => p !== '/index.html' && p !== '/'),
    }));
    expect(r.caricata, 'la app si carica da sola').toBe(true);
    expect(r.richieste, 'e non chiede un solo file esterno').toEqual([]);
  });
});
