'use strict';
/*
 * LA DATA DI NASCITA
 *
 * È il campo da cui dipende la categoria FIDAL, cioè chi sale sul podio.
 * Sbagliarlo non dà nessun errore a schermo: dà una premiazione sbagliata.
 *
 * Il difetto da cui vengono questi test: la casella era un <input type=date>,
 * quella con il calendarietto. Mostra soltanto le date scritte in ISO,
 * quindi un iscritto arrivato da un backup vecchio con "07/03/1990" dentro
 * si vedeva con la casella VUOTA — mentre la app la categoria la calcolava
 * lo stesso. Uno guarda, non vede niente, riscrive, e la data di prima
 * sparisce senza che nessuno l'abbia deciso.
 */

const { test, expect } = require('@playwright/test');
const { apriApp, confrontaNumero } = require('./aiuto');

const NASCITA = '#iscTable td[data-col="Nascita"] input';

/** Mette tre iscritti e apre la scheda. */
async function conIscritti(page, iscritti) {
  await page.evaluate(lista => {
    nuovaGara();
    S.cfg.nome = 'Prova date'; S.cfg.anno = 2026;
    S.iscritti = lista.map((x, n) => Object.assign(
      { id: nid(), pett: n + 1, cognome: 'ATLETA', nome: 'N' + n, sesso: 'M', societa: 'ATL. PROVA', conferma: 'S' }, x));
    touched();
    go('iscritti');
  }, iscritti);
  await page.waitForSelector(NASCITA);
}

const mostrate = page => page.evaluate(sel =>
  Array.from(document.querySelectorAll(sel)).map(i => i.value), NASCITA);

test.describe('Si scrive come la scrive la gente', () => {
  test('accetta i formati veri e rifiuta quello che non è una data', async ({ page }) => {
    await apriApp(page);

    const casi = await page.evaluate(() => {
      const buoni = {
        '07/03/1948': '1948-03-07',
        '7/3/1948': '1948-03-07',
        '07-03-1948': '1948-03-07',
        '07.03.1948': '1948-03-07',
        '07/03/48': '1948-03-07',      // due cifre: 48 sta nel Novecento
        '07/03/05': '2005-03-07',      // e 05 nel Duemila
        '07031948': '1948-03-07',      // battuta di seguito, senza barre
        '070348': '1948-03-07',
        '1948-03-07': '1948-03-07',    // com'è scritta dentro
        '19480307': '1948-03-07',      // otto cifre che cominciano per anno
        '  7/3/1948  ': '1948-03-07',  // con gli spazi intorno
      };
      const cattivi = ['', 'ciao', '31/02/1990', '45/13/1990', '00/03/1948',
        '07/03/1899', '1234', '07/03', 'marzo 1948'];
      return {
        buoni: Object.entries(buoni).map(([scritto, atteso]) =>
          ({ scritto, atteso, ottenuto: dataInserita(scritto) })),
        cattivi: cattivi.map(scritto => ({ scritto, ottenuto: dataInserita(scritto) })),
      };
    });

    const sbagliati = casi.buoni.filter(c => c.ottenuto !== c.atteso);
    if (sbagliati.length) {
      throw new Error('\nQueste date scritte a mano non vengono lette bene:\n' +
        sbagliati.map(c => `  "${c.scritto}" -> atteso ${c.atteso}, ottenuto "${c.ottenuto}"`).join('\n') +
        '\n\n  Sono i modi in cui la gente scrive una data di nascita. Se la app\n' +
        '  ne rifiuta uno, chi lo usa crede che il campo non funzioni.\n');
    }

    const passati = casi.cattivi.filter(c => c.ottenuto !== '');
    if (passati.length) {
      throw new Error('\nQueste NON sono date e invece sono passate:\n' +
        passati.map(c => `  "${c.scritto}" -> "${c.ottenuto}"`).join('\n') +
        '\n\n  Il 31 febbraio non esiste, e una data inventata manda un atleta\n' +
        '  nella categoria sbagliata senza dire niente a nessuno.\n');
    }
  });

  test('scrivendola nella casella, la categoria si aggiorna', async ({ page }) => {
    await apriApp(page);
    await conIscritti(page, [{ nascita: '' }]);

    const prima = await page.evaluate(() => C.iscritti[0].catFidal);
    expect(prima, 'senza data non c\'è categoria').toBeFalsy();

    await page.fill(NASCITA, '7/3/1948');
    await page.locator(NASCITA).blur();
    await page.waitForFunction(() => !!C.iscritti[0].catFidal);

    const dopo = await page.evaluate(() => ({
      dentro: S.iscritti[0].nascita,
      mostrata: document.querySelector('#iscTable td[data-col="Nascita"] input').value,
      categoria: C.iscritti[0].catFidal,
    }));
    expect(dopo.dentro, 'dentro si tiene la forma del server').toBe('1948-03-07');
    expect(dopo.mostrata, 'e si legge in italiano').toBe('07/03/1948');
    expect(dopo.categoria, 'la categoria FIDAL segue subito').toBe('SM75');
  });

  test('quello che non è una data non si salva e non sparisce', async ({ page }) => {
    await apriApp(page);
    await conIscritti(page, [{ nascita: '1990-03-07' }]);

    await page.fill(NASCITA, '31/02/1990');
    await page.locator(NASCITA).blur();
    await page.waitForTimeout(200);

    const dopo = await page.evaluate(() => ({
      dentro: S.iscritti[0].nascita,
      mostrata: document.querySelector('#iscTable td[data-col="Nascita"] input').value,
      segnalata: document.querySelector('#iscTable td[data-col="Nascita"] input').classList.contains('storta'),
    }));
    expect(dopo.dentro, 'la data buona di prima resta quella').toBe('1990-03-07');
    expect(dopo.mostrata, "e quello che si è appena scritto resta sotto gli occhi").toBe('31/02/1990');
    expect(dopo.segnalata, 'con il campo segnato in rosso').toBe(true);
  });
});

test.describe('Le date storte dei backup vecchi', () => {
  test('una gara con "07/03/1990" dentro si apre con la data in chiaro', async ({ page }) => {
    /* Prima si vedeva una casella vuota, e la categoria calcolata: la app
       sapeva l'anno e non lo mostrava. Chi provava a rimetterla a posto
       cancellava quella che c'era. */
    await apriApp(page);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('cronostrada.v1', JSON.stringify({
        v: 2, garaId: nid(),
        cfg: { nome: 'Backup vecchio', data: '2026-09-14', anno: 2026, luogo: '', km: 10, org: '',
          premAssF: 3, premAssM: 3, premCat: 3, premSoc: 3, socEscluse: ['RUNCARD'] },
        matrice: [], arrivi: [], start: null, stop: null, dnf: [],
        iscritti: [
          { id: nid(), pett: 1, cognome: 'VERDI', nome: 'LUCA', sesso: 'M', societa: 'ATL. PROVA', nascita: '07/03/1990', conferma: 'S' },
          { id: nid(), pett: 2, cognome: 'ROSSI', nome: 'ANNA', sesso: 'F', societa: 'ATL. PROVA', nascita: '7.3.1985', conferma: 'S' },
        ],
      }));
    });
    await page.reload();
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);
    await page.evaluate(() => { entraNellaApp('iscritti'); go('iscritti'); });
    await page.waitForSelector(NASCITA);

    const r = await page.evaluate(() => ({
      dentro: S.iscritti.map(i => i.nascita),
      mostrate: Array.from(document.querySelectorAll('#iscTable td[data-col="Nascita"] input')).map(i => i.value),
      categorie: C.iscritti.map(i => i.catFidal),
    }));

    expect(r.dentro, "all'apertura diventano tutte della forma buona")
      .toEqual(['1990-03-07', '1985-03-07']);
    expect(r.mostrate, 'e si leggono, invece di sembrare vuote')
      .toEqual(['07/03/1990', '07/03/1985']);
    expect(r.categorie, 'le categorie restano quelle di prima').toEqual(['SM35', 'SF40']);
  });

  test('una data storta non parte verso il server come tale', async ({ page }) => {
    /* La colonna sul server è di tipo date: mandarle "07/03/1990" farebbe
       respingere la riga, e quella resterebbe in coda per sempre. */
    await apriApp(page);
    await conIscritti(page, [{ nascita: 'chissà' }, { nascita: '1990-03-07' }]);

    const inviate = await page.evaluate(() => {
      impronte.clear();
      return operazioniDaMandare(new Set())
        .filter(o => o.tipo === 'iscritti')
        .map(o => o.corpo.nascita);
    });
    expect(inviate, 'quella che non è una data parte come vuota, non come testo')
      .toEqual([null, '1990-03-07']);
  });
});

test.describe('La casella si usa con le dita e col mouse', () => {
  for (const [dove, viewport] of Object.entries({
    computer: { width: 1280, height: 900 },
    telefono: { width: 390, height: 844 },
  })) {
    test(`su ${dove} si vede tutta e si può scrivere`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await apriApp(page);
      await conIscritti(page, [{ nascita: '1948-03-07' }]);

      const c = await page.evaluate(sel => {
        const i = document.querySelector(sel);
        const r = i.getBoundingClientRect();
        return {
          largo: Math.round(r.width), alto: Math.round(r.height),
          tagliato: i.scrollWidth > i.clientWidth + 1,
          dentroLoSchermo: r.left >= -1 && r.right <= innerWidth + 1,
          tastierino: i.getAttribute('inputmode'),
          suggerimento: i.getAttribute('placeholder'),
        };
      }, NASCITA);

      expect(c.dentroLoSchermo, 'la casella deve stare dentro lo schermo').toBe(true);
      expect(c.tagliato, 'e la data non deve risultare tagliata').toBe(false);
      expect(c.suggerimento, 'con scritto come va scritta').toBe('gg/mm/aaaa');
      // 10 cifre più le barre: sotto i 100 punti non ci sta "07/03/1948"
      expect(c.largo, 'larga abbastanza per una data intera').toBeGreaterThanOrEqual(100);
      if (dove === 'telefono') {
        expect(c.tastierino, 'sul telefono deve aprirsi il tastierino dei numeri').toBe('numeric');
        expect(c.alto, 'e alta abbastanza per un dito').toBeGreaterThanOrEqual(40);
      }

      // e si scrive davvero
      await page.fill(NASCITA, '25/12/1970');
      await page.locator(NASCITA).blur();
      await page.waitForFunction(() => S.iscritti[0].nascita === '1970-12-25');
      confrontaNumero('anno letto dalla casella', 1970,
        await page.evaluate(() => +S.iscritti[0].nascita.slice(0, 4)));
    });
  }
});
