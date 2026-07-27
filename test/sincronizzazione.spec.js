'use strict';
/*
 * SINCRONIZZAZIONE — quello che non deve mai cambiare
 *
 * Il principio: il dispositivo al traguardo è la fonte di verità, e la
 * sincronizzazione è uno specchio, non una dipendenza. Questi test difendono
 * proprio quello: che la app senza account, senza rete e da chiavetta USB
 * resti esattamente quella di prima.
 *
 * Non servono credenziali: girano tutti in locale. La prova con il server
 * vero — arrivi in modalità aereo, rete riattivata, nessun doppione — sta in
 * isolamento-supabase.spec.js e nelle verifiche fatte a mano.
 */

const { test, expect } = require('@playwright/test');
const { apriApp, confrontaNumero, iniettaRiferimento, leggiCalcolati } = require('./aiuto');

test.describe('La app non dipende dalla sincronizzazione', () => {
  test('senza account cronometra e salva esattamente come prima', async ({ page }) => {
    await apriApp(page);

    const stato = await page.evaluate(() => ({
      collegato: collegato(),
      etichetta: document.querySelector('#syncTxt').textContent,
      punto: document.querySelector('#syncDot').className,
    }));
    expect(stato.collegato, 'di partenza non si è collegati a niente').toBe(false);
    expect(stato.etichetta, "e l'indicatore lo dice").toBe('Solo in locale');
    expect(stato.punto, 'con il pallino spento').toContain('off');

    // e tutto funziona lo stesso
    await page.evaluate(() => {
      S.iscritti = [{
        id: nid(), pett: 10, cognome: 'ROSSI', nome: 'MARCO', sesso: 'M',
        societa: 'ATL', nascita: '1990-01-01', conferma: 'S',
      }];
      touched(); go('traguardo');
    });
    await page.click('#btnStart');
    const r = await page.evaluate(() => {
      segnaArrivo(10);
      const salvato = JSON.parse(localStorage.getItem('cronostrada.v1') || '{}');
      return { arrivi: S.arrivi.length, salvati: (salvato.arrivi || []).length };
    });
    confrontaNumero('arrivi registrati senza account', 1, r.arrivi);
    confrontaNumero('arrivi salvati senza account', 1, r.salvati,
      'La scrittura locale non deve dipendere in alcun modo dal server.');
  });

  test('registrare un arrivo non fa partire nessuna richiesta di rete', async ({ page }) => {
    // Se un giorno segnaArrivo cominciasse ad aspettare la rete, al traguardo
    // ogni pressione dipenderebbe dal campo. Non deve succedere mai.
    await apriApp(page);
    await page.evaluate(() => { go('traguardo'); });
    await page.click('#btnStart');

    const richieste = [];
    page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1')) richieste.push(r.url()); });

    await page.evaluate(() => { for (let i = 0; i < 10; i++) segnaArrivo(null); });
    await page.waitForTimeout(1200);   // ben oltre il raggruppamento della coda

    confrontaNumero('arrivi registrati', 10, await page.evaluate(() => S.arrivi.length));
    if (richieste.length) {
      throw new Error(
        `\nRegistrare dieci arrivi ha fatto partire ${richieste.length} richieste di rete:\n` +
        richieste.slice(0, 5).map(u => '  ' + u).join('\n') +
        `\n\n  Senza account non si deve contattare nessuno, e in nessun caso il\n` +
        `  gesto di registrare un arrivo deve dipendere dalla rete.\n`);
    }
  });
});

test.describe('L\'indicatore non può mentire', () => {
  /*
   * "Allineato" vuol dire una cosa sola: sul server c'è tutto quello che c'è
   * qui. È il momento in cui uno legge quella parola e chiude la app che fa
   * il danno, quindi non basta che chi aggiorna lo stato si comporti bene:
   * la parola deve essere impossibile da scrivere con la coda piena, da
   * qualunque parte arrivi la richiesta.
   */

  test('"Allineato" è impossibile con anche una sola operazione in coda', async ({ page }) => {
    await apriApp(page);

    const casi = await page.evaluate(() => {
      const prova = (fase, coda) => {
        statoSincronia = { fase, coda };
        disegnaStatoSincronia();
        return { chiesto: fase, coda, mostrato: document.querySelector('#syncTxt').textContent };
      };
      return [
        prova('allineato', 0),
        prova('allineato', 1),
        prova('allineato', 7),
        prova('allineato', 265),
      ];
    });

    expect(casi[0].mostrato, 'con la coda vuota "Allineato" è lecito').toBe('Allineato');

    const bugie = casi.slice(1).filter(c => /allineat/i.test(c.mostrato));
    if (bugie.length) {
      throw new Error(
        `\nL'indicatore ha scritto "Allineato" con la coda piena:\n` +
        bugie.map(c => `  richiesto "${c.chiesto}" con ${c.coda} in coda -> mostrato "${c.mostrato}"`).join('\n') +
        `\n\n  È il momento in cui uno legge quella parola e chiude la app: se non\n` +
        `  è vero, quello che ha registrato resta solo lì.\n`);
    }
    for (const c of casi.slice(1)) {
      expect(c.mostrato, `con ${c.coda} in coda deve comparire il numero`).toContain(String(c.coda));
    }
  });

  test('il numero mostrato è quello vero della coda, non quello dichiarato', async ({ page }) => {
    await apriApp(page);
    // si dichiara una coda vuota mentre su disco ce ne sono tre: deve vincere
    // il disco, e l'indicatore correggersi da solo
    const r = await page.evaluate(async () => {
      for (const n of [1, 2, 3]) {
        await accoda({ id: 'finta:' + n, gara: S.garaId, tipo: 'iscritti', corpo: {}, creato: Date.now() });
      }
      // si dichiara il falso: coda vuota
      aggiornaStato('allineato', 0);
      await new Promise(r => setTimeout(r, 400));      // il tempo della verifica

      const rilevate = statoSincronia.coda;            // quante ne ha trovate da sola
      const vere = await contaCoda();

      // e con quel numero, "Allineato" non deve più essere scrivibile
      statoSincronia = { fase: 'allineato', coda: rilevate };
      disegnaStatoSincronia();
      const mostrato = document.querySelector('#syncTxt').textContent;

      for (const n of [1, 2, 3]) await togliDallaCoda('finta:' + n);
      return { rilevate, vere, mostrato };
    });

    expect(r.vere, 'in coda ci sono davvero tre operazioni').toBe(3);
    expect(r.rilevate, 'la verifica le conta guardando il disco, non chi ha dichiarato 0').toBe(3);
    expect(r.mostrato, 'e con quel numero "Allineato" non è scrivibile').not.toMatch(/allineat/i);
    expect(r.mostrato, 'mostrando il numero vero').toContain('3');
  });
});

test.describe('Chiudere la app avvisa se qualcosa vive in un posto solo', () => {
  test('avvisa quando la coda non è vuota', async ({ page }) => {
    await apriApp(page);

    const casi = await page.evaluate(() => {
      const stato = (arrivi, file, coll, coda) => {
        S.arrivi = Array.from({ length: arrivi }, () => ({ id: nid(), pett: null, ms: 1, corr: 0 }));
        fsHandle = file ? {} : null;
        sessione = coll ? { access_token: 'finto', refresh_token: 'x', email: 'a@b.c' } : null;
        statoSincronia = { fase: 'attesa', coda };
        return serveAvvisoChiusura();
      };
      return {
        nienteDaSalvare: stato(0, false, false, 0),
        arriviSenzaFile: stato(3, false, false, 0),
        arriviConFile: stato(3, true, false, 0),
        // il caso che mancava: tutto su file, ma la coda non è vuota
        codaPienaConFile: stato(3, true, true, 5),
        codaPienaSenzaArrivi: stato(0, false, true, 2),
        collegatoECodaVuota: stato(0, false, true, 0),
      };
    });

    expect(casi.nienteDaSalvare, 'senza niente da salvare non si avvisa').toBe(false);
    expect(casi.arriviSenzaFile, 'con arrivi solo nella memoria del browser si avvisa').toBe(true);
    expect(casi.arriviConFile, 'con un file di salvataggio collegato non serve').toBe(false);
    expect(casi.collegatoECodaVuota, 'collegati e allineati non serve').toBe(false);

    if (!casi.codaPienaConFile || !casi.codaPienaSenzaArrivi) {
      throw new Error(
        `\nChiudendo la app con operazioni ancora in coda non compare nessun avviso.\n\n` +
        `  con file di salvataggio e 5 in coda: avviso = ${casi.codaPienaConFile}\n` +
        `  senza arrivi ma con 2 in coda:      avviso = ${casi.codaPienaSenzaArrivi}\n\n` +
        `  È il momento in cui uno crede che sia tutto al sicuro e chiude.\n`);
    }
  });

  test('l\'avviso compare davvero alla chiusura, non solo nella funzione', async ({ page }) => {
    await apriApp(page);
    await page.evaluate(() => {
      S.arrivi = [{ id: nid(), pett: null, ms: 1, corr: 0 }];
      fsHandle = null;
      window.__avvisato = false;
    });
    // Playwright accetta da solo le finestre di conferma: qui si intercetta
    // per sapere che il browser l'ha davvero chiesta.
    page.once('dialog', d => { d.accept().catch(() => { }); });
    const chiesto = await page.evaluate(() => {
      let visto = false;
      const spia = e => { if (e.defaultPrevented || e.returnValue) visto = true; };
      window.addEventListener('beforeunload', spia);
      window.dispatchEvent(new Event('beforeunload', { cancelable: true }));
      window.removeEventListener('beforeunload', spia);
      return visto;
    });
    expect(chiesto, 'il gestore di beforeunload deve chiedere conferma').toBe(true);
  });
});

test.describe('Gli arrivi restano immutabili sul server', () => {
  test('spostare la partenza non cambia un solo valore grezzo', async ({ page }) => {
    /*
     * Il caso che aveva un buco nello schema. Sul server arrivi.ms è misurato
     * rispetto alla partenza ORIGINALE e non cambia mai; qui la app continua
     * a traslare i propri tempi, e a quadrare i conti è un numero solo:
     *     grezzo = locale + scartoPartenza
     */
    await apriApp(page);
    const r = await page.evaluate(() => {
      S = VUOTO();
      S.start = Date.now() - 100000;
      S.arrivi = [10000, 20000, 30000].map(ms => ({ id: nid(), pett: null, ms, corr: 0 }));
      const grezzo = () => S.arrivi.map(a => a.ms + (S.scartoPartenza || 0));

      const prima = grezzo();
      stNew = S.start - 60000; applicaStart();          // partenza spostata indietro
      const dopoUno = grezzo();
      S.arrivi.push({ id: nid(), pett: null, ms: 45000, corr: 0 });   // arrivo NUOVO
      const grezzoNuovo = 45000 + S.scartoPartenza;
      stNew = S.start + 10000; applicaStart();          // e spostata avanti
      const dopoDue = grezzo();

      return {
        prima, dopoUno: dopoUno.slice(0, 3), dopoDue: dopoDue.slice(0, 3),
        scarto: S.scartoPartenza,
        locali: S.arrivi.map(a => a.ms),
        grezzoNuovoStabile: dopoDue[3] === grezzoNuovo,
      };
    });

    expect(r.dopoUno, 'dopo il primo spostamento i grezzi non cambiano').toEqual(r.prima);
    expect(r.dopoDue, 'e nemmeno dopo il secondo').toEqual(r.prima);
    expect(r.grezzoNuovoStabile,
      'anche un arrivo registrato DOPO uno spostamento ha un grezzo stabile').toBe(true);
    expect(r.scarto, 'lo scarto tiene conto di entrambi gli spostamenti').toBe(-50000);
    expect(r.locali.slice(0, 3), 'mentre i tempi locali si sono traslati')
      .toEqual([60000, 70000, 80000]);
  });

  test('azzerare passa a una sessione nuova invece di cancellare', async ({ page }) => {
    await apriApp(page);
    await page.evaluate(() => { go('traguardo'); });
    await page.click('#btnStart');
    await page.evaluate(() => { for (let i = 0; i < 4; i++) segnaArrivo(null); });

    const prima = await page.evaluate(() => ({ sessione: S.sessione, arrivi: S.arrivi.length }));
    confrontaNumero('sessione iniziale', 1, prima.sessione);
    confrontaNumero('arrivi prima di azzerare', 4, prima.arrivi);

    await page.click('#ctrlRow button:text-is("Azzera")');
    await page.click('#cfYes');

    const dopo = await page.evaluate(() => ({
      sessione: S.sessione, arrivi: S.arrivi.length, scarto: S.scartoPartenza,
    }));
    confrontaNumero('arrivi dopo azzeramento', 0, dopo.arrivi);
    confrontaNumero('sessione dopo azzeramento', 2, dopo.sessione,
      'Sul server gli arrivi sono immutabili: azzerare incrementa la sessione, ' +
      'e le righe di prima restano come traccia di cosa è stato scartato.');
    confrontaNumero('scarto azzerato con la sessione nuova', 0, dopo.scarto);
  });
});

test.describe('Identificativi', () => {
  test('sono UUID, e una gara vecchia viene convertita all\'apertura', async ({ page }) => {
    await apriApp(page);

    // una gara salvata col formato vecchio, con identificativi "x12abc"
    await page.evaluate(() => {
      const vecchia = {
        v: 1,
        cfg: { nome: 'Vecchia', data: '2025-09-14', luogo: '', km: 10, anno: 2025, org: '', premAssF: 3, premAssM: 3, premCat: 3, premSoc: 3, socEscluse: ['RUNCARD'] },
        matrice: [], iscritti: [{ id: 'x1abcd', pett: 5, cognome: 'ROSSI', nome: 'MARCO', sesso: 'M', societa: '', nascita: '1990-01-01', conferma: 'S' }],
        arrivi: [{ id: 'x2efgh', pett: 5, ms: 12345, corr: 0 }],
        start: Date.now() - 1000, stop: null, dnf: [],
      };
      localStorage.setItem('cronostrada.v1', JSON.stringify(vecchia));
    });
    await page.reload();
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);

    const r = await page.evaluate(() => ({
      versione: S.v,
      garaId: S.garaId, garaOk: eUuid(S.garaId),
      iscritto: S.iscritti[0] && S.iscritti[0].id, iscrittoOk: eUuid(S.iscritti[0].id),
      arrivo: S.arrivi[0] && S.arrivi[0].id, arrivoOk: eUuid(S.arrivi[0].id),
      // e i dati sono ancora tutti lì
      pettIscritto: S.iscritti[0].pett, msArrivo: S.arrivi[0].ms, nome: S.cfg.nome,
    }));

    expect(r.garaOk, 'la gara riceve un identificativo valido').toBe(true);
    expect(r.iscrittoOk, `l'iscritto è stato convertito (${r.iscritto})`).toBe(true);
    expect(r.arrivoOk, `l'arrivo è stato convertito (${r.arrivo})`).toBe(true);
    confrontaNumero('versione del formato', 2, r.versione);

    // la conversione non deve perdere niente
    confrontaNumero('pettorale conservato', 5, r.pettIscritto);
    confrontaNumero('tempo conservato', 12345, r.msArrivo);
    expect(r.nome, 'e il nome della gara').toBe('Vecchia');
  });
});

test.describe('I risultati di riferimento non cambiano', () => {
  test('con la sincronizzazione attiva la gara vera dà gli stessi numeri', async ({ page }) => {
    // La rete di sicurezza vale anche adesso: se il codice nuovo avesse
    // toccato il motore di calcolo, qui si vedrebbe.
    await apriApp(page);
    await iniettaRiferimento(page);
    const c = await leggiCalcolati(page);
    confrontaNumero('confermati', 269, c.n.conf);
    confrontaNumero('DNS', 11, c.n.dns);
    confrontaNumero('DNF', 4, c.n.dnf);
    confrontaNumero('società', 51, c.n.societa);
    confrontaNumero('arrivi', 265, c.n.arrivi);
    expect(c.csv[1][3], 'e il primo tempo è ancora troncato').toBe('33:59');
  });
});
