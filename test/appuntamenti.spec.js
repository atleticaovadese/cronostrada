'use strict';
/*
 * PROSSIMI APPUNTAMENTI: le locandine delle gare in arrivo
 *
 * La terza porta del menu. Le guarda chiunque, senza account e senza
 * installare niente; le appende chi organizza gare.
 *
 * Il permesso non lo decide la app: lo decide il server, e la app non finge
 * di saperlo prima. Chi possiede almeno una gara può appendere; a tutti gli
 * altri il server risponde di no e la app lo scrive in chiaro invece di
 * lasciare un pulsante che non fa niente.
 *
 * Perché questa regola e non "chiunque abbia fatto l'accesso": il progetto
 * Supabase è condiviso con un'altra app che ha 67 account, e nessuno di
 * quelli ha a che vedere con le gare su strada.
 */

const { test, expect } = require('@playwright/test');
const { confrontaNumero } = require('./aiuto');
const { nuovoServer, montaServerFinto, accediNellaApp, attendiCodaVuota } =
  require('./finto-server');

async function dispositivo(browser, db, opzioni = {}) {
  const contesto = await browser.newContext(opzioni);
  await montaServerFinto(contesto, db);
  const page = await contesto.newPage();
  page.on('dialog', d => d.accept().catch(() => { }));
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);
  await page.evaluate(() => {
    window.__avvisi = [];
    const d = document.querySelector('#dlgConfirm');
    new MutationObserver(() => {
      if (!d.open) return;
      window.__avvisi.push(document.querySelector('#cfTitle').textContent + ' — ' +
        document.querySelector('#cfMsg').textContent);
      document.querySelector('#cfYes').click();
    }).observe(d, { attributes: true, attributeFilter: ['open'] });
  });
  return { contesto, page };
}

const avvisi = page => page.evaluate(() => window.__avvisi.join(' | '));

/** Entra dalla porta premendo la casella, come farebbe chiunque. */
async function apriAppuntamenti(page) {
  await page.evaluate(() => tornaAlMenu('porte'));
  await page.click('#porte .porta[data-p="appuntamenti"]');
  await page.waitForFunction(() => appuntamenti !== null || appuntamentiErrore !== null,
    null, { timeout: 15_000 });
  await page.evaluate(() => renderMenu());
}

/** Chi organizza gare: ne possiede almeno una sul server. */
async function conUnaGara(page, nome) {
  await page.evaluate(async n => {
    nuovaGara(); S.cfg.nome = n; touched();
    await sincronizzaSubito();
  }, nome);
  await attendiCodaVuota(page, 30_000);
}

/** Appende un file scegliendolo davvero dal selettore. */
async function appendi(page, file) {
  await page.setInputFiles('#fileAppuntamento', file);
  await page.waitForTimeout(400);
}

const FOTO = {
  name: 'locandina stradolcetto.png',
  mimeType: 'image/png',
  // un PNG 1x1 vero, non un pezzo di testo con l'estensione giusta
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'),
};
const PDF = {
  name: 'volantino.pdf', mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n% finto, ma con la firma giusta\n'),
};

const righe = page => page.evaluate(() =>
  Array.from(document.querySelectorAll('#elencoAppuntamenti .allegato')).map(a => ({
    nome: a.querySelector('.allegatoNome').textContent,
    sotto: a.querySelector('.allegatoSotto').textContent,
    indirizzo: a.querySelector('a').getAttribute('href'),
    togli: !!a.querySelector('[data-togli]'),
  })));

test.describe('Le locandine le guarda chiunque', () => {
  test('senza account si vedono e si aprono, ma non si tocca niente', async ({ browser }) => {
    const db = nuovoServer();

    const org = await dispositivo(browser, db);
    await accediNellaApp(org.page);
    await conUnaGara(org.page, 'Stradolcetto');
    await apriAppuntamenti(org.page);
    await appendi(org.page, FOTO);
    confrontaNumero('locandine appese', 1, db.allegati.length);

    // e adesso uno qualunque, che non ha mai fatto l'accesso
    const gente = await dispositivo(browser, db);
    expect(await gente.page.evaluate(() => !!sessione),
      'il pubblico non deve avere nessuna sessione').toBe(false);
    await apriAppuntamenti(gente.page);

    const viste = await righe(gente.page);
    confrontaNumero('locandine viste dal pubblico', 1, viste.length);
    expect(viste[0].nome, 'con il nome che aveva il file').toBe('locandina-stradolcetto.png');
    expect(viste[0].indirizzo, 'e un collegamento che si apre').toContain('/storage/v1/object/public/appuntamenti/');
    expect(viste[0].togli, 'senza accesso non si toglie niente').toBe(false);

    const puoAppendere = await gente.page.evaluate(() => !!document.querySelector('#btnAppendi'));
    expect(puoAppendere, 'e non c\'è nemmeno il pulsante per appendere').toBe(false);

    await org.contesto.close(); await gente.contesto.close();
  });

  test('il collegamento della locandina risponde davvero', async ({ browser }) => {
    const db = nuovoServer();
    const org = await dispositivo(browser, db);
    await accediNellaApp(org.page);
    await conUnaGara(org.page, 'Stradolcetto');
    await apriAppuntamenti(org.page);
    await appendi(org.page, PDF);

    const indirizzo = (await righe(org.page))[0].indirizzo;
    const esito = await org.page.evaluate(async u => {
      const r = await fetch(u);
      return { stato: r.status, tipo: r.headers.get('content-type') };
    }, indirizzo);
    confrontaNumero('la locandina risponde', 200, esito.stato);
    expect(esito.tipo, 'e arriva come PDF').toContain('application/pdf');

    await org.contesto.close();
  });
});

test.describe('Le appende chi organizza gare', () => {
  test('chi ha una gara sua appende, e la locandina compare', async ({ browser }) => {
    const db = nuovoServer();
    const org = await dispositivo(browser, db);
    await accediNellaApp(org.page);
    await conUnaGara(org.page, 'Stradolcetto');

    await apriAppuntamenti(org.page);
    confrontaNumero('prima non c\'è niente', 0, (await righe(org.page)).length);

    await appendi(org.page, FOTO);
    const dopo = await righe(org.page);
    confrontaNumero('e adesso c\'è la locandina', 1, dopo.length);
    expect(dopo[0].sotto, 'che risulta una foto').toContain('foto');
    expect(dopo[0].togli, 'con il suo pulsante per toglierla').toBe(true);

    await org.contesto.close();
  });

  test('chi non organizza gare riceve un no, e capisce perché', async ({ browser }) => {
    /* È il caso dei 67 account dell'altra app: hanno un accesso valido e
       nessuna gara. Il server dice di no, e la app lo dice a parole. */
    const db = nuovoServer();
    const estraneo = await dispositivo(browser, db);
    await accediNellaApp(estraneo.page, 'uno@altraapp.it');
    await apriAppuntamenti(estraneo.page);

    await appendi(estraneo.page, FOTO);

    confrontaNumero('non deve essere appeso niente', 0, db.allegati.length);
    const detto = await avvisi(estraneo.page);
    expect(detto, 'e glielo si dice').toContain('organizzatore');
    expect(detto, 'spiegando cosa serve').toContain('gara');

    await estraneo.contesto.close();
  });

  test('togliere una locandina la fa sparire da tutti', async ({ browser }) => {
    const db = nuovoServer();
    const org = await dispositivo(browser, db);
    await accediNellaApp(org.page);
    await conUnaGara(org.page, 'Stradolcetto');
    await apriAppuntamenti(org.page);
    await appendi(org.page, FOTO);
    await appendi(org.page, PDF);
    confrontaNumero('due locandine', 2, (await righe(org.page)).length);

    await org.page.click('#elencoAppuntamenti .allegato [data-togli]');
    await org.page.waitForFunction(() => (appuntamenti || []).length === 1, null, { timeout: 15_000 });
    await org.page.evaluate(() => renderMenu());

    confrontaNumero('ne resta una sul server', 1, db.allegati.length);
    confrontaNumero('e una nella pagina', 1, (await righe(org.page)).length);

    await org.contesto.close();
  });
});

test.describe('Quello che non ci può stare', () => {
  test('un file troppo grosso o del tipo sbagliato non parte, e lo dice', async ({ browser }) => {
    const db = nuovoServer();
    const org = await dispositivo(browser, db);
    await accediNellaApp(org.page);
    await conUnaGara(org.page, 'Stradolcetto');
    await apriAppuntamenti(org.page);

    await appendi(org.page, {
      name: 'filmato.mp4', mimeType: 'video/mp4', buffer: Buffer.from('non un video vero'),
    });
    await appendi(org.page, {
      name: 'enorme.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(6 * 1024 * 1024, 0x20),
    });

    confrontaNumero('non deve partire niente', 0, db.allegati.length);
    const detto = await avvisi(org.page);
    expect(detto, 'dice quale era troppo grosso').toContain('enorme.pdf');
    expect(detto, 'e quale era del tipo sbagliato').toContain('filmato.mp4');
    expect(detto, 'con il limite scritto in chiaro').toContain('5 MB');

    await org.contesto.close();
  });

  test('senza rete lo dice, invece di sembrare vuota', async ({ browser }) => {
    const db = nuovoServer();
    const gente = await dispositivo(browser, db);
    db.giu = true;
    await apriAppuntamenti(gente.page);

    const testo = await gente.page.evaluate(() =>
      document.querySelector('#menuCorpo').textContent);
    expect(testo, 'dice che serve la connessione').toMatch(/connessione|raggiungibil/i);
    expect(testo, 'e che il resto funziona lo stesso').toMatch(/cronometro|Riprova/i);
    for (const brutta of ['undefined', 'NaN', 'TypeError', 'Failed to fetch']) {
      expect(testo, `"${brutta}" non deve comparire in faccia a nessuno`).not.toContain(brutta);
    }

    // e tornata la rete, Riprova funziona
    db.giu = false;
    await gente.page.click('#menuCorpo button:text-is("Riprova")');
    await gente.page.waitForFunction(() => appuntamentiErrore === null, null, { timeout: 15_000 });
    await gente.page.evaluate(() => renderMenu());
    expect(await gente.page.evaluate(() =>
      document.querySelector('#menuCorpo').textContent), 'e la pagina si apre')
      .toContain('Locandine');

    await gente.contesto.close();
  });
});
