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
const { apriApp, confrontaNumero } = require('./aiuto');

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
   * Qualche tocco a vuoto prima di misurare: i primi tocchi dopo l'avvio
   * sono molto più lenti degli altri e falserebbero gli intervalli. Gli
   * arrivi prodotti dal riscaldamento vengono buttati via.
   */
  async function scaldaMotore(page, x, y) {
    for (let i = 0; i < 4; i++) await page.touchscreen.tap(x, y);
    await page.evaluate(() => { S.arrivi = []; touched(); });
  }

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
    let peggiore = null;
    for (let tentativo = 1; tentativo <= 3; tentativo++) {
      await page.evaluate(() => { S.arrivi = []; touched(); });
      for (let i = 0; i < quanti; i++) {
        if (i && attesa) await page.waitForTimeout(attesa);
        await page.touchscreen.tap(x, y);
      }
      const stato = await page.evaluate(() => ({
        quanti: S.arrivi.length, ms: S.arrivi.map(a => a.ms),
      }));
      verificaVolata(stato, quanti, descrizione);       // il requisito vero
      const med = mediana(intervalli(stato.ms));
      if (med <= tetto) return stato;
      peggiore = { stato, med };
    }
    throw new Error(
      `\nDopo 3 tentativi i tocchi restano troppo distanti: intervallo mediano ` +
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
    await scaldaMotore(page, x, y);

    // Il tetto deve stare SOTTO la dimensione dei blocchi che si vogliono
    // scoprire: con un tetto di 400 ms un anti-doppio-tocco da 300 ms
    // passerebbe inosservato, perché non farebbe cadere nessun arrivo.
    await eseguiVolata(page, x, y, {
      quanti: 10, attesa: 140, tetto: 280,          // 140 + overhead reale ≈ 190 ms
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
      quanti: 10, attesa: 0, tetto: 300,
      descrizione: 'Dieci pressioni attaccate, senza nessuna pausa fra una e l\'altra.',
    });
  });

  test('due pressioni a 220 ms, il caso più stretto della gara reale', async ({ page }) => {
    await traguardoPronto(page);
    const [x, y] = await centroArrivo(page);
    await scaldaMotore(page, x, y);

    await eseguiVolata(page, x, y, {
      quanti: 2, attesa: 160, tetto: 400,
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
    for (let i = 0; i < 6; i++) await page.tap('#btnArrivo');

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

    expect(m.scrollOrizzontale,
      `la pagina non deve scorrere in orizzontale (documento ${m.larghezzaDoc}px, schermo ${m.larghezzaSchermo}px)`)
      .toBe(false);
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
