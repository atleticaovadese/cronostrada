'use strict';
/*
 * IL MENU DELLE DUE PORTE
 *
 * Due vincoli vengono prima di qualsiasi comodità, e sono quelli che questi
 * test difendono:
 *
 *   1. il menu non si mette mai fra chi cronometra e il traguardo;
 *   2. il menu non aspetta mai la rete.
 *
 * Più la parte delicata: chi aveva una gara nel formato vecchio non deve
 * perderla.
 */

const { test, expect } = require('@playwright/test');
const { apriApp, confrontaNumero } = require('./aiuto');

/** Apre la app SENZA entrare in una gara: qui si vuole vedere il menu. */
async function apriAlMenu(page) {
  page.on('dialog', d => d.accept().catch(() => { }));
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);
}

test.describe('Il menu non si mette fra chi cronometra e il traguardo', () => {
  test('con una gara IN CORSO la app si apre sugli Arrivi, saltando il menu', async ({ page }) => {
    // È il vincolo che conta più di tutti: allo sparo non si tocca niente
    // prima di poter registrare, e un telefono che si riavvia al traguardo
    // torna esattamente dov'era.
    await apriApp(page);
    await page.evaluate(() => {
      S.cfg.nome = 'Gara in corso';
      S.iscritti = [{
        id: nid(), pett: 7, cognome: 'ROSSI', nome: 'MARCO', sesso: 'M',
        societa: 'ATL', nascita: '1990-01-01', conferma: 'S',
      }];
      touched(); go('traguardo');
    });
    await page.click('#btnStart');
    await page.evaluate(() => { segnaArrivo(7); });

    const inCorso = await page.evaluate(() => !!S.start && !S.stop);
    expect(inCorso, 'la gara risulta in corso').toBe(true);

    await page.reload();
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);

    const r = await page.evaluate(() => ({
      schermata: ui.schermata,
      vista: ui.view,
      menuVisibile: getComputedStyle(document.querySelector('#menu')).display !== 'none',
      cronometroVisibile: document.querySelector('#clock').offsetHeight > 0,
      arrivi: S.arrivi.length,
    }));

    if (r.schermata !== 'app' || r.vista !== 'traguardo') {
      throw new Error(
        `\nCon una gara in corso la app si è aperta su "${r.schermata}/${r.vista}" ` +
        `invece che direttamente sugli Arrivi.\n\n` +
        `  Allo sparo non si deve toccare niente prima di poter registrare, e\n` +
        `  un telefono che si riavvia al traguardo deve tornare dov'era.\n`);
    }
    expect(r.menuVisibile, 'il menu non deve nemmeno comparire').toBe(false);
    expect(r.cronometroVisibile, 'il cronometro è già lì').toBe(true);
    confrontaNumero("e l'arrivo registrato prima", 1, r.arrivi);

    // e si registra subito, senza passaggi intermedi
    await page.click('#btnArrivo');
    confrontaNumero('arrivi dopo una pressione immediata', 2,
      await page.evaluate(() => S.arrivi.length));
  });

  test('con una gara FERMA si torna al menu', async ({ page }) => {
    await apriApp(page);
    await page.evaluate(() => {
      S.cfg.nome = 'Gara finita';
      S.start = Date.now() - 3600000;
      S.stop = Date.now() - 60000;      // ferma
      S.arrivi = [{ id: nid(), pett: 1, ms: 1000, corr: 0 }];
      touched();
    });
    await page.reload();
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);

    const r = await page.evaluate(() => ({
      schermata: ui.schermata,
      nelMenu: document.body.classList.contains('inMenu'),
      gare: elencoGare().length,
    }));
    expect(r.schermata, 'a gara ferma si sceglie dal menu').toBe('menu');
    expect(r.nelMenu).toBe(true);
    expect(r.gare, 'e la gara è nell\'elenco').toBeGreaterThanOrEqual(1);
  });
});

test.describe('Il menu non aspetta la rete', () => {
  test('l\'elenco locale compare anche in modalità aereo', async ({ page, context }) => {
    await apriApp(page);
    await page.evaluate(() => {
      S.cfg.nome = 'Stradolcetto offline'; S.cfg.data = '2026-09-14';
      S.iscritti = [{ id: nid(), pett: 1, cognome: 'A', nome: 'B', sesso: 'M', societa: 'X', nascita: '1990-01-01', conferma: 'S' }];
      S.arrivi = [{ id: nid(), pett: 1, ms: 1000, corr: 0 }];
      touched();
      tornaAlMenu('organizzatore');
    });

    await context.setOffline(true);
    const t0 = Date.now();
    await page.evaluate(() => { renderMenu(); });
    const r = await page.evaluate(() => ({
      righe: document.querySelectorAll('#elencoGare .garariga').length,
      testo: document.querySelector('#menuCorpo').textContent,
    }));
    const impiegato = Date.now() - t0;

    expect(r.righe, "l'elenco locale c'è anche senza rete").toBeGreaterThanOrEqual(1);
    expect(r.testo, 'con il nome della gara').toContain('Stradolcetto offline');
    expect(r.testo, 'e il conteggio degli arrivi').toMatch(/1 arrivo/);
    expect(impiegato, "e compare subito, senza aspettare nessuno").toBeLessThan(1500);
    await context.setOffline(false);
  });

  test('la porta Live senza rete lo dice, invece di restare a girare a vuoto', async ({ page, context }) => {
    await apriApp(page);
    await context.setOffline(true);
    await page.evaluate(async () => { tornaAlMenu('live'); await caricaLive(); });
    await page.waitForTimeout(300);

    const testo = await page.evaluate(() => document.querySelector('#menuCorpo').textContent);
    expect(testo, 'deve spiegare che serve la connessione').toContain('serve la connessione');
    expect(testo, 'e ricordare che il resto funziona lo stesso').toContain('senza rete');
    expect(testo, 'senza mostrare un errore tecnico').not.toMatch(/error|failed|undefined|\[object/i);

    // e da lì si torna all'elenco locale, che funziona
    await page.evaluate(() => { tornaAlMenu('organizzatore'); });
    expect(await page.evaluate(() => document.querySelector('#menuCorpo').textContent),
      "l'altra porta continua a funzionare").toContain('Le tue gare');
    await context.setOffline(false);
  });
});

test.describe('Più gare in locale', () => {
  test('se ne creano, si aprono e restano separate', async ({ page }) => {
    await apriApp(page);

    const r = await page.evaluate(() => {
      // prima gara
      S.cfg.nome = 'Prima'; S.cfg.data = '2026-05-01';
      S.arrivi = [{ id: nid(), pett: 1, ms: 1000, corr: 0 }];
      touched();
      const primaId = S.garaId;

      // seconda, creata dal menu
      nuovaGara();
      S.cfg.nome = 'Seconda'; S.cfg.data = '2026-06-01';
      S.arrivi = [{ id: nid(), pett: 2, ms: 2000, corr: 0 }, { id: nid(), pett: 3, ms: 3000, corr: 0 }];
      touched();
      const secondaId = S.garaId;

      const elenco = elencoGare();

      // si torna alla prima
      apriGara(primaId);
      const dopoRitorno = { nome: S.cfg.nome, arrivi: S.arrivi.length, id: S.garaId };

      // e di nuovo alla seconda
      apriGara(secondaId);
      const dopoSeconda = { nome: S.cfg.nome, arrivi: S.arrivi.length, id: S.garaId };

      return {
        quante: elenco.length,
        nomi: elenco.map(g => g.nome).sort(),
        conteggi: elenco.map(g => `${g.nome}:${g.arrivi}`).sort(),
        dopoRitorno, dopoSeconda, primaId, secondaId,
      };
    });

    confrontaNumero('gare nell\'elenco', 2, r.quante);
    expect(r.nomi).toEqual(['Prima', 'Seconda']);
    expect(r.conteggi, 'ognuna con i suoi arrivi').toEqual(['Prima:1', 'Seconda:2']);

    expect(r.dopoRitorno.nome, 'riaprendo la prima si ritrova la prima').toBe('Prima');
    confrontaNumero('con il suo arrivo', 1, r.dopoRitorno.arrivi);
    expect(r.dopoSeconda.nome, 'e la seconda resta la seconda').toBe('Seconda');
    confrontaNumero('con i suoi due', 2, r.dopoSeconda.arrivi);
    expect(r.dopoRitorno.id).not.toBe(r.dopoSeconda.id);
  });

  test('eliminare una gara è difficile per sbaglio e dice quanti arrivi cancella', async ({ page }) => {
    await apriApp(page);
    await page.evaluate(() => {
      S.cfg.nome = 'Da eliminare';
      S.iscritti = Array.from({ length: 40 }, () => ({ id: nid(), pett: 1, cognome: 'A', nome: 'B', sesso: 'M', societa: '', nascita: '1990-01-01', conferma: 'S' }));
      S.arrivi = Array.from({ length: 37 }, () => ({ id: nid(), pett: null, ms: 1, corr: 0 }));
      touched();
      tornaAlMenu('organizzatore');
    });

    await page.click('#elencoGare .garariga [data-elimina]');

    // Primo avviso: deve dire quanti arrivi si stanno buttando via.
    await expect(page.locator('#dlgConfirm')).toBeVisible();
    const avviso = await page.locator('#cfMsg').textContent();
    expect(avviso, "l'avviso deve dire quanti arrivi si cancellano").toContain('37');
    expect(avviso, 'e quanti iscritti').toContain('40');
    expect(avviso, 'e ricordare il backup').toMatch(/backup/i);

    // Rinunciando non si cancella niente.
    await page.click('#cfNo');
    confrontaNumero('gare dopo aver rinunciato', 1,
      await page.evaluate(() => elencoGare().length));

    // Seconda barriera: bisogna scrivere ELIMINA.
    await page.click('#elencoGare .garariga [data-elimina]');
    await page.click('#cfYes');
    await expect(page.locator('#dlgConfirm')).toBeVisible();
    expect(await page.locator('#cfMsg').textContent(),
      'la seconda conferma chiede di scrivere una parola').toContain('ELIMINA');

    // Parola sbagliata: non si cancella.
    await page.fill('#dlgConfirm input', 'si');
    await page.click('#cfYes');
    confrontaNumero('gare dopo la parola sbagliata', 1,
      await page.evaluate(() => elencoGare().length));

    // Parola giusta: si cancella.
    await page.click('#elencoGare .garariga [data-elimina]');
    await page.click('#cfYes');
    await page.fill('#dlgConfirm input', 'elimina');
    await page.click('#cfYes');
    confrontaNumero('gare dopo la conferma completa', 0,
      await page.evaluate(() => elencoGare().length));
  });
});

test.describe('Chi aveva una gara nel formato vecchio non la perde', () => {
  test('si apre intatta, con tutti i suoi arrivi e iscritti', async ({ page }) => {
    await apriApp(page);

    // Una gara salvata dalla versione precedente: una chiave sola, nessun
    // elenco, identificativi vecchi, niente garaId né sessione.
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('cronostrada.v1', JSON.stringify({
        v: 1,
        cfg: {
          nome: '7ª Stradolcetto', data: '2025-09-14', luogo: 'Ovada', km: 10,
          anno: 2025, org: 'A.S.D. Prova',
          premAssF: 3, premAssM: 3, premCat: 3, premSoc: 3, socEscluse: ['RUNCARD'],
        },
        matrice: [{ nome: 'SM45', fidal: ['SM45'], premi: 3 }],
        iscritti: [
          { id: 'x1aaa', pett: 126, cognome: 'ROSSI', nome: 'MARCO', sesso: 'M', societa: 'ATL. NOVESE', nascita: '1984-03-12', conferma: 'S' },
          { id: 'x2bbb', pett: 117, cognome: 'VOLPI', nome: 'LUCA', sesso: 'M', societa: 'RUNCARD', nascita: '1968-02-08', conferma: 'S' },
        ],
        arrivi: [
          { id: 'x3ccc', pett: 126, ms: 2039680, corr: 0 },
          { id: 'x4ddd', pett: 117, ms: 2057440, corr: 0 },
        ],
        start: Date.now() - 7200000,
        stop: Date.now() - 3600000,
        dnf: [117],
      }));
    });

    await page.reload();
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);

    const r = await page.evaluate(() => ({
      schermata: ui.schermata,
      elenco: elencoGare().map(g => ({ nome: g.nome, arrivi: g.arrivi, iscritti: g.iscritti })),
      // la gara vecchia è quella attiva: si guarda dentro
      nome: S.cfg.nome, data: S.cfg.data, luogo: S.cfg.luogo, km: S.cfg.km, anno: S.cfg.anno,
      iscritti: S.iscritti.length,
      arrivi: S.arrivi.length,
      pettorali: S.arrivi.map(a => a.pett),
      tempi: S.arrivi.map(a => a.ms),
      dnf: S.dnf,
      matrice: S.matrice.length,
      // e ha preso il formato nuovo
      versione: S.v, garaOk: eUuid(S.garaId),
      idsOk: S.iscritti.every(i => eUuid(i.id)) && S.arrivi.every(a => eUuid(a.id)),
      sessione: S.sessione, scarto: S.scartoPartenza,
    }));

    // Compare nel menu con i suoi numeri
    expect(r.elenco.length, 'la gara vecchia compare nel menu').toBe(1);
    expect(r.elenco[0].nome).toBe('7ª Stradolcetto');
    confrontaNumero('arrivi mostrati nel menu', 2, r.elenco[0].arrivi);
    confrontaNumero('iscritti mostrati nel menu', 2, r.elenco[0].iscritti);

    // E dentro è tutta lì
    expect(r.nome).toBe('7ª Stradolcetto');
    expect(r.data).toBe('2025-09-14');
    expect(r.luogo).toBe('Ovada');
    confrontaNumero('chilometri', 10, r.km);
    confrontaNumero('anno di riferimento', 2025, r.anno);
    confrontaNumero('iscritti', 2, r.iscritti);
    confrontaNumero('arrivi', 2, r.arrivi);
    expect(r.pettorali, 'con i loro pettorali').toEqual([126, 117]);
    expect(r.tempi, 'e i loro tempi al millisecondo').toEqual([2039680, 2057440]);
    expect(r.dnf, 'i ritirati').toEqual([117]);
    confrontaNumero('le fasce', 1, r.matrice);

    // convertita al formato nuovo
    confrontaNumero('versione del formato', 2, r.versione);
    expect(r.garaOk, 'con un identificativo di gara valido').toBe(true);
    expect(r.idsOk, 'e tutti gli identificativi convertiti in UUID').toBe(true);
    confrontaNumero('sessione', 1, r.sessione);
    confrontaNumero('scarto partenza', 0, r.scarto);
  });

  test('e i backup continuano a funzionare come prima', async ({ page }) => {
    await apriApp(page);
    const json = await page.evaluate(() => {
      S.cfg.nome = 'Gara da salvare';
      S.iscritti = [{ id: nid(), pett: 5, cognome: 'ROSSI', nome: 'MARCO', sesso: 'M', societa: 'ATL', nascita: '1990-01-01', conferma: 'S' }];
      S.arrivi = [{ id: nid(), pett: 5, ms: 1234567, corr: 0 }];
      touched();
      return JSON.stringify(S);          // è quello che scrive "Scarica backup .json"
    });

    // e si ricarica, come fa "Carica backup .json"
    const r = await page.evaluate(testo => {
      const d = JSON.parse(testo);
      S = Object.assign(VUOTO(), d);
      S.cfg = Object.assign(VUOTO().cfg, d.cfg);
      touched();
      return { nome: S.cfg.nome, arrivi: S.arrivi.length, ms: S.arrivi[0].ms, iscritti: S.iscritti.length };
    }, json);

    expect(r.nome).toBe('Gara da salvare');
    confrontaNumero('arrivi dal backup', 1, r.arrivi);
    confrontaNumero('tempo dal backup', 1234567, r.ms);
    confrontaNumero('iscritti dal backup', 1, r.iscritti);
  });
});
