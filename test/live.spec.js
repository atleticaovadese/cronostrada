'use strict';
/*
 * LA PORTA LIVE, DALLA PARTE DEL PUBBLICO
 *
 * Chi entra da qui non ha un account, non ne vuole uno, e spesso sta in
 * piedi in mezzo alla strada con mezza tacca di segnale. Vede una cosa sola:
 * le gare che un organizzatore ha deciso di rendere pubbliche, e la loro
 * classifica.
 *
 * IL CONTESTO DI QUESTI TEST È DAVVERO ANONIMO. Un contesto del browser suo,
 * senza memoria e senza sessione, che non fa mai l'accesso. Le richieste
 * partono con la sola chiave pubblicabile, come da un telefono qualunque.
 * Il server finto si comporta come le politiche in 0002 e le viste in 0003:
 * per chi non è collegato le tabelle non esistono, esistono solo
 * live_gare e live_risultati, e mostrano solo le gare pubblicate.
 *
 * QUATTRO COSE CHE NON DEVONO SUCCEDERE MAI:
 *   - che il pubblico veda una gara non pubblicata;
 *   - che trovi un pulsante che modifica qualcosa;
 *   - che raggiunga l'anagrafica, cioè le date di nascita;
 *   - che senza rete gli compaia un errore invece di una spiegazione.
 */

const { test, expect } = require('@playwright/test');
const { confrontaNumero } = require('./aiuto');
const { nuovoServer, montaServerFinto, accediNellaApp, attendiCodaVuota } =
  require('./finto-server');

/** L'organizzatore: contesto suo, con l'accesso fatto. */
async function organizzatore(browser, db) {
  const contesto = await browser.newContext();
  await montaServerFinto(contesto, db);
  const page = await contesto.newPage();
  page.on('dialog', d => d.accept().catch(() => { }));
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);
  await accediNellaApp(page);
  return { contesto, page };
}

/** Il pubblico: contesto suo, nessun accesso, mai. */
async function pubblico(browser, db, opzioni = {}) {
  const contesto = await browser.newContext(opzioni);
  await montaServerFinto(contesto, db);
  const page = await contesto.newPage();
  page.on('dialog', d => d.accept().catch(() => { }));
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);
  const collegato = await page.evaluate(() => !!(typeof sessione !== 'undefined' && sessione));
  expect(collegato, 'il pubblico non deve avere nessuna sessione').toBe(false);
  return { contesto, page };
}

/** Entra dalla porta Live premendo la casella, come farebbe chiunque. */
async function entraInLive(page) {
  // Sempre dalle due caselle: dentro una pagina del menu le caselle sono
  // nascoste, ed è premendo la casella che la porta si ricarica da capo.
  await page.evaluate(() => tornaAlMenu('porte'));
  await page.click('#porte .porta[data-p="live"]');
  await page.waitForFunction(() => liveGare !== null, null, { timeout: 15_000 });
  await page.evaluate(() => renderMenu());
}

/** Prepara una gara con arrivi e la manda sul server. */
async function garaConArrivi(page, nome, quanti, { inCorso = false } = {}) {
  const id = await page.evaluate(async ({ nome, quanti, inCorso }) => {
    nuovaGara();
    S.cfg.nome = nome; S.cfg.data = '2026-09-14'; S.cfg.luogo = 'Ovada';
    S.cfg.km = 10; S.cfg.org = 'ASD Atletica Ovadese';
    S.iscritti = Array.from({ length: quanti + 4 }, (_, i) => ({
      id: nid(), pett: i + 1, cognome: ['ROSSI', 'BIANCHI', 'VERDI', 'NERI'][i % 4],
      nome: ['LUCA', 'MARTA', 'PAOLO', 'ANNA'][i % 4] + ' ' + (i + 1),
      sesso: i % 2 ? 'F' : 'M', societa: 'ATL. OVADESE',
      nascita: (1975 + (i % 30)) + '-04-11', conferma: 'S',
    }));
    S.start = Date.now() - 45 * 60_000;
    S.arrivi = Array.from({ length: quanti }, (_, i) => ({
      id: nid(), pett: i + 1, ms: 33 * 60_000 + i * 17_000, corr: 0,
    }));
    if (!inCorso) S.stop = Date.now();
    touched();
    await sincronizzaSubito();
    return S.garaId;
  }, { nome, quanti, inCorso });
  await attendiCodaVuota(page, 60_000);
  return id;
}

/** Preme la casella "Pubblica questa gara in Live", come si fa davvero. */
async function pubblica(page, acceso) {
  await page.evaluate(() => { entraNellaApp('gara'); go('gara'); });
  const casella = page.locator('#syncBox input[type=checkbox]').first();
  await expect(casella).toBeVisible();
  if (await casella.isChecked() !== acceso) await casella.click();
  await expect(casella).toBeChecked({ checked: acceso });
  await attendiCodaVuota(page, 60_000);
}

/** Aggiunge arrivi a gara in corso e ripubblica la classifica. */
async function altriArrivi(page, quanti) {
  await page.evaluate(async n => {
    const base = S.arrivi.length;
    for (let i = 0; i < n; i++) {
      S.arrivi.push({ id: nid(), pett: base + i + 1, ms: 33 * 60_000 + (base + i) * 17_000, corr: 0 });
    }
    touched();
    await sincronizzaSubito();
    await pubblicaClassifica(true);
  }, quanti);
  await attendiCodaVuota(page, 60_000);
}

const righeLive = page => page.evaluate(() =>
  Array.from(document.querySelectorAll('#elencoLive .garariga')).map(r => ({
    nome: r.querySelector('.gnome').textContent,
    sotto: r.querySelector('.gsotto').textContent,
    inCorso: !!r.querySelector('.garacorsa'),
  })));

const classificaLive = page => page.evaluate(() =>
  Array.from(document.querySelectorAll('#liveTabella tbody tr')).map(tr =>
    Array.from(tr.querySelectorAll('td')).map(td => td.textContent)));

test.describe('Il pubblico vede solo quello che è stato pubblicato', () => {
  test('una gara non pubblicata non compare, pubblicata sì, ritirata sparisce', async ({ browser }) => {
    test.setTimeout(120_000);
    const db = nuovoServer();

    const org = await organizzatore(browser, db);
    await garaConArrivi(org.page, '7ª Stradolcetto', 6);

    // --- PRIMA: la gara esiste sul server ma non è pubblicata
    const gente = await pubblico(browser, db);
    await entraInLive(gente.page);
    confrontaNumero('gare visibili al pubblico prima della pubblicazione', 0,
      (await righeLive(gente.page)).length);
    const testoVuoto = await gente.page.evaluate(() => document.querySelector('#menuCorpo').textContent);
    expect(testoVuoto, 'e lo dice con una frase, non con un errore')
      .toContain('Nessuna gara pubblicata');

    // --- L'ORGANIZZATORE PUBBLICA
    await pubblica(org.page, true);

    // --- ADESSO IL PUBBLICO LA VEDE
    await entraInLive(gente.page);
    const elenco = await righeLive(gente.page);
    expect(elenco.map(r => r.nome), 'la gara pubblicata compare').toEqual(['7ª Stradolcetto']);
    expect(elenco[0].sotto, 'con quello che si legge su una locandina')
      .toContain('ASD Atletica Ovadese');

    // --- E LA SUA CLASSIFICA
    await gente.page.click('#elencoLive .garariga');
    await gente.page.waitForFunction(() => liveRisultati !== null, null, { timeout: 15_000 });
    await gente.page.evaluate(() => renderMenu());
    const cls = await classificaLive(gente.page);
    confrontaNumero('classificati visti dal pubblico', 6, cls.length);
    expect(cls[0][0], 'il primo è primo').toBe('1');
    // mm:ss sotto l'ora, hh:mm:ss sopra: sono i 33 minuti della gara vera
    expect(cls[0][6], 'e ha un tempo leggibile').toMatch(/^(\d+:)?\d{1,2}:\d{2}$/);

    // --- L'ORGANIZZATORE RITIRA LA PUBBLICAZIONE
    await pubblica(org.page, false);

    // --- IL PUBBLICO NON LA TROVA PIÙ
    await entraInLive(gente.page);
    confrontaNumero('gare visibili dopo il ritiro', 0, (await righeLive(gente.page)).length);

    // e nemmeno andando dritti alla sua classifica
    const dopoRitiro = await gente.page.evaluate(async id => {
      liveRisultati = null;
      await caricaClassificaPubblica(id);
      return (liveRisultati || []).length;
    }, await org.page.evaluate(() => S.garaId));
    confrontaNumero('righe di classifica raggiungibili dopo il ritiro', 0, dopoRitiro);

    await org.contesto.close(); await gente.contesto.close();
  });

  test('la classifica di una gara in corso si aggiorna da sola', async ({ browser }) => {
    /* Il giro di aggiornamento è ogni venti secondi, quindi questo test
       aspetta davvero. Non lo si accorcia: "si aggiorna da sola" vuol dire
       che nessuno tocca niente, e l'unico modo di provarlo è non toccare
       niente e guardare. */
    test.setTimeout(150_000);
    const db = nuovoServer();

    const org = await organizzatore(browser, db);
    await garaConArrivi(org.page, 'Corrilanga', 4, { inCorso: true });
    await pubblica(org.page, true);

    const gente = await pubblico(browser, db);
    await entraInLive(gente.page);
    const elenco = await righeLive(gente.page);
    expect(elenco[0].inCorso, 'la gara risulta in corso anche al pubblico').toBe(true);

    await gente.page.click('#elencoLive .garariga');
    await gente.page.waitForFunction(() => liveRisultati !== null, null, { timeout: 15_000 });
    await gente.page.evaluate(() => renderMenu());
    confrontaNumero('classificati al primo sguardo', 4, (await classificaLive(gente.page)).length);

    // L'orologio deve essere partito: è quello che fa il lavoro.
    expect(await gente.page.evaluate(() => orologioLive !== null),
      "a gara in corso l'aggiornamento automatico deve essere attivo").toBe(true);

    // Al traguardo arrivano altri tre. Dalla parte del pubblico NESSUNO
    // tocca niente: né un tasto, né un ricaricamento.
    await altriArrivi(org.page, 3);

    await gente.page.waitForFunction(
      () => document.querySelectorAll('#liveTabella tbody tr').length === 7,
      null, { timeout: 60_000 });
    const cls = await classificaLive(gente.page);
    confrontaNumero('classificati dopo i nuovi arrivi, senza toccare niente', 7, cls.length);
    expect(cls.map(r => r[0]), 'e le posizioni sono in fila')
      .toEqual(['1', '2', '3', '4', '5', '6', '7']);

    // Uscendo dalla pagina l'orologio si ferma: nessuna richiesta a vuoto.
    await gente.page.evaluate(() => { tornaAlMenu('porte'); });
    expect(await gente.page.evaluate(() => orologioLive === null),
      "uscendo da Live l'orologio si deve fermare").toBe(true);

    await org.contesto.close(); await gente.contesto.close();
  });
});

test.describe('In Live non si tocca niente', () => {
  test('nessun campo e nessun pulsante che modifichi qualcosa', async ({ browser }) => {
    test.setTimeout(120_000);
    const db = nuovoServer();
    const org = await organizzatore(browser, db);
    await garaConArrivi(org.page, 'Stradolcetto', 5);
    await pubblica(org.page, true);

    const gente = await pubblico(browser, db);
    await entraInLive(gente.page);
    await gente.page.click('#elencoLive .garariga');
    await gente.page.waitForFunction(() => liveRisultati !== null, null, { timeout: 15_000 });
    await gente.page.evaluate(() => renderMenu());

    const dentro = await gente.page.evaluate(() => {
      const menu = document.querySelector('#menuCorpo');
      return {
        campi: menu.querySelectorAll('input, textarea, select').length,
        pulsanti: Array.from(menu.querySelectorAll('button')).map(b => b.textContent.trim()),
        topbarVisibile: getComputedStyle(document.querySelector('#top')).display !== 'none',
      };
    });

    confrontaNumero('campi modificabili nella pagina Live', 0, dentro.campi);
    // Restano solo il passo indietro e, nell'elenco, "Aggiorna": nessuno dei
    // due cambia un dato, e non c'è nessuna riga da premere per correggere.
    const sospetti = dentro.pulsanti.filter(t =>
      /salva|elimina|modifica|pubblica|nuova|accedi|esci|carica|backup|start|stop|azzera/i.test(t));
    if (sospetti.length) {
      throw new Error('\nNella pagina Live compaiono pulsanti che modificano qualcosa:\n' +
        sospetti.map(t => '  ' + t).join('\n') +
        '\n\n  Live è sola lettura: chi guarda da fuori non deve poter toccare\n' +
        '  la gara di nessuno, nemmeno per sbaglio.\n');
    }

    await org.contesto.close(); await gente.contesto.close();
  });

  test('sul telefono il tempo si legge senza trascinare la tabella di lato', async ({ browser }) => {
    /* Trovato guardando uno scatto, non con un test: con sette colonne su
       390 punti la colonna del tempo finiva fuori dallo schermo, e il tempo
       è la cosa per cui uno apre la pagina stando a bordo strada. Adesso
       società e fascia scendono sotto il nome. */
    test.setTimeout(120_000);
    const db = nuovoServer();
    const org = await organizzatore(browser, db);
    await garaConArrivi(org.page, 'Stradolcetto', 5);
    await pubblica(org.page, true);

    const gente = await pubblico(browser, db, { viewport: { width: 390, height: 844 } });
    await entraInLive(gente.page);
    await gente.page.click('#elencoLive .garariga');
    await gente.page.waitForFunction(() => liveRisultati !== null, null, { timeout: 15_000 });
    await gente.page.evaluate(() => renderMenu());

    const misura = await gente.page.evaluate(() => {
      const box = document.querySelector('#liveTabella');
      const riga = document.querySelector('#liveTabella tbody tr');
      const tempo = riga.lastElementChild;
      const r = tempo.getBoundingClientRect();
      return {
        testo: tempo.textContent,
        destra: Math.round(r.right),
        larghezzaFinestra: window.innerWidth,
        daTrascinare: box.scrollWidth - box.clientWidth,
        societaVisibile: !!riga.querySelector('.sottonome'),
      };
    });

    if (misura.daTrascinare > 1 || misura.destra > misura.larghezzaFinestra) {
      throw new Error(
        `\nIl tempo non si legge senza trascinare la classifica di lato:\n` +
        `  il tempo "${misura.testo}" finisce a ${misura.destra}, ` +
        `lo schermo arriva a ${misura.larghezzaFinestra}\n` +
        `  la tabella andrebbe trascinata di ${misura.daTrascinare} punti\n\n` +
        "  Chi guarda da bordo strada vuole due cose: chi è arrivato e in che\n" +
        '  tempo. Se il tempo è fuori schermo, la pagina non serve a niente.\n');
    }
    expect(misura.testo, 'e il tempo c\'è davvero').toMatch(/^(\d+:)?\d{1,2}:\d{2}$/);
    expect(misura.societaVisibile, 'la società non si perde: scende sotto il nome').toBe(true);

    await org.contesto.close(); await gente.contesto.close();
  });

  test("il pubblico non raggiunge l'anagrafica, nemmeno chiedendola", async ({ browser }) => {
    const db = nuovoServer();
    const org = await organizzatore(browser, db);
    await garaConArrivi(org.page, 'Stradolcetto', 3);
    await pubblica(org.page, true);

    const gente = await pubblico(browser, db);
    const esiti = await gente.page.evaluate(async () => {
      const prova = async percorso => {
        try {
          const r = await fetch(`${SUPA.url}/rest/v1/${percorso}`, {
            headers: {
              apikey: SUPA.chiave, Authorization: 'Bearer ' + SUPA.chiave,
              'Accept-Profile': SUPA.schema,
            },
          });
          const corpo = await r.text();
          return { percorso, stato: r.status, righe: corpo.startsWith('[') ? JSON.parse(corpo).length : null };
        } catch (e) { return { percorso, stato: 'errore', righe: null }; }
      };
      return [
        await prova('iscritti?select=cognome,nascita'),
        await prova('arrivi?select=ms'),
        await prova('configurazione?select=partenza_ms'),
        await prova('gare?select=proprietario'),
        await prova('live_gare?select=id'),
        await prova('live_risultati?select=pos'),
      ];
    });

    const letti = esiti.filter(e => e.righe !== null && e.righe > 0).map(e => e.percorso);
    const vietati = letti.filter(p => !p.startsWith('live_'));
    if (vietati.length) {
      throw new Error(
        '\nIl pubblico anonimo ha letto delle righe da qui:\n' +
        vietati.map(p => '  ' + p).join('\n') +
        '\n\n  Al pubblico si dà una vista dedicata, mai le tabelle. Le date di\n' +
        '  nascita non devono essere raggiungibili in alcun modo.\n');
    }
    expect(letti, 'le due viste invece si leggono, ed è tutto il resto che no')
      .toEqual(['live_gare?select=id', 'live_risultati?select=pos']);

    await org.contesto.close(); await gente.contesto.close();
  });
});

test.describe('Senza rete Live lo dice, invece di sembrare rotta', () => {
  test('un messaggio che spiega, non un errore', async ({ browser }) => {
    test.setTimeout(120_000);
    const db = nuovoServer();
    const org = await organizzatore(browser, db);
    await garaConArrivi(org.page, 'Stradolcetto', 3);
    await pubblica(org.page, true);

    const gente = await pubblico(browser, db);
    db.giu = true;                       // la rete cade
    await gente.page.evaluate(() => { tornaAlMenu('porte'); });
    await gente.page.click('#porte .porta[data-p="live"]');
    await gente.page.waitForFunction(() => liveErrore !== null, null, { timeout: 15_000 });
    await gente.page.evaluate(() => renderMenu());

    const testo = await gente.page.evaluate(() => document.querySelector('#menuCorpo').textContent);
    expect(testo, 'dice che serve la connessione').toMatch(/connessione|raggiungibil/i);
    expect(testo, 'e dice cosa continua a funzionare senza rete')
      .toMatch(/senza rete|Organizzatore|Riprova/i);
    for (const brutta of ['undefined', 'NaN', 'TypeError', 'Failed to fetch', 'HTTP 5']) {
      expect(testo, `"${brutta}" non deve comparire in faccia a nessuno`).not.toContain(brutta);
    }
    expect(await gente.page.evaluate(() => !!document.querySelector('#menuCorpo .banner.bad')),
      'nessun riquadro rosso: non è un guasto, è una spiegazione').toBe(false);

    // e tornata la rete, il pulsante Riprova funziona
    db.giu = false;
    await gente.page.click('#menuCorpo button:text-is("Riprova")');
    await gente.page.waitForFunction(() => liveGare !== null && liveErrore === null,
      null, { timeout: 15_000 });
    await gente.page.evaluate(() => renderMenu());
    confrontaNumero('gare visibili dopo aver ripreso la rete', 1,
      (await righeLive(gente.page)).length);

    await org.contesto.close(); await gente.contesto.close();
  });
});
