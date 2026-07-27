'use strict';
/*
 * UN SUPABASE FINTO, ABBASTANZA VERO DA FIDARSI.
 *
 * Serve a una cosa che con il server vero non si può fare: mettere DUE
 * dispositivi davanti alla stessa gara, staccare la rete a tutti e due, farli
 * lavorare, e riattaccarla. È la sequenza che al campo capita davvero, ed è
 * l'unica in cui si può perdere qualcosa senza accorgersene.
 *
 * Le richieste di Playwright vengono intercettate qui in Node, quindi due
 * contesti diversi del browser possono condividere lo stesso oggetto `db`:
 * sono due telefoni che parlano con lo stesso server.
 *
 * COSA IMITA, e perché queste cose e non altre:
 *
 *  - LA PROPRIETÀ. Ogni gara ha un proprietario e si vede solo con il suo
 *    accesso, esattamente come fa l'RLS in 0002_rls_e_permessi.sql. Senza
 *    questo, il test "un altro account non vede le mie gare" non proverebbe
 *    niente.
 *  - L'IMMUTABILITÀ DEGLI ARRIVI. Un arrivo già presente non viene mai
 *    riscritto: `resolution=ignore-duplicates` si comporta come sul server.
 *    È la ragione per cui due dispositivi che premono insieme non si fanno
 *    male, e va verificata, non data per buona.
 *  - LE PAGINE. Content-Range con il totale, come PostgREST. La app scarica a
 *    pagine e controlla il totale: se il finto non troncasse mai, quel
 *    controllo non verrebbe mai messo alla prova.
 *
 * Cosa NON imita: i tipi, i vincoli, i trigger. Non è un database, è un
 * interlocutore. Le regole vere restano quelle delle migrazioni.
 */

const ORIGINE = 'https://bevisqihflqsbqvafmup.supabase.co';

/** Le chiavi primarie, come nello schema. */
const CHIAVI = {
  gare: ['id'],
  configurazione: ['gara_id'],
  fasce: ['id'],
  iscritti: ['id'],
  arrivi: ['id'],
  arrivi_correzioni: ['id'],
  ritiri: ['gara_id', 'pett'],
  risultati_pubblici: ['gara_id', 'pett'],
};

function nuovoServer(opzioni = {}) {
  return {
    utenti: new Map(),          // email -> { id }
    tabelle: Object.fromEntries(Object.keys(CHIAVI).map(t => [t, []])),
    richieste: [],              // per i test che vogliono guardare cosa è passato
    // Quante righe al massimo per risposta: come il tetto di PostgREST.
    massimoRighe: opzioni.massimoRighe || 1000,
    // Interruttori per i test: rete assente, server che sbaglia, tabella che
    // si rifiuta di rispondere (serve a provare che a metà non si scrive).
    giu: false,
    rompi: null,                // es. 'iscritti' -> 500, guasto del server: si riprova
    rifiuta: null,              // es. 'iscritti' -> 422, riga respinta: si mette da parte
    lento: 0,                   // millisecondi di attesa per richiesta
    // L'orologio è del server, come i trigger in 0001: il valore mandato dal
    // client si ignora. Un contatore invece dell'ora vera perché due righe
    // scritte nello stesso millisecondo devono comunque restare in ordine.
    orologio: 0,
  };
}

const chiave = (t, r) => CHIAVI[t].map(k => String(r[k])).join('|');

function idUtente(db, autorizzazione) {
  const m = /^Bearer\s+tok:(.+)$/.exec(autorizzazione || '');
  return m ? m[1] : null;
}

/** Le gare di un utente: è la politica gare_proprie, tradotta. */
const gareDi = (db, utente) => new Set(
  db.tabelle.gare.filter(g => g.proprietario === utente).map(g => g.id));

function applicaFiltri(righe, params) {
  let out = righe;
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    const m = /^eq\.(.*)$/.exec(v);
    if (!m) continue;
    const atteso = m[1];
    out = out.filter(r => String(r[k]) === atteso);
  }
  return out;
}

function applicaOrdine(righe, ordine) {
  if (!ordine) return righe;
  const parti = ordine.split(',').map(p => p.trim()).filter(Boolean);
  return righe.slice().sort((a, b) => {
    for (const p of parti) {
      const [col, verso] = p.split('.');
      const segno = verso === 'desc' ? -1 : 1;
      const x = a[col], y = b[col];
      if (x === y) continue;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (x < y ? -1 : 1) * segno;
    }
    return 0;
  });
}

/** I conteggi annidati, nella forma in cui li manda PostgREST. */
function aggiungiConteggi(db, righe, select) {
  const annidati = [...String(select || '').matchAll(/(\w+)\(count\)/g)].map(m => m[1]);
  if (!annidati.length) return righe;
  return righe.map(g => {
    const copia = Object.assign({}, g);
    for (const t of annidati) {
      copia[t] = [{ count: (db.tabelle[t] || []).filter(r => r.gara_id === g.id).length }];
    }
    return copia;
  });
}

async function montaServerFinto(contesto, db) {
  /* Se il gestore lancia, Playwright non risponde e il fetch nella pagina
     resta appeso per sempre: la coda non riparte più e il test scade dopo
     45 secondi senza dire perché. Meglio un 500 esplicito, che si legge.
     Successo davvero: tre test scaduti nello stesso giro, tutti qui. */
  await contesto.route(u => u.origin === ORIGINE, rotta =>
    servi(db, rotta).catch(async e => {
      try {
        await rotta.fulfill({
          status: 500, contentType: 'application/json',
          body: JSON.stringify({ message: 'il server finto è esploso: ' + (e && e.message) }),
        });
      } catch (e2) { /* pagina già chiusa: non c'è più nessuno a cui rispondere */ }
    }));
}

async function servi(db, rotta) {
  {
    const richiesta = rotta.request();
    const url = new URL(richiesta.url());
    const metodo = richiesta.method();
    const testa = await richiesta.allHeaders();
    db.richieste.push({ metodo, percorso: url.pathname + url.search });

    // Rete assente: come un fetch che non parte proprio.
    if (db.giu) { await rotta.abort('failed'); return; }
    if (db.lento) await new Promise(r => setTimeout(r, db.lento));

    const rispondi = (stato, corpo, intestazioni = {}) => rotta.fulfill({
      status: stato,
      contentType: 'application/json',
      headers: Object.assign({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Range',
      }, intestazioni),
      body: JSON.stringify(corpo === undefined ? null : corpo),
    });

    /* ---- accesso ---- */
    if (url.pathname.startsWith('/auth/v1/token')) {
      const corpo = JSON.parse(richiesta.postData() || '{}');
      if (url.search.includes('refresh_token')) {
        const utente = String(corpo.refresh_token || '').replace(/^ref:/, '');
        return rispondi(200, {
          access_token: 'tok:' + utente, refresh_token: 'ref:' + utente,
          expires_in: 3600, user: { id: utente },
        });
      }
      const email = String(corpo.email || '').toLowerCase();
      if (!db.utenti.has(email)) db.utenti.set(email, { id: 'utente-' + db.utenti.size });
      const u = db.utenti.get(email);
      return rispondi(200, {
        access_token: 'tok:' + u.id, refresh_token: 'ref:' + u.id,
        expires_in: 3600, user: { id: u.id, email },
      });
    }

    /* ---- classifica pubblica: qui non serve, si accetta e basta ---- */
    if (url.pathname.startsWith('/rest/v1/rpc/')) return rispondi(200, null);

    const tabella = url.pathname.replace('/rest/v1/', '');
    if (!CHIAVI[tabella]) return rispondi(404, { message: 'tabella sconosciuta: ' + tabella });

    const utente = idUtente(db, testa.authorization);
    if (!utente) return rispondi(401, { message: 'non autenticato' });

    if (db.rompi === tabella) return rispondi(500, { message: 'guasto simulato' });
    if (db.rifiuta === tabella) return rispondi(422, { message: 'riga respinta per prova' });

    const mie = gareDi(db, utente);
    const miaRiga = r => tabella === 'gare' ? r.proprietario === utente : mie.has(r.gara_id);

    /* ---- lettura ---- */
    if (metodo === 'GET') {
      const params = [...url.searchParams.entries()];
      let righe = applicaFiltri(db.tabelle[tabella].filter(miaRiga), params);
      righe = applicaOrdine(righe, url.searchParams.get('order'));
      const totale = righe.length;

      // Range, come lo manda la app quando scarica a pagine.
      let da = 0, a = Math.min(totale, db.massimoRighe) - 1;
      const range = /^(\d+)-(\d+)$/.exec(testa.range || '');
      if (range) {
        da = Number(range[1]);
        a = Math.min(Number(range[2]), da + db.massimoRighe - 1);
      }
      const fetta = aggiungiConteggi(db, righe.slice(da, a + 1), url.searchParams.get('select'));
      const parziale = fetta.length < totale;
      return rispondi(parziale ? 206 : 200, fetta, {
        'Content-Range': `${da}-${da + Math.max(fetta.length - 1, 0)}/${totale}`,
      });
    }

    /* ---- scrittura ---- */
    if (metodo === 'POST') {
      const corpo = JSON.parse(richiesta.postData() || '{}');
      const righe = Array.isArray(corpo) ? corpo : [corpo];
      const prefer = testa.prefer || '';
      const ignora = prefer.includes('ignore-duplicates');

      for (const r of righe) {
        if (tabella === 'gare' && !r.proprietario) r.proprietario = utente;
        // Scrivere su una gara che non è tua: è quello che l'RLS impedisce.
        if (!miaRiga(r) && !(tabella === 'gare' && r.proprietario === utente)) {
          return rispondi(403, { message: 'non è una tua gara' });
        }
        const elenco = db.tabelle[tabella];
        const i = elenco.findIndex(x => chiave(tabella, x) === chiave(tabella, r));
        const quando = new Date(Date.UTC(2026, 0, 1) + (++db.orologio)).toISOString();
        if (i < 0) elenco.push(Object.assign({}, r, { creato_il: quando, aggiornato_il: quando }));
        else if (!ignora) elenco[i] = Object.assign({}, elenco[i], r, { aggiornato_il: quando });
        // con ignore-duplicates una riga che c'è già NON si tocca: è
        // l'immutabilità degli arrivi, che qui viene messa alla prova
      }
      return rispondi(201, prefer.includes('return=minimal') ? null : righe);
    }

    return rispondi(405, { message: 'metodo non previsto: ' + metodo });
  }
}

/** Accede con la app come farebbe una persona, e attende che sia dentro. */
async function accediNellaApp(page, email = 'org@esempio.it', password = 'segreta') {
  const esito = await page.evaluate(async ([e, p]) => {
    const r = await accedi(e, p);
    if (r.ok) { scordaGareRemote(); impronte.clear(); }
    return r;
  }, [email, password]);
  if (!esito.ok) throw new Error('accesso finto non riuscito: ' + esito.errore);
  return esito;
}

/** Quante operazioni ci sono adesso nella coda di uscita. */
const codaDi = page => page.evaluate(async () => {
  try { return await contaCoda(); } catch (e) { return 0; }
});

/* Cosa è rimasto dentro, e perché. Serve quando un'attesa scade: sapere che
   ci sono 84 operazioni non dice niente, sapere che sono tutte rifiutate con
   403 dice tutto. */
const dettaglioCoda = page => page.evaluate(async () => {
  try {
    const ops = await leggiCoda();
    const conta = {};
    for (const o of ops) {
      const k = o.tipo + (o.bloccata ? ' BLOCCATA ' + (o.motivo || '') : '');
      conta[k] = (conta[k] || 0) + 1;
    }
    return conta;
  } catch (e) { return { errore: String(e && e.message || e) }; }
});

/* Attesa sulla coda fatta da qui, non con waitForFunction.
   waitForFunction guarda il valore di ritorno e una Promise è sempre vera:
   una condizione asincrona gli risulterebbe soddisfatta al primo giro. Con
   page.evaluate la promessa viene invece attesa davvero. */
async function attendiCoda(page, condizione, { timeout = 60_000, cosa = 'la coda' } = {}) {
  const fine = Date.now() + timeout;
  let n;
  for (;;) {
    n = await codaDi(page);
    if (condizione(n)) return n;
    if (Date.now() > fine) {
      throw new Error(`${cosa}: atteso invano, in coda ci sono ${n} operazioni\n  ` +
        JSON.stringify(await dettaglioCoda(page)));
    }
    await page.waitForTimeout(100);
  }
}

const attendiCodaVuota = (page, timeout = 60_000) =>
  attendiCoda(page, n => n === 0, { timeout, cosa: 'la coda non si è svuotata' });
const attendiCodaPiena = (page, timeout = 15_000) =>
  attendiCoda(page, n => n > 0, { timeout, cosa: 'la coda è rimasta vuota' });

module.exports = {
  ORIGINE, nuovoServer, montaServerFinto, accediNellaApp,
  codaDi, attendiCoda, attendiCodaVuota, attendiCodaPiena,
};
