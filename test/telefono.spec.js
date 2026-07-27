'use strict';
/*
 * IL TRAGUARDO DAL TELEFONO
 *
 * Gira su due profili di dispositivo veri (iPhone 14 su WebKit, Pixel 7 su
 * Chromium) e usa tocchi reali con page.tap(), non clic del mouse.
 *
 * Il difetto da cui nasce tutto questo: il campo del pettorale apriva il
 * tastierino numerico di iOS, che non ha il tasto invio. Dal telefono non
 * c'era modo di confermare un pettorale.
 */

const { test, expect, devices } = require('@playwright/test');
const { apriApp, confrontaNumero, iniettaRiferimento } = require('./aiuto');

const ISCRITTI_FINTI = Array.from({ length: 12 }, (_, i) => ({
  id: 'x' + i, pett: 120 + i, cognome: 'ROSSI', nome: 'ATLETA' + i,
  sesso: 'M', societa: 'ATL. TEST', nascita: '1990-01-01', conferma: 'S',
}));

/** Apre la app, mette degli iscritti e fa partire il cronometro. */
async function traguardoPronto(page) {
  await apriApp(page);
  await page.evaluate(gente => { S.iscritti = gente; touched(); }, ISCRITTI_FINTI);
  await page.tap('nav button:text-is("Arrivi")');
  await page.tap('#btnStart');
  await expect(page.locator('#pad')).toBeVisible();
}

test.describe('Tastierino interno alla app', () => {
  test('il campo del pettorale non apre più la tastiera del telefono', async ({ page }) => {
    await traguardoPronto(page);

    const campo = page.locator('#quickBib');
    await expect(campo).toHaveAttribute('inputmode', 'none');

    // readOnly no: da tastiera fisica si deve poter ancora scrivere.
    // Quello che conta è che inputmode="none" impedisca la tastiera virtuale.
    const modo = await page.evaluate(() => ({
      telefono: modoTelefono(),
      inputmode: document.querySelector('#quickBib').getAttribute('inputmode'),
    }));
    expect(modo.telefono, 'la app deve riconoscere di essere su schermo stretto').toBe(true);
    expect(modo.inputmode).toBe('none');
  });

  test('ha le cifre 0-9, un tasto cancella e uno svuota, tutti almeno 48px', async ({ page }) => {
    await traguardoPronto(page);

    const tasti = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#padGrid button')).map(b => {
        const r = b.getBoundingClientRect();
        return { testo: b.textContent, largh: Math.round(r.width), alt: Math.round(r.height) };
      }));

    confrontaNumero('tasti del tastierino', 12, tasti.length);

    const cifre = tasti.map(t => t.testo).filter(t => /^\d$/.test(t)).sort();
    expect(cifre, 'devono esserci tutte le cifre da 0 a 9')
      .toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(tasti.map(t => t.testo), 'devono esserci il tasto svuota e il tasto cancella')
      .toEqual(expect.arrayContaining(['C', '⌫']));

    const piccoli = tasti.filter(t => t.largh < 48 || t.alt < 48);
    if (piccoli.length) {
      throw new Error(
        `\n${piccoli.length} tasti sono più piccoli di 48px per lato:\n` +
        piccoli.map(t => `  tasto "${t.testo}": ${t.largh}x${t.alt} px`).join('\n') +
        '\n  Al traguardo si preme senza guardare: sotto i 48px si sbaglia tasto.\n');
    }
  });

  test('i tasti restano sempre nella stessa posizione, anche dopo molti arrivi', async ({ page }) => {
    await traguardoPronto(page);

    const posizioni = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('#padGrid button')).map(b => {
        const r = b.getBoundingClientRect();
        return b.textContent + '@' + Math.round(r.x) + ',' + Math.round(r.y);
      }));

    const prima = await posizioni();
    for (let i = 0; i < 5; i++) await page.tap('#btnArrivo');
    const dopo = await posizioni();

    expect(dopo, 'il tastierino non deve mai spostarsi sotto le dita').toEqual(prima);
  });
});

test.describe('Inserire e confermare un pettorale senza tastiera', () => {
  test('si digita 126 col tastierino e si conferma col pulsante grande', async ({ page }) => {
    await traguardoPronto(page);

    // Nessuna scrittura da tastiera: solo tocchi sul tastierino della app.
    for (const cifra of ['1', '2', '6']) {
      await page.tap(`#padGrid button:text-is("${cifra}")`);
    }

    await expect(page.locator('#quickBib')).toHaveValue('126');
    await expect(page.locator('#btnArrivo')).toHaveText('ARRIVO 126');
    await expect(page.locator('#quickPrev')).toContainText('ROSSI ATLETA6');

    await page.tap('#btnArrivo');

    const stato = await page.evaluate(() => ({
      arrivi: S.arrivi.map(a => a.pett),
      campo: document.querySelector('#quickBib').value,
      etichetta: document.querySelector('#btnArrivo').textContent,
    }));
    expect(stato.arrivi, 'l\'arrivo va registrato col pettorale digitato').toEqual([126]);
    expect(stato.campo, 'il campo si svuota, pronto per il prossimo').toBe('');
    expect(stato.etichetta, 'e il pulsante torna a ARRIVO').toBe('ARRIVO');
  });

  test('il pulsante grande dice a colpo d\'occhio cosa sta per fare', async ({ page }) => {
    await traguardoPronto(page);

    await expect(page.locator('#btnArrivo')).toHaveText('ARRIVO');
    await page.tap('#padGrid button:text-is("1")');
    await expect(page.locator('#btnArrivo')).toHaveText('ARRIVO 1');
    await page.tap('#padGrid button:text-is("2")');
    await expect(page.locator('#btnArrivo')).toHaveText('ARRIVO 12');

    // cancella una cifra
    await page.tap('#padGrid button:text-is("⌫")');
    await expect(page.locator('#btnArrivo')).toHaveText('ARRIVO 1');

    // svuota tutto
    await page.tap('#padGrid button:text-is("C")');
    await expect(page.locator('#btnArrivo')).toHaveText('ARRIVO');
    await expect(page.locator('#quickBib')).toHaveValue('');
  });

  test('a campo vuoto registra il solo tempo, come faceva la barra spaziatrice', async ({ page }) => {
    await traguardoPronto(page);

    await page.tap('#btnArrivo');
    const stato = await page.evaluate(() => ({
      arrivi: S.arrivi.map(a => a.pett),
      senzaPett: C.n.senzaPett,
    }));
    expect(stato.arrivi, 'arrivo senza pettorale').toEqual([null]);
    confrontaNumero('arrivi segnalati come senza pettorale', 1, stato.senzaPett);
  });
});

test.describe('Assegnazione posticipata col tastierino', () => {
  test('completare un pettorale mancante non usa la tastiera di sistema', async ({ page }) => {
    await traguardoPronto(page);

    // un arrivo al volo, senza pettorale
    await page.tap('#btnArrivo');
    await expect(page.locator('#arrTable tbody tr')).toHaveCount(1);

    // il campo del pettorale nell'elenco non deve aprire la tastiera
    const cella = page.locator('#arrTable tbody tr input.mono').first();
    await expect(cella).toHaveAttribute('inputmode', 'none');
    const soloLettura = await cella.evaluate(e => e.readOnly);
    expect(soloLettura, "la cella non deve essere scrivibile da tastiera sul telefono").toBe(true);

    // toccandola si apre lo stesso tastierino, in modalità assegnazione
    await cella.tap();
    await expect(page.locator('.padmodo')).toBeVisible();
    await expect(page.locator('.padmodo')).toContainText('Assegni il pettorale');
    await expect(page.locator('#arrTable tbody tr.inmodifica')).toHaveCount(1);

    for (const cifra of ['1', '2', '3']) {
      await page.tap(`#padGrid button:text-is("${cifra}")`);
    }
    await expect(page.locator('#btnArrivo')).toHaveText('ASSEGNA 123');
    await page.tap('#btnArrivo');

    const stato = await page.evaluate(() => ({
      arrivi: S.arrivi.map(a => a.pett),
      senzaPett: C.n.senzaPett,
      modo: !!document.querySelector('.padmodo'),
      etichetta: document.querySelector('#btnArrivo').textContent,
    }));
    expect(stato.arrivi, 'il pettorale va assegnato a quell\'arrivo').toEqual([123]);
    confrontaNumero('arrivi ancora senza pettorale', 0, stato.senzaPett);
    expect(stato.modo, 'la modalità assegnazione si chiude da sola').toBe(false);
    expect(stato.etichetta, 'e si torna pronti per il prossimo arrivo').toBe('ARRIVO');
  });

  test('assegnare un pettorale non crea un arrivo in più', async ({ page }) => {
    await traguardoPronto(page);
    await page.tap('#btnArrivo');

    await page.locator('#arrTable tbody tr input.mono').first().tap();
    await page.tap('#padGrid button:text-is("9")');
    await page.tap('#btnArrivo');

    confrontaNumero('arrivi totali dopo una assegnazione', 1,
      await page.evaluate(() => S.arrivi.length));
  });
});

test.describe('Volata: nessun ritardo, nessun raggruppamento', () => {
  /*
   * Attenzione al modo in cui si tocca.
   *
   * page.tap() fa i suoi controlli prima di agire e introduce un ritardo
   * suo: misurato, produce tocchi a ~300 ms su Android e ~900 ms su iPhone.
   * Con quegli intervalli un test "a 200 ms" passerebbe anche con un blocco
   * anti-doppio-tocco attivo, cioè non proverebbe nulla.
   *
   * Qui si usa page.touchscreen.tap(), che invia il tocco e basta, E si
   * verificano gli intervalli REALMENTE ottenuti: se l'ambiente diventasse
   * troppo lento il test fallisce invece di passare a vuoto.
   */

  /** Coordinate del centro del pulsante ARRIVO (che non si sposta mai). */
  async function centroArrivo(page) {
    const b = await page.locator('#btnArrivo').boundingBox();
    return [b.x + b.width / 2, b.y + b.height / 2];
  }

  /**
   * Riscaldamento, e allo stesso tempo misura di quanto costa UN tocco.
   *
   * Inviare un tocco non è gratis: misurato, costa ~50 ms su Android e fino
   * a ~160 ms su WebKit quando la suite gira tutta insieme. Se si aspettasse
   * un tempo fisso, l'intervallo reale finirebbe molto oltre quello voluto e
   * il test proverebbe qualcosa di diverso da quel che dichiara.
   *
   * Restituisce il costo mediano di un tocco, così chi chiama può calcolare
   * quanto attendere per ottenere davvero l'intervallo che gli serve.
   * Gli arrivi del riscaldamento vengono buttati via.
   */
  async function scaldaMotore(page, x, y) {
    for (let i = 0; i < 5; i++) await page.touchscreen.tap(x, y);
    const ms = await page.evaluate(() => S.arrivi.map(a => a.ms));
    await page.evaluate(() => { S.arrivi = []; touched(); });
    return ms.length > 2 ? mediana(intervalli(ms)) : 0;
  }

  /** Attesa da chiedere per ottenere un intervallo reale di `obiettivo` ms. */
  const attesaPer = (obiettivo, costoTocco) => Math.max(0, obiettivo - costoTocco);

  const intervalli = ms => ms.slice(1).map((v, i) => v - ms[i]);

  function mediana(v) {
    const o = v.slice().sort((a, b) => a - b);
    return o.length % 2
      ? o[(o.length - 1) / 2]
      : Math.round((o[o.length / 2 - 1] + o[o.length / 2]) / 2);
  }

  /**
   * Esegue la raffica di tocchi e restituisce il risultato.
   *
   * Due esiti diversi per due problemi diversi:
   *  - conteggio sbagliato  -> difetto della app, si fallisce subito
   *  - tocchi troppo lenti  -> misura inattendibile per colpa dell'ambiente
   *                            (sotto carico WebKit rallenta), si ripete
   *
   * Così il test non diventa ballerino, ma non perde neanche di severità:
   * un blocco anti-doppio-tocco fa sbagliare il conteggio a ogni tentativo.
   */
  async function eseguiVolata(page, x, y, { quanti, attesa, tetto, descrizione }) {
    // Cinque tentativi: su WebKit, con la suite intera che gira in parallelo,
    // capita che l'invio dei tocchi rallenti. Il conteggio viene verificato a
    // ogni tentativo, quindi un difetto vero fallisce subito comunque.
    const TENTATIVI = 5;
    let peggiore = null;
    let attesaCorrente = attesa;
    for (let tentativo = 1; tentativo <= TENTATIVI; tentativo++) {
      await page.evaluate(() => { S.arrivi = []; touched(); });
      for (let i = 0; i < quanti; i++) {
        if (i && attesaCorrente) await page.waitForTimeout(attesaCorrente);
        await page.touchscreen.tap(x, y);
      }
      const stato = await page.evaluate(() => ({
        quanti: S.arrivi.length, ms: S.arrivi.map(a => a.ms),
      }));
      verificaVolata(stato, quanti, descrizione);       // il requisito vero
      const med = mediana(intervalli(stato.ms));
      if (med <= tetto) return stato;
      // Il costo di un tocco cambia anche durante la corsa, non solo al
      // riscaldamento: si attende un po' meno e si riprova. Il tetto invece
      // non si tocca — è quello che dà senso al conteggio.
      attesaCorrente = Math.max(0, attesaCorrente - (med - tetto) - 25);
      peggiore = { stato, med };
    }
    throw new Error(
      `\nDopo ${TENTATIVI} tentativi i tocchi restano troppo distanti: intervallo mediano ` +
      `${peggiore.med} ms, tetto ${tetto} ms.\n` +
      `  Intervalli: ${intervalli(peggiore.stato.ms).join(', ')} ms\n\n` +
      `  Il conteggio degli arrivi è sempre risultato corretto. Due cause possibili:\n` +
      `    1. l'ambiente di prova non riesce a inviare tocchi abbastanza ravvicinati\n` +
      `       (macchina lenta o troppi test in parallelo);\n` +
      `    2. la app introduce un ritardo fra un tocco e il successivo, abbastanza\n` +
      `       grande da distanziarli ma non da farne cadere nessuno.\n\n` +
      `  In entrambi i casi il test non proverebbe nulla, perciò fallisce invece di\n` +
      `  passare a vuoto. Non allentare il tetto: deve restare sotto la dimensione\n` +
      `  dei blocchi che si vogliono scoprire.\n`);
  }

  function verificaVolata(stato, attesi, descrizione) {
    if (stato.quanti !== attesi) {
      throw new Error(
        `\n${descrizione}\n` +
        `Sono stati registrati ${stato.quanti} arrivi invece di ${attesi}.\n\n` +
        `  Tempi registrati: ${stato.ms.join(', ')} ms\n` +
        `  Intervalli: ${intervalli(stato.ms).join(', ')} ms\n\n` +
        `  Qualcuno ha introdotto un ritardo, un blocco anti-doppio-tocco o un\n` +
        `  raggruppamento fra pressioni ravvicinate. Al traguardo questo fa\n` +
        `  sparire gli arrivi in volata: ogni pressione deve produrre un arrivo.\n`);
    }
    const unici = new Set(stato.ms);
    confrontaNumero('tempi distinti', attesi, unici.size,
      'Due arrivi non possono condividere lo stesso millisecondo.');
    for (let i = 1; i < stato.ms.length; i++) {
      expect(stato.ms[i], 'i tempi devono crescere').toBeGreaterThan(stato.ms[i - 1]);
    }
  }

  test('dieci pressioni a 200 ms di distanza producono dieci arrivi', async ({ page }) => {
    // Nei dati reali della Stradolcetto 26 atleti su 265 sono arrivati entro
    // un secondo dal precedente, con un minimo di 220 ms.
    await traguardoPronto(page);
    const [x, y] = await centroArrivo(page);
    const costoTocco = await scaldaMotore(page, x, y);

    // Il tetto deve stare SOTTO la dimensione dei blocchi che si vogliono
    // scoprire: con un tetto di 400 ms un anti-doppio-tocco da 300 ms
    // passerebbe inosservato, perché non farebbe cadere nessun arrivo.
    await eseguiVolata(page, x, y, {
      quanti: 10, attesa: attesaPer(200, costoTocco), tetto: 280,
      descrizione: 'Dieci pressioni ravvicinate, come una volata di gruppo al traguardo.',
    });
  });

  test('dieci pressioni il più rapide possibile: nessuna deve andare persa', async ({ page }) => {
    // Il caso limite: tocchi attaccati, molto più stretti di qualsiasi volata
    // vera. Serve a smascherare qualsiasi blocco o raggruppamento, anche breve.
    // La copertura più stretta arriva da Android, dove i tocchi partono a
    // 50-85 ms l'uno dall'altro: lì anche un blocco breve verrebbe scoperto.
    // WebKit è più lento e si ferma sui 250 ms, quindi il tetto vale per
    // entrambi ma è Android a fare il lavoro fine.
    await traguardoPronto(page);
    const [x, y] = await centroArrivo(page);
    await scaldaMotore(page, x, y);

    await eseguiVolata(page, x, y, {
      quanti: 10, attesa: 0, tetto: 300,   // nessuna pausa: solo il costo del tocco
      descrizione: 'Dieci pressioni attaccate, senza nessuna pausa fra una e l\'altra.',
    });
  });

  test('due pressioni a 220 ms, il caso più stretto della gara reale', async ({ page }) => {
    await traguardoPronto(page);
    const [x, y] = await centroArrivo(page);
    const costoTocco = await scaldaMotore(page, x, y);

    await eseguiVolata(page, x, y, {
      quanti: 2, attesa: attesaPer(220, costoTocco), tetto: 300,
      descrizione: 'È l\'intervallo più stretto misurato nella 7ª Stradolcetto: 220 ms.',
    });
  });

  test('anche con un pettorale digitato fra un arrivo e l\'altro', async ({ page }) => {
    await traguardoPronto(page);

    await page.tap('#btnArrivo');                          // volata: solo tempo
    await page.tap('#padGrid button:text-is("1")');
    await page.tap('#padGrid button:text-is("2")');
    await page.tap('#padGrid button:text-is("1")');
    await page.tap('#btnArrivo');                          // con pettorale 121
    await page.tap('#btnArrivo');                          // di nuovo solo tempo

    expect(await page.evaluate(() => S.arrivi.map(a => a.pett)))
      .toEqual([null, 121, null]);
  });
});

test.describe('Salvataggio immediato degli arrivi', () => {
  /*
   * Il salvataggio era ritardato di 350 ms. In quella finestra un
   * ricaricamento, una telefonata o il sistema che chiude il browser per
   * fare memoria si portavano via l'ultimo arrivo. Al traguardo non si
   * torna indietro: ora la scrittura è sincrona e immediata.
   */

  test('l\'arrivo è già in memoria nello stesso istante in cui viene registrato', async ({ page }) => {
    // La prova più stringente possibile: si legge localStorage nello stesso
    // blocco di codice, senza che passi un solo millisecondo.
    await traguardoPronto(page);

    const r = await page.evaluate(() => {
      segnaArrivo(126);
      const salvato = JSON.parse(localStorage.getItem('cronostrada.v1') || '{}');
      return {
        arriviInMemoria: (salvato.arrivi || []).length,
        pettorali: (salvato.arrivi || []).map(a => a.pett),
        partenzaSalvata: !!salvato.start,
      };
    });

    if (r.arriviInMemoria !== 1) {
      throw new Error(
        `\nL'arrivo non era ancora salvato subito dopo essere stato registrato.\n` +
        `  arrivi in localStorage: ${r.arriviInMemoria}, attesi 1\n\n` +
        `  La scrittura degli arrivi deve essere sincrona e immediata: un\n` +
        `  salvataggio ritardato è una finestra in cui un arrivo può sparire.\n`);
    }
    expect(r.pettorali, 'con il pettorale giusto').toEqual([126]);
    expect(r.partenzaSalvata, "e l'orario di partenza insieme a lui").toBe(true);
  });

  /**
   * Ricarica la pagina dopo `ritardo` millisecondi contati DENTRO la pagina,
   * così il tempo trascorso è davvero quello e non la latenza degli
   * strumenti di prova. Il valore misurato viaggia in window.name, che
   * sopravvive al ricaricamento.
   */
  async function ricaricaDopo(page, ritardo) {
    const navigazione = page.waitForEvent('load');    // in ascolto PRIMA di innescare
    await page.evaluate(ms => {
      const t0 = Date.now();
      setTimeout(() => {
        window.name = 'ricaricata:' + (Date.now() - t0);
        location.reload();
      }, ms);
    }, ritardo);
    await navigazione;
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);
    return page.evaluate(() => Number(String(window.name).split(':')[1]));
  }

  test('un arrivo sopravvive a un ricaricamento immediato della pagina', async ({ page }) => {
    await traguardoPronto(page);
    await page.tap('#btnArrivo');

    // 10 ms nominali: con la variabilità dei timer si resta comodamente
    // sotto i 50 ms richiesti. Il limite conta: sopra i 350 ms il test
    // passerebbe anche col vecchio salvataggio ritardato, senza provare nulla.
    const trascorso = await ricaricaDopo(page, 10);
    const r = { arrivi: await page.evaluate(() => S.arrivi.length), trascorso };

    if (r.arrivi !== 1) {
      throw new Error(
        `\nL'arrivo è andato perso ricaricando la pagina dopo ${r.trascorso} ms.\n` +
        `  arrivi ritrovati: ${r.arrivi}, atteso 1\n\n` +
        `  È lo scenario del telefono che si riavvia al traguardo: quello che\n` +
        `  è stato registrato deve essere già su disco.\n`);
    }
    expect(r.trascorso, 'il ricaricamento deve essere avvenuto entro 50 ms')
      .toBeLessThanOrEqual(50);
  });

  test('dieci arrivi in volata sopravvivono a un ricaricamento subito dopo l\'ultimo', async ({ page }) => {
    await traguardoPronto(page);
    const b = await page.locator('#btnArrivo').boundingBox();
    for (let i = 0; i < 10; i++) {
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    }
    expect(await page.evaluate(() => S.arrivi.length), 'i dieci arrivi prima del ricaricamento')
      .toBe(10);

    const trascorso = await ricaricaDopo(page, 10);
    const r = Object.assign({ trascorso }, await page.evaluate(() => ({
      arrivi: S.arrivi.length,
      ms: S.arrivi.map(a => a.ms),
    })));

    if (r.arrivi !== 10) {
      throw new Error(
        `\nDopo un ricaricamento a ${r.trascorso} ms dall'ultimo arrivo ne sono ` +
        `rimasti ${r.arrivi} su 10.\n` +
        `  Tempi ritrovati: ${r.ms.join(', ')} ms\n\n` +
        `  Una volata registrata e subito persa è il peggiore dei casi:\n` +
        `  chi era al traguardo giura di averli premuti tutti.\n`);
    }
    expect(new Set(r.ms).size, 'e sono dieci arrivi distinti').toBe(10);
    expect(r.trascorso, 'il ricaricamento deve essere avvenuto entro 50 ms')
      .toBeLessThanOrEqual(50);
  });
});

test.describe('Pannello del cronometro comprimibile', () => {
  test('un tocco lo riduce a una barra sottile e libera l\'elenco', async ({ page }) => {
    await traguardoPronto(page);
    await page.evaluate(() => { for (let i = 0; i < 15; i++) segnaArrivo(null); });
    await page.waitForTimeout(200);

    const misura = () => page.evaluate(() => {
      const c = document.querySelector('.clockcard');
      const box = c.getBoundingClientRect();
      const righe = [...document.querySelectorAll('#arrTable tbody tr')];
      return {
        altezza: Math.round(box.height),
        compatto: c.classList.contains('compatto'),
        tastierino: getComputedStyle(document.querySelector('#pad')).display !== 'none',
        orologio: getComputedStyle(document.querySelector('#clock')).display !== 'none',
        arrivo: document.querySelector('#btnArrivo').offsetHeight > 0,
        righeVisibili: righe.filter(r => {
          const q = r.getBoundingClientRect();
          return q.top >= box.bottom - 1 && q.bottom <= window.innerHeight + 1;
        }).length,
      };
    });

    const prima = await misura();
    expect(prima.compatto, 'di partenza il pannello è aperto').toBe(false);

    await page.tap('#btnCompatta');
    const dopo = await misura();

    expect(dopo.compatto, 'un tocco solo lo comprime').toBe(true);
    expect(dopo.orologio, 'nella barra resta il tempo corrente').toBe(true);
    expect(dopo.arrivo, 'e resta il pulsante ARRIVO').toBe(true);
    expect(dopo.tastierino, 'il tastierino invece sparisce').toBe(false);

    if (dopo.altezza >= prima.altezza / 2) {
      throw new Error(
        `\nIl pannello compresso è alto ${dopo.altezza}px contro i ${prima.altezza}px di prima: ` +
        `non è una barra sottile.\n`);
    }
    if (dopo.righeVisibili <= prima.righeVisibili) {
      throw new Error(
        `\nComprimendo il pannello le righe visibili dell'elenco sono passate da ` +
        `${prima.righeVisibili} a ${dopo.righeVisibili}.\n\n` +
        `  Serve proprio a questo: vedere quali righe sono ancora in arancione\n` +
        `  mentre si completano i pettorali mancanti.\n`);
    }

    // e da compresso si registra ancora
    await page.tap('#btnArrivo');
    expect(await page.evaluate(() => S.arrivi.length),
      'anche compresso il pulsante ARRIVO registra').toBe(16);
  });

  test('lo stato compresso viene ricordato fra un uso e l\'altro', async ({ page }) => {
    await traguardoPronto(page);
    await page.tap('#btnCompatta');
    expect(await page.evaluate(() => document.querySelector('.clockcard').classList.contains('compatto')))
      .toBe(true);

    await page.reload();
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);
    await page.waitForTimeout(200);

    const r = await page.evaluate(() => ({
      compatto: document.querySelector('.clockcard').classList.contains('compatto'),
      inMemoria: localStorage.getItem('cronostrada.compatto'),
    }));
    expect(r.compatto, 'dopo il ricaricamento resta compresso').toBe(true);
    expect(r.inMemoria, 'lo stato è ricordato in una chiave sua').toBe('1');

    // e si riapre
    await page.tap('#btnCompatta');
    await page.reload();
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.querySelector('.clockcard').classList.contains('compatto')),
      'e riaperto resta aperto').toBe(false);
  });

  test('azzerare la gara non cancella la preferenza sul pannello', async ({ page }) => {
    await traguardoPronto(page);
    await page.tap('#btnCompatta');
    await page.evaluate(() => { S = VUOTO(); fsHandle = null; touched(); });
    expect(await page.evaluate(() => localStorage.getItem('cronostrada.compatto')),
      'la preferenza vive in una chiave separata dai dati della gara').toBe('1');
  });

  test('entrando in assegnazione il cronometro si comprime ma il tastierino resta', async ({ page }) => {
    await traguardoPronto(page);
    await page.evaluate(() => { for (let i = 0; i < 15; i++) segnaArrivo(null); });
    await page.waitForTimeout(200);

    const prima = await page.evaluate(() =>
      Math.round(document.querySelector('.clockcard').getBoundingClientRect().height));

    await page.locator('#arrTable tbody tr.nobib input.mono').first().tap();

    const dopo = await page.evaluate(() => {
      const c = document.querySelector('.clockcard');
      return {
        altezza: Math.round(c.getBoundingClientRect().height),
        assegna: c.classList.contains('assegna'),
        orologio: getComputedStyle(document.querySelector('#clock')).display !== 'none',
        tastierino: getComputedStyle(document.querySelector('#pad')).display !== 'none',
      };
    });

    expect(dopo.assegna, 'la modalità assegnazione comprime il cronometro da sola').toBe(true);
    expect(dopo.orologio, 'il cronometro sparisce: qui conta l\'ora dell\'arrivo, non quella corrente')
      .toBe(false);
    expect(dopo.tastierino, 'il tastierino resta, è lo strumento che serve').toBe(true);
    expect(dopo.altezza, `il pannello deve rimpicciolirsi (era ${prima}px)`)
      .toBeLessThan(prima);
  });

  test('dopo aver assegnato, il campo resta pulito', async ({ page }) => {
    // Uscendo dalla modalità assegnazione il pannello cambia forma e il click
    // che segue la pressione su ASSEGNA finiva su un tasto del tastierino
    // spostatosi lì sotto: nel campo restava uno zero e il tocco successivo
    // avrebbe registrato il pettorale 0.
    await traguardoPronto(page);
    await page.evaluate(() => { for (let i = 0; i < 6; i++) segnaArrivo(null); });
    await page.waitForTimeout(200);

    await page.locator('#arrTable tbody tr.nobib input.mono').first().tap();
    for (const c of ['1', '2', '1']) await page.tap(`#padGrid button:text-is("${c}")`);
    await page.tap('#btnArrivo');
    await page.waitForTimeout(250);

    const r = await page.evaluate(() => ({
      campo: document.querySelector('#quickBib').value,
      etichetta: document.querySelector('#btnArrivo').textContent,
      assegnati: S.arrivi.filter(a => a.pett !== null).map(a => a.pett),
    }));

    expect(r.assegnati, 'il pettorale va assegnato').toEqual([121]);
    if (r.campo !== '') {
      throw new Error(
        `\nDopo l'assegnazione nel campo è rimasto "${r.campo}" e il pulsante dice ` +
        `"${r.etichetta}".\n\n` +
        `  Il tocco successivo registrerebbe quel pettorale invece del solo tempo.\n`);
    }
    expect(r.etichetta, 'e il pulsante torna pronto per il prossimo arrivo').toBe('ARRIVO');
  });
});

test.describe('Layout verticale', () => {
  test('cronometro e tastierino restano visibili mentre l\'elenco scorre', async ({ page }) => {
    await traguardoPronto(page);
    for (let i = 0; i < 12; i++) await page.tap('#btnArrivo');

    const prima = await page.evaluate(() => {
      const c = document.querySelector('.clockcard').getBoundingClientRect();
      return { y: Math.round(c.y), posizione: getComputedStyle(document.querySelector('.clockcard')).position };
    });
    expect(prima.posizione, 'il pannello del cronometro deve restare in alto').toBe('sticky');

    // scorro l'elenco verso il basso
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(120);

    const dopo = await page.evaluate(() => {
      const c = document.querySelector('.clockcard').getBoundingClientRect();
      const p = document.querySelector('#pad').getBoundingClientRect();
      const t = document.querySelector('#top').getBoundingClientRect();
      return {
        cronoVisibile: c.y >= t.height - 2 && c.y < innerHeight,
        padVisibile: p.y >= 0 && p.bottom <= innerHeight + 1,
        bottoneVisibile: (() => {
          const b = document.querySelector('#btnArrivo').getBoundingClientRect();
          return b.y >= 0 && b.bottom <= innerHeight + 1;
        })(),
      };
    });

    expect(dopo.cronoVisibile, 'il cronometro non deve sparire scorrendo').toBe(true);
    expect(dopo.padVisibile, 'il tastierino non deve sparire scorrendo').toBe(true);
    expect(dopo.bottoneVisibile, 'il pulsante ARRIVO non deve sparire scorrendo').toBe(true);
  });

  test('nessuna delle otto schede scorre in orizzontale, con la gara vera dentro', async ({ page }) => {
    // Con i dati veri (280 iscritti, 265 arrivi) le tabelle raggiungono la
    // loro larghezza massima: è lì che il problema si vede. Due schede
    // scorrevano di lato — Gara per la matrice delle categorie, Classifiche
    // per le sue nove colonne — e nessun test le copriva.
    await apriApp(page);
    await iniettaRiferimento(page);

    const problemi = [];
    const controlla = async etichetta => {
      await page.waitForTimeout(150);
      const m = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        schermo: window.innerWidth,
      }));
      if (m.doc > m.schermo + 1) {
        problemi.push(`  ${etichetta}: documento ${m.doc}px contro schermo ${m.schermo}px`);
      }
    };

    const schede = ['gara', 'iscritti', 'traguardo', 'classifiche',
      'premiazioni', 'societa', 'stati', 'export'];
    for (const v of schede) {
      await page.evaluate(x => go(x), v);
      if (v === 'classifiche') {
        for (const modo of ['gen', 'cat', 'soc']) {
          await page.evaluate(x => { ui.clsMode = x; render(); }, modo);
          await controlla(`scheda Classifiche, vista "${modo}"`);
        }
      } else {
        await controlla(`scheda ${v}`);
      }
    }

    if (problemi.length) {
      throw new Error(
        `\n${problemi.length} schede scorrono in orizzontale sul telefono:\n` +
        problemi.join('\n') +
        `\n\n  Una tabella troppo larga deve scorrere dentro il suo riquadro\n` +
        `  (classe .tw), non trascinarsi dietro tutta la pagina.\n`);
    }
  });

  test('la matrice delle categorie diventa un elenco di riquadri', async ({ page }) => {
    await apriApp(page);
    await page.evaluate(() => go('gara'));

    const m = await page.evaluate(() => {
      const t = document.querySelector('.matrix');
      const primaRiga = t.querySelector('tbody tr');
      const celle = [...primaRiga.children];
      return {
        intestazioneNascosta: getComputedStyle(t.querySelector('thead')).display === 'none',
        rigaImpilata: getComputedStyle(primaRiga).display === 'block',
        etichette: celle.map(c => c.getAttribute('data-col')),
        // ogni riquadro sta dentro lo schermo
        larghezzaRiga: Math.round(primaRiga.getBoundingClientRect().width),
        schermo: window.innerWidth,
      };
    });

    expect(m.intestazioneNascosta, "su telefono l'intestazione della tabella sparisce").toBe(true);
    expect(m.rigaImpilata, 'ogni fascia diventa un riquadro').toBe(true);
    expect(m.etichette.slice(0, 4), 'le etichette prendono il posto delle intestazioni')
      .toEqual(['Fascia', 'Categorie FIDAL accorpate', 'Premi', 'Iscritti']);
    expect(m.larghezzaRiga, 'il riquadro sta dentro lo schermo')
      .toBeLessThanOrEqual(m.schermo);
  });

  test('il pettorale nell\'elenco non viene mai tagliato', async ({ page }) => {
    // Un 105 che si legge "10" perché la casella è stretta è un errore che si
    // scopre a premiazione fatta. Serve spazio anche per quattro cifre.
    await traguardoPronto(page);
    await page.evaluate(() => {
      S.iscritti.push({
        id: 'lungo', pett: 1234, cognome: 'BIANCHI', nome: 'GIULIA', sesso: 'F',
        societa: 'ATL. TEST', nascita: '1990-01-01', conferma: 'S',
      });
      segnaArrivo(1234);
      segnaArrivo(105);
    });
    await expect(page.locator('#arrTable tbody tr')).toHaveCount(2);

    const celle = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#arrTable tbody tr input.cell.mono')).map(i => ({
        valore: i.value,
        visibile: Math.round(i.clientWidth),
        necessario: Math.round(i.scrollWidth),
      })));

    const tagliate = celle.filter(c => c.necessario > c.visibile + 1);
    if (tagliate.length) {
      throw new Error(
        `\n${tagliate.length} pettorali risultano tagliati nell'elenco arrivi:\n` +
        tagliate.map(c =>
          `  pettorale ${c.valore}: la casella mostra ${c.visibile}px ma ne servono ${c.necessario}px`
        ).join('\n') +
        `\n\n  Chi legge vedrebbe un numero diverso da quello registrato.\n`);
    }
  });

  test('nessuno scorrimento orizzontale e niente zoom a doppio tocco', async ({ page }) => {
    await traguardoPronto(page);

    /*
     * Lo scorrimento orizzontale non compare "in generale": compare in certi
     * stati e non in altri. Una versione precedente di questo test usava un
     * solo stato e lasciava passare un difetto vero, scoperto solo provando
     * il sito pubblicato. Qui si controlla dopo OGNI passaggio, perché è la
     * larghezza dei pezzi dell'intestazione a cambiare con il contenuto.
     */
    const controlla = async passaggio => {
      const m = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        schermo: window.innerWidth,
        card: (() => {
          const c = document.querySelector('.finish .card');
          return c ? Math.round(c.getBoundingClientRect().width) : 0;
        })(),
      }));
      if (m.doc > m.schermo + 1) {
        throw new Error(
          `\nLa pagina scorre in orizzontale dopo: ${passaggio}\n` +
          `  documento ${m.doc}px, schermo ${m.schermo}px ` +
          `(la scheda dell'elenco è larga ${m.card}px)\n\n` +
          `  Al traguardo si tiene il telefono con una mano sola: una pagina che\n` +
          `  balla di lato mentre si preme è inservibile.\n`);
      }
    };

    await controlla('apertura della schermata Arrivi');

    await page.tap('#padGrid button:text-is("1")');
    await page.tap('#padGrid button:text-is("2")');
    await page.tap('#padGrid button:text-is("0")');
    await page.tap('#btnArrivo');
    await controlla('un arrivo con pettorale');

    for (let i = 0; i < 3; i++) await page.tap('#btnArrivo');
    await controlla('tre arrivi senza pettorale');

    await page.evaluate(() => { for (let i = 0; i < 30; i++) segnaArrivo(null); });
    await page.waitForTimeout(200);
    await controlla('oltre trenta arrivi in elenco');

    await page.locator('#arrTable tbody tr.nobib input.mono').first().tap();
    await controlla('modalità assegnazione aperta');

    const m = await page.evaluate(() => ({
      scrollOrizzontale: document.documentElement.scrollWidth > window.innerWidth + 1,
      larghezzaDoc: document.documentElement.scrollWidth,
      larghezzaSchermo: window.innerWidth,
      // touch-action:manipulation disattiva lo zoom a doppio tocco senza
      // togliere il pizzico per ingrandire, che resta disponibile.
      tastoArrivo: getComputedStyle(document.querySelector('#btnArrivo')).touchAction,
      tastoPad: getComputedStyle(document.querySelector('#padGrid button')).touchAction,
      // niente ricarica trascinando in giù
      overscroll: getComputedStyle(document.body).overscrollBehaviorY,
      overscrollSupportato: CSS.supports('overscroll-behavior-y', 'contain'),
    }));

    expect(m.tastoArrivo, 'il pulsante ARRIVO non deve zoomare al doppio tocco').toBe('manipulation');
    expect(m.tastoPad, 'i tasti del tastierino non devono zoomare al doppio tocco').toBe('manipulation');

    // overscroll-behavior blocca la ricarica da trascinamento su Chrome e
    // Android. Safari su iPhone NON supporta questa proprietà: lì la difesa
    // vera è installare la app sulla schermata Home, dove il gesto di
    // ricarica non esiste. È il passaggio successivo previsto (PWA).
    if (m.overscrollSupportato) {
      expect(m.overscroll, 'trascinare in giù non deve ricaricare la pagina').toBe('contain');
    } else {
      expect(m.overscroll, 'motore senza overscroll-behavior: la proprietà non risulta').toBeFalsy();
      test.info().annotations.push({
        type: 'limite del motore',
        description: 'Safari/WebKit non supporta overscroll-behavior: su iPhone da browser '
          + 'il trascinamento verso il basso può ancora ricaricare. Si risolve installando '
          + 'la app sulla schermata Home.',
      });
    }
  });
});

test.describe('Conferma tattile e schermo acceso', () => {
  test('ogni arrivo dà una vibrazione e un lampo visivo', async ({ page }) => {
    await apriApp(page);
    // registro le chiamate a vibrate: su WebKit la funzione non esiste,
    // quindi la installo io e verifico che la app la usi quando c'è.
    await page.evaluate(() => {
      window.__vibrazioni = [];
      navigator.vibrate = m => { window.__vibrazioni.push(m); return true; };
    });
    await page.evaluate(gente => { S.iscritti = gente; touched(); }, ISCRITTI_FINTI);
    await page.tap('nav button:text-is("Arrivi")');
    await page.tap('#btnStart');

    await page.tap('#btnArrivo');
    const dopoUno = await page.evaluate(() => ({
      vibrazioni: window.__vibrazioni.length,
      lampo: document.querySelector('#flash').classList.contains('on'),
    }));
    confrontaNumero('vibrazioni dopo un arrivo', 1, dopoUno.vibrazioni);
    expect(dopoUno.lampo, 'il lampo visivo deve essere partito').toBe(true);

    await page.tap('#btnArrivo');
    await page.tap('#btnArrivo');
    confrontaNumero('vibrazioni dopo tre arrivi', 3,
      await page.evaluate(() => window.__vibrazioni.length),
      'Anche a raffica ogni arrivo deve dare la sua conferma.');
  });

  test('il lampo non intercetta mai i tocchi', async ({ page }) => {
    await traguardoPronto(page);
    const passa = await page.evaluate(() =>
      getComputedStyle(document.querySelector('#flash')).pointerEvents);
    expect(passa, 'il velo del lampo deve lasciar passare i tocchi').toBe('none');
  });

  test('lo schermo resta acceso durante la gara e si libera allo STOP', async ({ page }) => {
    // Wake Lock non esiste su WebKit e su Chromium è una proprietà in sola
    // lettura: va sostituita con defineProperty, e prima che la app parta.
    await page.addInitScript(() => {
      window.__wake = { richieste: 0, rilasci: 0 };
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
          request: async () => {
            window.__wake.richieste++;
            return {
              release: async () => { window.__wake.rilasci++; },
              addEventListener: () => { },
            };
          },
        },
      });
    });
    await apriApp(page);
    await page.tap('nav button:text-is("Arrivi")');
    await page.tap('#btnStart');
    await expect.poll(() => page.evaluate(() => window.__wake.richieste),
      { message: 'la app deve chiedere di tenere lo schermo acceso alla partenza' })
      .toBeGreaterThanOrEqual(1);

    await page.tap('#ctrlRow button:text-is("STOP cronometro")');
    await expect.poll(() => page.evaluate(() => window.__wake.rilasci),
      { message: 'allo STOP lo schermo deve tornare libero di spegnersi' })
      .toBeGreaterThanOrEqual(1);
  });
});
