'use strict';
/*
 * CHE CI STIA DENTRO, E CHE NIENTE SI ACCAVALLI
 *
 * Questi test guardano una cosa sola: quello che serve deve essere sullo
 * schermo, senza trascinare niente di lato e senza che due scritte si
 * stampino una sopra l'altra.
 *
 * Vengono da difetti veri, visti negli scatti e non trovati da nessun test:
 *   - in classifica, su telefono, il TEMPO finiva oltre il bordo destro —
 *     cioè la colonna per cui uno apre la pagina;
 *   - in premiazione il nome si stampava SOPRA la società, perché
 *     table-layout:fixed stringeva la colonna del nome a novanta punti;
 *   - fra gli iscritti i cognomi si leggevano "ESPOSIT", "COLOMI", "MARINC",
 *     e per arrivare alla data di nascita bisognava trascinare.
 *
 * La regola che ne è uscita: sotto i 560 punti le colonne di contorno
 * escono dalla riga e tornano sotto il nome. Qui si verifica che ci siano
 * ancora, e che quelle essenziali si vedano.
 */

const { test, expect } = require('@playwright/test');
const { apriApp, iniettaRiferimento, confrontaNumero } = require('./aiuto');

const TELEFONO = { width: 390, height: 844 };

/** Cosa si vede DAVVERO dentro il riquadro che scorre, e cosa no. */
const dentroAlRiquadro = (page, selettore) => page.evaluate(sel => {
  const t = document.querySelector(sel);
  if (!t) return null;
  // il contenitore che scorre: è lui a decidere cosa è visibile
  let box = t.parentElement;
  while (box && getComputedStyle(box).overflowX !== 'auto') box = box.parentElement;
  const lim = (box || document.documentElement).getBoundingClientRect();
  const leggi = riga => Array.from(riga.children)
    .filter(c => getComputedStyle(c).display !== 'none')
    .map(c => {
      const r = c.getBoundingClientRect();
      return {
        testo: c.textContent.trim(),
        dentro: r.left >= lim.left - 1 && r.right <= lim.right + 1,
      };
    });
  const intestazione = t.querySelector('thead tr');
  const prima = t.querySelector('tbody tr');
  const cont = box || document.documentElement;
  return {
    intestazione: intestazione ? leggi(intestazione) : [],
    riga: prima ? leggi(prima) : [],
    scorreDiLato: cont.scrollWidth > lim.width + 1,
    // le misure vanno nel messaggio: un fallimento che dice solo "non ci
    // sta" non si sistema, e su un altro computer i caratteri sono diversi
    larghezzaTabella: Math.round(t.getBoundingClientRect().width),
    larghezzaRiquadro: Math.round(lim.width),
  };
}, selettore);

/** Due elementi che si stampano uno sopra l'altro. */
const accavallamenti = (page, selettore) => page.evaluate(sel => {
  const fuori = [];
  for (const riga of document.querySelectorAll(sel + ' tbody tr')) {
    const pezzi = Array.from(riga.querySelectorAll('td'))
      .filter(c => getComputedStyle(c).display !== 'none' && c.textContent.trim())
      .map(c => ({ r: c.getBoundingClientRect(), t: c.textContent.trim().slice(0, 30) }));
    for (let i = 0; i < pezzi.length; i++) {
      for (let j = i + 1; j < pezzi.length; j++) {
        const a = pezzi[i].r, b = pezzi[j].r;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 2 && oy > 2) fuori.push(`"${pezzi[i].t}" sopra "${pezzi[j].t}" (${Math.round(ox)}px)`);
      }
    }
  }
  return fuori.slice(0, 6);
}, selettore);

async function gara(page, opzioni) {
  await page.setViewportSize(opzioni);
  await apriApp(page);
  await iniettaRiferimento(page);
  await page.evaluate(() => { S.cfg.nome = '7ª Stradolcetto'; S.cfg.luogo = 'Ovada'; touched(); });
}

test.describe('Su un telefono ci sta quello che conta', () => {
  test('in classifica il tempo è sullo schermo, non oltre il bordo', async ({ page }) => {
    await gara(page, TELEFONO);
    await page.evaluate(() => go('classifiche'));

    const v = await dentroAlRiquadro(page, '#clsBody table');
    const fuori = v.riga.filter(c => !c.dentro);
    if (fuori.length || v.scorreDiLato) {
      throw new Error(
        '\nIn classifica, su uno schermo da telefono, non ci sta tutto.\n' +
        `  tabella ${v.larghezzaTabella}px, riquadro ${v.larghezzaRiquadro}px\n` +
        (fuori.length ? '  restano fuori: ' + fuori.map(c => `"${c.testo}"`).join(', ') + '\n' : '') +
        '\n  Il tempo è la colonna per cui uno apre la classifica: se per leggerlo\n' +
        '  bisogna trascinare la tabella di lato, la pagina non serve.\n' +
        '  La tabella non deve mai essere più larga del suo riquadro, qualunque\n' +
        '  carattere abbia il sistema: le larghezze cambiano da un computer\n' +
        "  all'altro, e questo test gira anche su Linux.\n");
    }
    // e il tempo c'è davvero, non è sparito insieme alle colonne di contorno
    const testi = v.riga.map(c => c.testo).join(' | ');
    expect(testi, 'il tempo del primo deve essere leggibile').toContain('33:59');
  });

  test('la società e la fascia non spariscono: scendono sotto il nome', async ({ page }) => {
    await gara(page, TELEFONO);
    await page.evaluate(() => go('classifiche'));
    const sotto = await page.evaluate(() => {
      const s = document.querySelector('#clsBody table tbody tr .sottonome');
      return s ? { testo: s.textContent, visibile: getComputedStyle(s).display !== 'none' } : null;
    });
    expect(sotto, 'sotto il nome ci deve essere una riga con il resto').not.toBeNull();
    expect(sotto.visibile).toBe(true);
    expect(sotto.testo, 'con la società').toContain('ATL. SANTHIA');
  });

  test('in premiazione niente si stampa sopra altro', async ({ page }) => {
    await gara(page, TELEFONO);
    await page.evaluate(() => go('premiazioni'));
    const sovrapposti = await accavallamenti(page, '#premBody table');
    if (sovrapposti.length) {
      throw new Error(
        '\nIn premiazione due scritte si stampano una sopra l\'altra:\n' +
        sovrapposti.map(s => '  ' + s).join('\n') +
        '\n\n  Succedeva con table-layout:fixed: la colonna del nome si stringeva a\n' +
        '  novanta punti e il cognome sbordava sulla colonna accanto.\n');
    }
    const v = await dentroAlRiquadro(page, '#premBody table');
    const fuori = v.riga.filter(c => !c.dentro).map(c => c.testo);
    expect(fuori, 'e non resta niente oltre il bordo').toEqual([]);
  });

  test('gli iscritti diventano schede, e i cognomi si leggono per intero', async ({ page }) => {
    await gara(page, TELEFONO);
    await page.evaluate(() => go('iscritti'));

    const scheda = await page.evaluate(() => {
      const tr = document.querySelector('#iscTable tbody tr');
      const campo = k => {
        const td = Array.from(tr.querySelectorAll('td')).find(x => x.dataset.col === k);
        if (!td) return null;
        const inp = td.querySelector('input,select');
        const r = inp.getBoundingClientRect();
        return { largo: Math.round(r.width), alto: Math.round(r.height), valore: inp.value };
      };
      return {
        aRiquadri: getComputedStyle(tr).display === 'block',
        etichette: Array.from(tr.querySelectorAll('td[data-col]')).map(td => td.dataset.col),
        cognome: campo('Cognome'), nome: campo('Nome'), nascita: campo('Nascita'),
        larghezzaRiga: Math.round(tr.getBoundingClientRect().width),
      };
    });

    expect(scheda.aRiquadri, 'su telefono ogni iscritto è un riquadro, non una riga di tabella').toBe(true);
    expect(scheda.etichette, 'e ogni campo porta la sua etichetta, perché l\'intestazione non c\'è più')
      .toEqual(['Pett.', 'Cognome', 'Nome', 'M/F', 'Conf.', 'Società', 'Nascita', 'FIDAL', 'Fascia']);
    expect(scheda.larghezzaRiga, 'il riquadro sta nello schermo').toBeLessThanOrEqual(390);

    // un cognome vero ci deve stare: 120px sono circa dieci lettere
    expect(scheda.cognome.largo, 'il campo del cognome deve essere leggibile')
      .toBeGreaterThan(120);
    expect(scheda.cognome.alto, 'e premibile con un dito').toBeGreaterThanOrEqual(38);
    /* La data si legge in italiano, gg/mm/aaaa. Dentro resta ISO, ma nella
       casella no: era proprio quello il difetto della vecchia casella col
       calendarietto, che mostrava solo l'ISO e lasciava vuoto tutto il
       resto. Le prove per intero stanno in nascita.spec.js. */
    expect(scheda.nascita.valore, 'la data di nascita si legge, e in italiano')
      .toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  test('nessuna delle otto schede lascia fuori una colonna essenziale', async ({ page }) => {
    /* Si prova anche a 320 punti, la larghezza di un iPhone SE. Non è
       pignoleria: le larghezze dipendono dal carattere di sistema, e una
       pagina tarata sui 390 punti del computer di chi la scrive sfonda su
       una macchina con caratteri diversi. Se ci sta a 320 ci sta ovunque.
       Questo test è caduto in CI, su Linux, dopo essere passato qui. */
    for (const larghezza of [320, 390]) {
      await provaLeColonne(page, larghezza);
    }
    // e una volta con un carattere largo: è il modo di provare qui quello
    // che succede là, dove il carattere di sistema non è lo stesso
    await provaLeColonne(page, 390, 'Verdana, DejaVu Sans, sans-serif');
  });

  async function provaLeColonne(page, larghezza, carattere) {
    await gara(page, { width: larghezza, height: 844 });
    if (carattere) {
      await page.evaluate(f => {
        const s = document.createElement('style');
        s.textContent = `body,input,select,button,table{font-family:${f}!important}`;
        document.head.append(s);
      }, carattere);
      await page.waitForTimeout(120);
    }
    const essenziali = {
      classifiche: ['#clsBody table', ['Pos.', 'Pett.', 'Cognome', 'Nome', 'Tempo']],
      traguardo: ['#arrTable table', ['#', 'Pett.', 'Atleta', 'Tempo']],
      stati: ['#stTable table', ['Pett.', 'Cognome', 'Stato', 'Ritirato']],
    };
    const guasti = [];
    for (const [vista, [sel, attese]] of Object.entries(essenziali)) {
      await page.evaluate(v => go(v), vista);
      await page.waitForTimeout(120);
      const v = await dentroAlRiquadro(page, sel);
      if (!v) { guasti.push(`${vista}: non trovo la tabella (${sel})`); continue; }
      const misure = `(tabella ${v.larghezzaTabella}px, riquadro ${v.larghezzaRiquadro}px)`;
      if (v.scorreDiLato) guasti.push(`${vista}: la tabella è più larga del riquadro ${misure}`);
      const visibili = v.intestazione.filter(c => c.dentro).map(c => c.testo);
      for (const a of attese) {
        if (!visibili.includes(a)) guasti.push(`${vista}: la colonna "${a}" non è sullo schermo ${misure}`);
      }
    }
    if (guasti.length) {
      throw new Error(`\nColonne essenziali fuori dallo schermo, a ${larghezza} punti` +
        (carattere ? ` con il carattere ${carattere}` : '') + ':\n' +
        guasti.map(g => '  ' + g).join('\n') +
        '\n\n  La tabella non deve mai essere più larga del suo riquadro: le\n' +
        "  larghezze dipendono dal carattere di sistema e cambiano da un\n" +
        '  computer all\'altro.\n');
    }
  }
});

test.describe('Da computer lo spazio va a chi lo usa', () => {
  test('al traguardo la lista degli arrivi è più larga del pannello del cronometro', async ({ page }) => {
    await gara(page, { width: 1280, height: 800 });
    await page.evaluate(() => go('traguardo'));
    const m = await page.evaluate(() => {
      const p = document.querySelector('.clockcard').getBoundingClientRect();
      const l = document.querySelector('.finish .card').getBoundingClientRect();
      const righe = document.querySelectorAll('#arrTable tbody tr').length;
      const altezze = Array.from(document.querySelectorAll('#arrTable tbody tr'))
        .slice(0, 12).map(r => Math.round(r.getBoundingClientRect().height));
      return { pannello: Math.round(p.width), lista: Math.round(l.width), righe, altezze };
    });
    expect(m.lista, "l'elenco deve avere più spazio del pannello").toBeGreaterThan(m.pannello);
    expect(m.pannello, 'il pannello non deve prendersi mezzo schermo').toBeLessThanOrEqual(420);
    // righe su una riga sola: se il nome va a capo l'altezza raddoppia
    const alte = m.altezze.filter(h => h > 46);
    if (alte.length) {
      throw new Error(
        `\n${alte.length} righe dell'elenco arrivi vanno a capo su un monitor da 1280.\n` +
        `  altezze: ${m.altezze.join(', ')}\n\n` +
        "  Con l'elenco stretto nome e società non ci stavano su una riga, e si\n" +
        '  leggevano metà arrivi per schermata.\n');
    }
  });
});

test.describe('Niente zoom mentre si cronometra', () => {
  test('il viewport dice di no, e il pizzico di iPhone viene fermato', async ({ page }) => {
    await apriApp(page);
    const meta = await page.getAttribute('meta[name=viewport]', 'content');
    expect(meta, 'la pagina non si deve poter ingrandire').toContain('user-scalable=no');
    expect(meta, 'e nemmeno con un pizzico lento').toContain('maximum-scale=1');

    /* Safari da iPhone ignora user-scalable dal 2016: il pizzico si ferma
       solo rifiutando i gesti, che esistono solo lì. Qui si verifica che
       qualcuno stia davvero dicendo di no. */
    const fermati = await page.evaluate(() => {
      const esiti = {};
      for (const g of ['gesturestart', 'gesturechange', 'gestureend']) {
        const ev = new Event(g, { bubbles: true, cancelable: true });
        document.dispatchEvent(ev);
        esiti[g] = ev.defaultPrevented;
      }
      return esiti;
    });
    for (const [gesto, fermo] of Object.entries(fermati)) {
      expect(fermo, `il gesto ${gesto} deve essere rifiutato, o su iPhone la pagina si ingrandisce`)
        .toBe(true);
    }
  });

  test('il testo resta leggibile senza ingrandire: mai sotto i 13px dove si legge', async ({ page }) => {
    /* Togliere lo zoom è una rinuncia vera: chi non ci vede bene non può più
       ingrandire con le dita. Il patto è che allora il testo sia già grande
       abbastanza dove conta — il cronometro, i pettorali, i tempi. */
    await gara(page, TELEFONO);
    await page.evaluate(() => go('classifiche'));
    const piccoli = await page.evaluate(() => {
      const fuori = [];
      const riga = document.querySelector('#clsBody table tbody tr');
      for (const td of riga.querySelectorAll('td')) {
        if (getComputedStyle(td).display === 'none') continue;
        /* Si misura solo il testo che è IL DATO: si saltano le etichette
           (.tag) e la riga di servizio sotto il nome, che sono volutamente
           più piccole e non sono quello che si va a cercare. */
        const proprio = Array.from(td.childNodes)
          .filter(n => n.nodeType === 3 || (n.nodeType === 1 && !n.classList.contains('tag') && !n.classList.contains('sottonome')))
          .map(n => (n.textContent || '').trim()).join('');
        if (!proprio) continue;
        const px = parseFloat(getComputedStyle(td).fontSize);
        if (px < 13) fuori.push(`${px}px "${proprio.slice(0, 20)}"`);
      }
      const orologio = parseFloat(getComputedStyle(document.querySelector('.clock')).fontSize);
      return { fuori, orologio };
    });
    expect(piccoli.fuori, 'il testo che si legge davvero non deve stare sotto i 13px').toEqual([]);
    expect(piccoli.orologio, 'e il cronometro deve restare grande').toBeGreaterThan(20);
  });
});

/* ============================================================
   LA SCHEDA GARA SUL TELEFONO

   Era la pagina peggiore della app: cinquemila punti di altezza, quasi
   tutti presi dalla matrice delle categorie, e dentro una quantità di
   bersagli che un dito non prende — le crocette delle categorie erano alte
   quattordici punti. Per arrivare ai backup, che stanno in fondo, bisognava
   scorrere per mezzo minuto.
   ============================================================ */
test.describe('La scheda Gara si usa anche con le dita', () => {
  /** Tutto quello che si preme dentro la scheda Gara, con la sua misura. */
  const bersagli = page => page.evaluate(() => {
    const sez = document.querySelector('section.view[data-v="gara"]');
    const out = [];
    for (const e of sez.querySelectorAll('button, input, select')) {
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;          // nascosto
      if (e.type === 'checkbox') continue;                     // ha una regola sua
      out.push({
        cosa: (e.id || e.textContent || e.value || e.tagName).toString().trim().slice(0, 28),
        alto: Math.round(r.height),
      });
    }
    return out;
  });

  const misure = page => page.evaluate(() => ({
    altezza: document.documentElement.scrollHeight,
    scorrimentoDiLato: document.documentElement.scrollWidth - innerWidth,
    matriceVisibile: !!document.querySelector('#matrixBox table')
      && getComputedStyle(document.querySelector('#matrixBox')).display !== 'none',
    sunto: (document.querySelector('#matriceSunto').textContent || '').trim(),
    bottone: (document.querySelector('#btnMatrice').textContent || '').trim(),
    bottoneVisibile: getComputedStyle(document.querySelector('#btnMatrice')).display !== 'none',
  }));

  test('la matrice delle categorie sta chiusa, e il riassunto dice cosa c\'è dentro', async ({ page }) => {
    await gara(page, TELEFONO);
    await page.evaluate(() => go('gara'));

    const m = await misure(page);
    expect(m.matriceVisibile, 'di suo la matrice sta chiusa: sono diciotto fasce').toBe(false);
    expect(m.bottoneVisibile, 'e c\'è il pulsante per aprirla').toBe(true);
    expect(m.bottone).toBe('Apri');
    expect(m.sunto, 'il riassunto dice quante sono').toMatch(/18 fasce/);
    expect(m.sunto, 'e se c\'è qualcosa da sistemare').toMatch(/assegnate|fuori/);

    if (m.altezza > 2600) {
      throw new Error(
        `\nLa scheda Gara sul telefono è alta ${m.altezza} punti.\n\n` +
        '  Con la matrice aperta erano cinquemila, e per arrivare ai backup in\n' +
        '  fondo si scorreva per mezzo minuto. Se torna a crescere così, è\n' +
        '  perché qualcosa si è riaperto da solo.\n');
    }
    confrontaNumero('scorrimento orizzontale della scheda Gara', 0, m.scorrimentoDiLato);
  });

  test('aprendola si vede tutta, e resta aperta anche dopo', async ({ page }) => {
    await gara(page, TELEFONO);
    await page.evaluate(() => go('gara'));
    await page.click('#btnMatrice');
    await page.waitForFunction(() => !!document.querySelector('#matrixBox table'));

    let m = await misure(page);
    expect(m.matriceVisibile, 'premendo Apri la matrice compare').toBe(true);
    expect(m.bottone, 'e il pulsante cambia parola').toBe('Chiudi');

    // la scelta si ricorda: riaprendo la app resta com'era
    await page.reload();
    await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);
    await page.evaluate(() => { entraNellaApp('gara'); go('gara'); });
    m = await misure(page);
    expect(m.matriceVisibile, 'e la si ritrova aperta').toBe(true);
  });

  test('niente di quello che si preme è più piccolo di un polpastrello', async ({ page }) => {
    await gara(page, TELEFONO);
    await page.evaluate(() => { apriMatrice(true); go('gara'); });
    await page.waitForFunction(() => !!document.querySelector('#matrixBox table'));

    /* E il cestino della fascia non deve finire sopra la casella del nome:
       il riquadro gli lascia il suo posto a destra, non ci si sovrappone. */
    const accavallato = await page.evaluate(() => {
      const riga = document.querySelector('.matrix tbody tr');
      const nome = riga.querySelector('td:first-child input').getBoundingClientRect();
      const cestino = riga.querySelector('td:nth-child(5) button').getBoundingClientRect();
      const tocca = !(cestino.left >= nome.right || cestino.right <= nome.left ||
        cestino.top >= nome.bottom || cestino.bottom <= nome.top);
      return tocca ? { nome: Math.round(nome.right), cestino: Math.round(cestino.left) } : null;
    });
    if (accavallato) {
      throw new Error(
        '\nIl cestino della fascia si stampa sopra la casella del nome:\n' +
        `  la casella arriva a ${accavallato.nome}px, il cestino comincia a ${accavallato.cestino}px\n\n` +
        '  Premendo per correggere il nome si rischia di cancellare la fascia.\n');
    }

    const piccoli = (await bersagli(page)).filter(b => b.alto < 38);
    if (piccoli.length) {
      throw new Error(
        '\nNella scheda Gara si preme roba troppo piccola per un dito:\n' +
        piccoli.slice(0, 12).map(b => `  "${b.cosa}" alto ${b.alto}px`).join('\n') +
        (piccoli.length > 12 ? `\n  … e altri ${piccoli.length - 12}` : '') +
        '\n\n  Le crocette delle categorie erano alte 14 punti: per toglierne una\n' +
        '  bisognava azzeccare il pixel. Sotto i 38 non ci si va.\n');
    }
  });

  test('l\'avviso delle categorie senza fascia si vede anche a matrice chiusa', async ({ page }) => {
    /* È l'unica cosa lì dentro che va vista subito: quegli atleti non
       compaiono in nessuna classifica di categoria. */
    await gara(page, TELEFONO);
    await page.evaluate(() => {
      apriMatrice(false);
      S.matrice = S.matrice.slice(0, 2);      // le altre categorie restano orfane
      touched(); go('gara');
    });

    const r = await page.evaluate(() => ({
      // chiusa vuol dire NON VISIBILE: la tabella nel documento c'è comunque
      matriceVisibile: getComputedStyle(document.querySelector('#matrixBox')).display !== 'none',
      avviso: (document.querySelector('#matrixOrphans').textContent || '').trim(),
      avvisoVisibile: document.querySelector('#matrixOrphans .banner') !== null,
      sunto: (document.querySelector('#matriceSunto').textContent || '').trim(),
    }));

    expect(r.matriceVisibile, 'la matrice resta chiusa').toBe(false);
    expect(r.avvisoVisibile, 'ma l\'avviso no: quello si vede sempre').toBe(true);
    expect(r.avviso).toContain('Categorie senza fascia');
    expect(r.sunto, 'e il riassunto lo dice anche lui').toMatch(/fuori/);
  });

  test('da computer resta com\'era: matrice aperta e nessun pulsante in più', async ({ page }) => {
    await gara(page, { width: 1280, height: 900 });
    await page.evaluate(() => go('gara'));
    const m = await misure(page);
    expect(m.matriceVisibile, 'da computer la matrice si vede senza aprire niente').toBe(true);
    expect(m.bottoneVisibile, 'e il pulsante Apri non ha motivo di esserci').toBe(false);
  });
});
