'use strict';
/*
 * COME SI COMPORTA LA APP AL TRAGUARDO
 *
 * Non i numeri della gara passata, ma i gesti del giorno della gara:
 * importare gli iscritti, premere ARRIVO, fermare e riprendere il cronometro,
 * correggere l'orario di partenza, azzerare, e ritrovare tutto dopo che il
 * telefono si è spento.
 */

const { test, expect } = require('@playwright/test');
const {
  RIFERIMENTO, ANNO_RIFERIMENTO, PERCORSO_XLSX,
  confronta, confrontaNumero, apriApp, iniettaRiferimento, leggiCalcolati, salvaEAspetta,
} = require('./aiuto');

test.describe('Importazione da WISE', () => {
  test('riconosce le colonne da sé e importa i 280 iscritti', async ({ page }) => {
    await apriApp(page);
    await page.click('nav button:text-is("Iscritti")');

    const [scelta] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btnIscImport'),
    ]);
    await scelta.setFiles(PERCORSO_XLSX);
    await expect(page.locator('#dlgImport')).toBeVisible();

    // Il riconoscimento automatico deve trovare tutte e sette le colonne,
    // senza che l'utente tocchi un menu a tendina.
    const mappa = await page.evaluate(() => ({ map: imp.map, header: imp.header, hi: imp.hi }));
    expect(mappa.header, "la riga di intestazione dell'export WISE va riconosciuta").toBe(true);
    expect(mappa.map, 'colonne riconosciute automaticamente').toEqual({
      pett: 0, cognome: 1, nome: 2, sesso: 3, societa: 4, nascita: 5, conferma: 6,
    });

    const anteprima = await page.locator('#dlgImportBody p.hint').last().textContent();
    expect(anteprima).toContain('280 atleti riconosciuti');

    await page.click('#impOk');
    await expect(page.locator('#dlgImport')).toBeHidden();

    // Le date arrivano come seriali Excel: vanno convertite, non lasciate numeri.
    await page.evaluate(anno => { S.cfg.anno = anno; touched(); }, ANNO_RIFERIMENTO);
    const c = await leggiCalcolati(page);
    confrontaNumero('iscritti importati dal file WISE', 280, c.iscritti.length);

    const perPett = new Map(c.iscritti.map(i => [String(i.pett), i]));
    confronta('categoria FIDAL dopo importazione da WISE',
      RIFERIMENTO.iscritti.map(a => ({
        pett: a.pett,
        atteso: a.catFidal,
        ottenuto: perPett.has(String(a.pett)) ? perPett.get(String(a.pett)).catFidal : 'non importato',
      })));

    const nascite = await page.evaluate(() =>
      S.iscritti.filter(i => !/^\d{4}-\d{2}-\d{2}$/.test(i.nascita || '')).map(i => i.pett));
    expect(nascite, 'pettorali con data di nascita non convertita dal seriale Excel')
      .toEqual([]);
  });
});

test.describe('Cronometro e registrazione arrivi', () => {
  test('registra un arrivo con pettorale e uno senza', async ({ page }) => {
    await apriApp(page);
    await page.evaluate(() => {
      S.iscritti = [
        { id: 'a', pett: 10, cognome: 'ROSSI', nome: 'MARCO', sesso: 'M', societa: 'ATL. TEST', nascita: '1990-05-05', conferma: 'S' },
        { id: 'b', pett: 11, cognome: 'BIANCHI', nome: 'GIULIA', sesso: 'F', societa: 'ATL. TEST', nascita: '1992-06-06', conferma: 'S' },
      ];
      touched();
    });
    await page.click('nav button:text-is("Arrivi")');
    await page.click('#btnStart');

    // con pettorale, dal campo grande + Invio
    await page.fill('#quickBib', '10');
    const anteprima = await page.locator('#quickPrev').textContent();
    expect(anteprima, "l'anteprima deve mostrare chi è il pettorale digitato")
      .toContain('ROSSI MARCO');
    await page.press('#quickBib', 'Enter');

    // senza pettorale, con la barra spaziatrice
    await page.press('#quickBib', ' ');

    const stato = await page.evaluate(() => ({
      arrivi: S.arrivi.map(a => ({ pett: a.pett, ms: a.ms })),
      senzaPett: C.n.senzaPett,
    }));

    confrontaNumero('arrivi registrati', 2, stato.arrivi.length);
    expect(stato.arrivi[0].pett, 'il primo arrivo ha il pettorale 10').toBe(10);
    expect(stato.arrivi[1].pett, 'il secondo arrivo è senza pettorale').toBeNull();
    confrontaNumero('arrivi ancora senza pettorale', 1, stato.senzaPett,
      'La app deve segnalare gli arrivi a cui manca il pettorale.');

    for (const a of stato.arrivi) {
      expect(a.ms, 'il tempo va misurato in millisecondi dallo start').toBeGreaterThan(0);
    }
    expect(stato.arrivi[1].ms, "l'ordine cronologico va rispettato")
      .toBeGreaterThanOrEqual(stato.arrivi[0].ms);

    // il pettorale mancante si assegna dopo, senza perdere il tempo
    const msPrima = stato.arrivi[1].ms;
    await page.evaluate(() => {
      const senza = S.arrivi.find(a => a.pett === null);
      senza.pett = 11;
      touched();
    });
    const dopo = await page.evaluate(() => ({
      senzaPett: C.n.senzaPett,
      ms: S.arrivi.find(a => a.pett === 11).ms,
    }));
    confrontaNumero('arrivi senza pettorale dopo la correzione', 0, dopo.senzaPett);
    confrontaNumero('il tempo non deve cambiare assegnando il pettorale', msPrima, dopo.ms);
  });

  test('da computer il comportamento resta quello di sempre', async ({ page }) => {
    // Il tastierino e il pulsante a doppia funzione valgono solo su schermo
    // stretto. Da computer nulla deve cambiare: questo test lo blinda.
    await apriApp(page);
    await page.click('nav button:text-is("Arrivi")');
    await page.click('#btnStart');

    const modo = await page.evaluate(() => ({
      telefono: modoTelefono(),
      inputmode: document.querySelector('#quickBib').getAttribute('inputmode'),
      padVisibile: getComputedStyle(document.querySelector('#pad')).display,
      etichetta: document.querySelector('#btnArrivo').textContent,
    }));
    expect(modo.telefono, 'da computer la modalità telefono non si attiva').toBe(false);
    expect(modo.inputmode, 'da computer il campo resta numerico').toBe('numeric');
    expect(modo.padVisibile, 'da computer il tastierino resta nascosto').toBe('none');
    expect(modo.etichetta, 'da computer il pulsante resta ARRIVO').toBe('ARRIVO');

    // Col campo pieno, ARRIVO registra il SOLO tempo, come ha sempre fatto:
    // il pettorale si conferma con Invio.
    await page.fill('#quickBib', '77');
    await expect(page.locator('#btnArrivo'), 'e l\'etichetta non cambia col campo pieno')
      .toHaveText('ARRIVO');
    await page.click('#btnArrivo');
    expect(await page.evaluate(() => S.arrivi.map(a => a.pett)),
      'da computer il pulsante grande non prende il pettorale dal campo').toEqual([null]);

    // Invio invece lo prende, come sempre.
    await page.fill('#quickBib', '77');
    await page.press('#quickBib', 'Enter');
    expect(await page.evaluate(() => S.arrivi.map(a => a.pett))).toEqual([null, 77]);

    // e la barra spaziatrice registra il solo tempo
    await page.press('#quickBib', ' ');
    expect(await page.evaluate(() => S.arrivi.map(a => a.pett))).toEqual([null, 77, null]);
  });

  test('da computer la matrice delle categorie resta una tabella', async ({ page }) => {
    // L'impilamento in riquadri vale solo su schermo stretto: da computer la
    // tabella a cinque colonne è più comoda e non deve cambiare.
    await apriApp(page);
    await page.click('nav button:text-is("Gara")');

    const m = await page.evaluate(() => {
      const t = document.querySelector('.matrix');
      const riga = t.querySelector('tbody tr');
      return {
        intestazioneVisibile: getComputedStyle(t.querySelector('thead')).display !== 'none',
        rigaTabellare: getComputedStyle(riga).display === 'table-row',
        colonne: t.querySelectorAll('thead th').length,
        fasce: t.querySelectorAll('tbody tr').length,
      };
    });
    expect(m.intestazioneVisibile, "da computer l'intestazione resta").toBe(true);
    expect(m.rigaTabellare, 'da computer le righe restano righe di tabella').toBe(true);
    confrontaNumero('colonne della matrice', 5, m.colonne);
    confrontaNumero('fasce standard', 18, m.fasce);
  });

  test('STOP ferma il cronometro e Riprendi lo fa ripartire senza perdere tempi', async ({ page }) => {
    await apriApp(page);
    await page.click('nav button:text-is("Arrivi")');
    await page.click('#btnStart');
    await page.press('#quickBib', ' ');

    await page.click('#ctrlRow button:text-is("STOP cronometro")');
    const fermo = await page.evaluate(() => ({
      stop: S.stop, start: S.start, arrivi: S.arrivi.length, testo: $('#clock').textContent,
    }));
    expect(fermo.stop, 'lo stop va registrato').toBeTruthy();

    // a cronometro fermo il tempo non scorre e non si registrano arrivi
    await page.waitForTimeout(700);
    const dopoAttesa = await page.evaluate(() => $('#clock').textContent);
    expect(dopoAttesa, 'a cronometro fermo il tempo mostrato non deve cambiare')
      .toBe(fermo.testo);

    const rifiutato = await page.evaluate(() => segnaArrivo(99));
    expect(rifiutato, 'a cronometro fermo un arrivo non va registrato').toBeUndefined();
    confrontaNumero('arrivi durante lo stop', fermo.arrivi,
      await page.evaluate(() => S.arrivi.length));

    await page.click('#ctrlRow button:text-is("Riprendi cronometro")');
    const ripreso = await page.evaluate(() => ({ stop: S.stop, start: S.start }));
    expect(ripreso.stop, 'dopo Riprendi il cronometro non è più fermo').toBeNull();
    confrontaNumero('il riferimento resta lo sparo, non va spostato',
      fermo.start, ripreso.start);

    await page.press('#quickBib', ' ');
    confrontaNumero('arrivi dopo la ripresa', fermo.arrivi + 1,
      await page.evaluate(() => S.arrivi.length));
  });
});

test.describe("Spostamento dell'orario di partenza", () => {
  test('tutti i tempi traslano della stessa quantità e l\'ordine non cambia', async ({ page }) => {
    await apriApp(page);
    await iniettaRiferimento(page);

    const prima = await page.evaluate(() => ({
      start: S.start,
      arrivi: S.arrivi.map(a => ({ id: a.id, pett: a.pett, ms: a.ms })),
      ordine: C.ris.map(r => r.pett),
      posizioni: C.ris.filter(r => r.pos).map(r => `${r.pett}:${r.pos}`),
      etichette: C.ris.filter(r => r.pos).map(r => `${r.pett}:${r.etichetta}`),
    }));

    // Percorso vero dell'interfaccia: "Modifica orario" → "-60s" → Applica.
    await page.click('nav button:text-is("Arrivi")');
    await page.click('#startRow button:text-is("Modifica orario")');
    await expect(page.locator('#dlgStart')).toBeVisible();
    await page.click('#dlgStart .shiftrow button:text-is("-60s")');

    const anteprima = await page.locator('#dlgStart .banner').textContent();
    expect(anteprima, "l'anteprima deve dire di quanto si spostano i tempi")
      .toContain('aumentano');

    await page.click('#stOk');
    await expect(page.locator('#dlgStart')).toBeHidden();

    const dopo = await page.evaluate(() => ({
      start: S.start,
      arrivi: S.arrivi.map(a => ({ id: a.id, pett: a.pett, ms: a.ms })),
      ordine: C.ris.map(r => r.pett),
      posizioni: C.ris.filter(r => r.pos).map(r => `${r.pett}:${r.pos}`),
      etichette: C.ris.filter(r => r.pos).map(r => `${r.pett}:${r.etichetta}`),
    }));

    confrontaNumero("spostamento dell'orario di partenza", -60_000, dopo.start - prima.start);

    // Traslazione uniforme: stesso delta per ognuno dei 265 arrivi.
    const delta = new Map(prima.arrivi.map(a => [a.id, a.ms]));
    const scostamenti = dopo.arrivi.map(a => ({
      pett: a.pett,
      atteso: 60_000,
      ottenuto: a.ms - delta.get(a.id),
    }));
    confronta('spostamento del tempo', scostamenti);

    // E niente si riordina: le classifiche restano quelle.
    expect(dopo.ordine, "l'ordine di arrivo non deve cambiare").toEqual(prima.ordine);
    expect(dopo.posizioni, 'le posizioni non devono cambiare').toEqual(prima.posizioni);
    expect(dopo.etichette, 'le etichette di categoria non devono cambiare')
      .toEqual(prima.etichette);
  });
});

test.describe('Azzeramento', () => {
  test('azzera arrivi e partenza ma conserva gli iscritti', async ({ page }) => {
    await apriApp(page);
    await iniettaRiferimento(page);
    await page.click('nav button:text-is("Arrivi")');

    await page.click('#ctrlRow button:text-is("Azzera")');
    await expect(page.locator('#dlgConfirm')).toBeVisible();

    const avviso = await page.locator('#cfMsg').textContent();
    expect(avviso, "l'avviso deve dire quanti arrivi si perdono").toContain('265');
    expect(avviso, "l'avviso deve rassicurare sugli iscritti").toContain('iscritti restano');

    await page.click('#cfYes');

    const dopo = await page.evaluate(() => ({
      arrivi: S.arrivi.length, start: S.start, stop: S.stop, dnf: S.dnf.length,
      iscritti: S.iscritti.length, orologio: $('#clock').textContent,
    }));
    confrontaNumero('arrivi dopo azzeramento', 0, dopo.arrivi);
    confrontaNumero('ritirati dopo azzeramento', 0, dopo.dnf);
    expect(dopo.start, 'la gara torna non partita').toBeNull();
    expect(dopo.stop, 'lo stop viene ripulito').toBeNull();
    confrontaNumero('iscritti dopo azzeramento (NON devono sparire)', 280, dopo.iscritti);
    expect(dopo.orologio, 'il cronometro torna a zero').toContain('--:--:--');
  });

  test('si può rinunciare: Annulla non cancella niente', async ({ page }) => {
    await apriApp(page);
    await iniettaRiferimento(page);
    await page.click('nav button:text-is("Arrivi")');
    await page.click('#ctrlRow button:text-is("Azzera")');
    await page.click('#cfNo');

    confrontaNumero('arrivi dopo aver annullato la conferma', 265,
      await page.evaluate(() => S.arrivi.length));
  });
});

test.describe('Persistenza', () => {
  test('gli arrivi si scrivono subito, la digitazione resta ritardata', async ({ page }) => {
    await apriApp(page);
    await page.click('nav button:text-is("Arrivi")');
    await page.click('#btnStart');

    // Un arrivo: deve essere su disco nello stesso istante.
    const arrivo = await page.evaluate(() => {
      segnaArrivo(55);
      const d = JSON.parse(localStorage.getItem('cronostrada.v1') || '{}');
      return (d.arrivi || []).map(a => a.pett);
    });
    expect(arrivo, "l'arrivo deve essere salvato all'istante").toEqual([55]);

    // Digitare il nome della gara: qui il ritardo va bene e serve, perché
    // altrimenti si scriverebbe su disco a ogni tasto premuto.
    await page.click('nav button:text-is("Gara")');
    const subito = await page.evaluate(() => {
      const campo = document.querySelector('#cfgNome');
      campo.value = 'Prova ritardo';
      campo.dispatchEvent(new Event('input'));
      const d = JSON.parse(localStorage.getItem('cronostrada.v1') || '{}');
      return (d.cfg || {}).nome;
    });
    expect(subito, 'la digitazione non scrive a ogni tasto').not.toBe('Prova ritardo');

    await expect.poll(async () => page.evaluate(() =>
      (JSON.parse(localStorage.getItem('cronostrada.v1') || '{}').cfg || {}).nome),
      { message: 'ma entro poco il nome deve comunque essere salvato', timeout: 3000 })
      .toBe('Prova ritardo');
  });


  test('i dati sopravvivono a un ricaricamento della pagina', async ({ page }) => {
    await apriApp(page);
    await iniettaRiferimento(page);
    const prima = await leggiCalcolati(page);
    await salvaEAspetta(page);

    await page.reload();
    await page.waitForFunction(
      () => typeof S !== 'undefined' && C !== null && S.arrivi.length > 0);

    const dopo = await leggiCalcolati(page);

    confrontaNumero('iscritti dopo il ricaricamento', 280, dopo.iscritti.length);
    confrontaNumero('arrivi dopo il ricaricamento', 265, dopo.ris.length);
    confrontaNumero('confermati dopo il ricaricamento', 269, dopo.n.conf);
    confrontaNumero('DNS dopo il ricaricamento', 11, dopo.n.dns);
    confrontaNumero('DNF dopo il ricaricamento', 4, dopo.n.dnf);
    confrontaNumero('società dopo il ricaricamento', 51, dopo.n.societa);

    // I risultati devono essere identici, non solo di numero uguale.
    confronta('posizione assoluta dopo il ricaricamento', prima.ris.map((r, n) => ({
      pett: r.pett, atteso: r.pos, ottenuto: dopo.ris[n].pos,
    })));
    confronta('etichetta dopo il ricaricamento', prima.ris.map((r, n) => ({
      pett: r.pett, atteso: r.etichetta, ottenuto: dopo.ris[n].etichetta,
    })));
    confronta('tempo dopo il ricaricamento', prima.ris.map((r, n) => ({
      pett: r.pett, atteso: r.tempo, ottenuto: dopo.ris[n].tempo,
    })));

    // La app riapre direttamente sugli arrivi quando ritrova una gara.
    const vista = await page.evaluate(() => ui.view);
    expect(vista, 'ritrovando una gara la app deve riaprirsi sugli arrivi')
      .toBe('traguardo');
  });
});

test.describe('Copia di emergenza da chiavetta USB', () => {
  test('dist/CronoStrada.html funziona ed è identica alla app del sito', async ({ page }) => {
    // La copia di emergenza deve restare una copia: se qualcuno aggiorna
    // index.html e si dimentica dist/, il test lo dice prima della gara.
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    const radice = path.resolve(__dirname, '..');
    const somma = f => crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(radice, f))).digest('hex');

    const a = somma('index.html');
    const b = somma('dist/CronoStrada.html');
    if (a !== b) {
      throw new Error(
        '\ndist/CronoStrada.html non è più identica a index.html.\n\n' +
        `  index.html            ${a.slice(0, 16)}…\n` +
        `  dist/CronoStrada.html ${b.slice(0, 16)}…\n\n` +
        '  La copia di emergenza sulla chiavetta USB sarebbe una versione diversa\n' +
        '  da quella del sito. Riallineala con:\n' +
        '      Copy-Item ".\\index.html" -Destination ".\\dist\\CronoStrada.html" -Force\n');
    }

    // E deve funzionare davvero, non solo essere identica.
    await apriApp(page, '/dist/CronoStrada.html');
    await iniettaRiferimento(page);
    const c = await leggiCalcolati(page);
    confrontaNumero('arrivi nella copia di emergenza', 265, c.ris.length);
    confrontaNumero('confermati nella copia di emergenza', 269, c.n.conf);
    expect(c.csv[1][3], 'anche la copia di emergenza tronca i tempi').toBe('33:59');
  });
});
