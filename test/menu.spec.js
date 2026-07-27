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

/** Percorre il menu fino all'elenco delle gare, passando dall'accesso.
 *  È la strada che fa chiunque: casella Organizzatore, poi si sceglie se
 *  accedere o continuare senza account. */
async function vaiAllElencoGare(page) {
  await page.evaluate(() => { tornaAlMenu('porte'); });
  await page.click('#porte .porta[data-p="organizzatore"]');
  const accesso = await page.locator('#btnSenzaAccount').count();
  if (accesso) await page.click('#btnSenzaAccount');
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

test.describe('La struttura: due caselle, poi le pagine', () => {
  test('il menu ha soltanto le due caselle, niente altro', async ({ page }) => {
    await apriAlMenu(page);
    const r = await page.evaluate(() => ({
      pagina: ui.porta,
      caselle: [...document.querySelectorAll('#porte .portaTitolo')].map(x => x.textContent),
      casellevisibili: getComputedStyle(document.querySelector('#porte')).display !== 'none',
      corpo: document.querySelector('#menuCorpo').textContent.trim(),
      elenchi: document.querySelectorAll('#elencoGare, #elencoLive').length,
      barraApp: getComputedStyle(document.querySelector('#top')).display,
    }));
    expect(r.caselle, 'due caselle, in questo ordine').toEqual(['Organizzatore', 'Live']);
    expect(r.casellevisibili).toBe(true);
    expect(r.corpo, 'e sotto non c\'è nient\'altro').toBe('');
    expect(r.elenchi, 'nessun elenco di gare nel menu principale').toBe(0);
    expect(r.barraApp, 'e la app resta dietro').toBe('none');
  });

  test('Organizzatore chiede l\'account, e da lì si arriva alle gare', async ({ page }) => {
    await apriAlMenu(page);
    await page.click('#porte .porta[data-p="organizzatore"]');

    const accesso = await page.evaluate(() => ({
      pagina: ui.porta,
      caselle: getComputedStyle(document.querySelector('#porte')).display !== 'none',
      form: !!document.querySelector('#accessoOrganizzatore'),
      campi: document.querySelectorAll('#accessoOrganizzatore input').length,
      senzaAccount: !!document.querySelector('#btnSenzaAccount'),
      elencoGia: !!document.querySelector('#elencoGare'),
    }));
    expect(accesso.pagina).toBe('organizzatore');
    expect(accesso.caselle, 'le caselle spariscono: è una pagina a sé').toBe(false);
    expect(accesso.form, "chiede l'account").toBe(true);
    expect(accesso.campi, 'email e password').toBe(2);
    expect(accesso.elencoGia, 'e le gare non si vedono prima di decidere').toBe(false);

    /* La via d'uscita che non deve mancare mai: una password dimenticata non
       può fermare una gara, e la app deve funzionare da chiavetta e senza
       rete come ha sempre fatto. */
    expect(accesso.senzaAccount, 'con una via per continuare senza account').toBe(true);

    await page.click('#btnSenzaAccount');
    const dopo = await page.evaluate(() => ({
      pagina: ui.porta,
      form: !!document.querySelector('#accessoOrganizzatore'),
      nuova: !!document.querySelector('#btnNuovaGara'),
      testo: document.querySelector('#menuCorpo').textContent,
    }));
    expect(dopo.form, "l'accesso non si ripresenta").toBe(false);
    expect(dopo.nuova, 'e si può aggiungere una gara').toBe(true);
    expect(dopo.testo).toContain('Le tue gare');

    // e senza account si cronometra davvero
    await page.click('#btnNuovaGara');
    expect(await page.evaluate(() => ui.schermata), 'la nuova gara apre la app').toBe('app');
    await page.click('nav button:text-is("Arrivi")');
    await page.click('#btnStart');
    await page.click('#btnArrivo');
    confrontaNumero('arrivo registrato senza alcun account', 1,
      await page.evaluate(() => S.arrivi.length));
  });

  test('Live è una pagina a sé, con il suo passo indietro', async ({ page }) => {
    await apriAlMenu(page);
    await page.click('#porte .porta[data-p="live"]');
    await page.waitForTimeout(1200);

    const dentro = await page.evaluate(() => ({
      pagina: ui.porta,
      caselle: getComputedStyle(document.querySelector('#porte')).display !== 'none',
      titolo: document.querySelector('.testapagina h1').textContent,
      indietro: document.querySelector('.testapagina button').textContent,
      // nessun pulsante che modifichi qualcosa
      modifiche: document.querySelectorAll('#menuCorpo [data-elimina], #menuCorpo #btnNuovaGara').length,
    }));
    expect(dentro.pagina, 'Live ha una pagina sua').toBe('live');
    expect(dentro.caselle, 'le caselle spariscono').toBe(false);
    expect(dentro.titolo).toBe('Live');
    expect(dentro.indietro, 'con il passo indietro al menu').toContain('Menu');
    expect(dentro.modifiche, 'in Live non si modifica niente').toBe(0);

    await page.click('.testapagina button');
    const fuori = await page.evaluate(() => ({
      pagina: ui.porta,
      caselle: getComputedStyle(document.querySelector('#porte')).display !== 'none',
    }));
    expect(fuori.pagina, 'e si torna alle due caselle').toBe('porte');
    expect(fuori.caselle).toBe(true);
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
    });
    await vaiAllElencoGare(page);

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
    await page.waitForTimeout(400);

    const testo = await page.evaluate(() => document.querySelector('#menuCorpo').textContent);
    expect(testo, 'deve spiegare che serve la connessione').toContain('serve la connessione');
    expect(testo, 'e ricordare che il resto funziona lo stesso').toContain('senza rete');
    expect(testo, 'senza mostrare un errore tecnico').not.toMatch(/error|failed|undefined|\[object/i);

    // e da lì si torna indietro e l'altra porta funziona lo stesso
    await vaiAllElencoGare(page);
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
    });
    await vaiAllElencoGare(page);

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

test.describe('Le gare seguono chi le ha create', () => {
  /* Entrando con un account si vedono le sue gare; entrando senza account
     quelle create senza. Non si mescolano mai, nemmeno sullo stesso
     dispositivo e nemmeno fra due account diversi. */

  const fingiAccount = id => (utente => {
    sessione = utente ? { access_token: 'finto', refresh_token: 'x', email: utente + '@prova', utente } : null;
  });

  test('con account si vedono le sue, senza account solo quelle senza', async ({ page }) => {
    await apriApp(page);

    const r = await page.evaluate(() => {
      const entra = utente => {
        sessione = utente
          ? { access_token: 'finto', refresh_token: 'x', email: utente + '@prova.it', utente }
          : null;
      };
      const crea = nome => { nuovaGara(); S.cfg.nome = nome; touched(); };
      const nomi = () => elencoGare().map(g => g.nome).sort();

      entra(null); crea('Senza account 1'); crea('Senza account 2');
      entra('utente-A'); crea('Di A');
      entra('utente-B'); crea('Di B 1'); crea('Di B 2');

      entra('utente-A'); const vedeA = nomi(); const altroveA = gareAltrove();
      entra('utente-B'); const vedeB = nomi();
      entra(null); const vedeSenza = nomi();
      const tutte = elencoGareTutte().length;
      entra(null);
      return { vedeA, vedeB, vedeSenza, altroveA, tutte };
    });

    expect(r.tutte, 'sul dispositivo ci sono cinque gare in tutto').toBe(5);
    expect(r.vedeA, 'A vede solo la sua').toEqual(['Di A']);
    expect(r.vedeB, 'B vede solo le sue due').toEqual(['Di B 1', 'Di B 2']);
    expect(r.vedeSenza, 'e senza account si vedono solo quelle senza')
      .toEqual(['Senza account 1', 'Senza account 2']);
    expect(r.altroveA, 'ad A risultano quattro gare altrove').toBe(4);
  });

  test('una gara creata senza account non compare entrando con un account', async ({ page }) => {
    await apriApp(page);
    const r = await page.evaluate(() => {
      sessione = null;
      nuovaGara(); S.cfg.nome = 'Fatta senza account';
      S.arrivi = [{ id: nid(), pett: 1, ms: 1000, corr: 0 }];
      touched();
      const senza = elencoGare().map(g => g.nome);

      // ora si accede: quella gara resta di chi l'ha creata
      sessione = { access_token: 'finto', refresh_token: 'x', email: 'a@b.c', utente: 'utente-A' };
      const conAccount = elencoGare().map(g => g.nome);
      const altrove = gareAltrove();

      // e non è sparita: torna se si esce
      sessione = null;
      const diNuovo = elencoGare().map(g => g.nome);
      return { senza, conAccount, altrove, diNuovo };
    });

    expect(r.senza).toContain('Fatta senza account');
    expect(r.conAccount, "con l'account non compare").not.toContain('Fatta senza account');
    expect(r.altrove, 'ma risulta esistere altrove').toBeGreaterThanOrEqual(1);
    expect(r.diNuovo, 'e uscendo torna dov\'era').toContain('Fatta senza account');
  });

  test('un elenco vuoto dice dove sono finite le gare, invece di sembrare una perdita', async ({ page }) => {
    await apriApp(page);
    await page.evaluate(() => {
      sessione = null;
      nuovaGara(); S.cfg.nome = 'Solo questa'; touched();
      // si accede: l'elenco dell'account è vuoto
      sessione = { access_token: 'finto', refresh_token: 'x', email: 'a@b.c', utente: 'utente-A' };
      tornaAlMenu('organizzatore');
    });

    const testo = await page.evaluate(() => document.querySelector('#menuCorpo').textContent);
    expect(testo, 'deve rassicurare').toContain('Non hai perso niente');
    expect(testo, 'e spiegare dove sono').toContain('senza account');
    expect(testo, 'senza limitarsi al vuoto').not.toBe('');
  });

  test('le gare del formato vecchio restano fra quelle senza account', async ({ page }) => {
    // Erano state create quando gli account non esistevano: è la verità, e
    // dire il contrario le farebbe sparire a chi poi si collega.
    await apriApp(page);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('cronostrada.v1', JSON.stringify({
        v: 1,
        cfg: { nome: 'Gara del 2025', data: '2025-09-14', luogo: 'Ovada', km: 10, anno: 2025, org: '', premAssF: 3, premAssM: 3, premCat: 3, premSoc: 3, socEscluse: ['RUNCARD'] },
        matrice: [], iscritti: [], arrivi: [{ id: 'x1abc', pett: 1, ms: 1000, corr: 0 }],
        start: Date.now() - 7200000, stop: Date.now() - 3600000, dnf: [],
      }));
    });
    await page.reload();
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);

    const r = await page.evaluate(() => {
      const senza = elencoGare().map(g => g.nome);
      sessione = { access_token: 'finto', refresh_token: 'x', email: 'a@b.c', utente: 'utente-A' };
      const conAccount = elencoGare().map(g => g.nome);
      const altrove = gareAltrove();
      sessione = null;
      return { account: S.account, senza, conAccount, altrove };
    });

    expect(r.account, 'la gara vecchia non ha account').toBe(null);
    expect(r.senza, 'e si vede senza account').toContain('Gara del 2025');
    expect(r.conAccount, 'non entrando con un account').not.toContain('Gara del 2025');
    expect(r.altrove, 'ma viene segnalata come esistente altrove').toBe(1);
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
