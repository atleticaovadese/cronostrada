'use strict';
/*
 * CONVIVENZA CON L'APP PRESENZE — controllo permanente
 *
 * CronoStrada divide il progetto Supabase con un'altra app, che in "public"
 * tiene 43 tabelle con dentro persone vere: soci, presenze, rimborsi, note
 * sugli atleti. I due schemi sono separati e le politiche RLS di quell'app
 * negano tutto a chi non è autorizzato.
 *
 * PERCHÉ QUESTO TEST ESISTE
 * Non per la configurazione di oggi, che è stata verificata a mano: per
 * quella di domani. Basta che qualcuno, lavorando sull'app presenze, aggiunga
 * una politica permissiva del tipo "using (true)" perché un organizzatore
 * CronoStrada qualunque cominci a leggere l'anagrafica dei soci. Nessuno se
 * ne accorgerebbe, perché non è codice di CronoStrada a cambiare.
 *
 * Il test fa la parte del curioso e prova a leggere. Se ottiene anche una
 * sola riga, fallisce e dice quale tabella.
 *
 * DUE LIVELLI
 *  - anonimo: gira sempre, non serve nessuna credenziale
 *  - organizzatore estraneo: serve un account di prova, passato da variabili
 *    d'ambiente (in CI da GitHub Secrets, mai scritto nel repository)
 */

const { test, expect } = require('@playwright/test');

const URL_SUPABASE = process.env.SUPABASE_URL
  || 'https://bevisqihflqsbqvafmup.supabase.co';
// La chiave pubblicabile è pubblica per progetto: sta nel codice del sito,
// è previsto che si veda, e da sola non apre niente.
const CHIAVE_ANON = process.env.SUPABASE_ANON_KEY
  || 'sb_publishable_lWjLReXn12tsKqCYo8GOHw_OBmDCExe';

// Le tabelle dell'app presenze, quelle con dentro persone vere per prime.
const TABELLE_ALTRUI = [
  'members', 'member_permissions', 'join_requests', 'athlete_notes',
  'day_attendance', 'attendance', 'personal_bests', 'sessions',
  'races', 'race_results', 'race_signups', 'race_entries',
  'work_shifts', 'staff_absences', 'reimbursements', 'invoices',
  'raduno_participants', 'app_settings', 'coach_permissions', 'expenses',
];

/** Legge una tabella e dice quante righe ha ottenuto davvero. */
async function provaLettura(request, tabella, intestazioni) {
  const r = await request.get(
    `${URL_SUPABASE}/rest/v1/${tabella}?select=*&limit=5`,
    { headers: intestazioni, failOnStatusCode: false });
  if (!r.ok()) return { righe: 0, stato: r.status() };
  let corpo = [];
  try { corpo = await r.json(); } catch { corpo = []; }
  return { righe: Array.isArray(corpo) ? corpo.length : 0, stato: r.status() };
}

function riporta(letture, chi) {
  const trapelate = letture.filter(l => l.righe > 0);
  if (!trapelate.length) return;
  throw new Error(
    `\n${chi} è riuscito a leggere dati dell'app presenze:\n` +
    trapelate.map(l => `  ${l.tabella}: ${l.righe} righe (HTTP ${l.stato})`).join('\n') +
    `\n\n  Le due app dividono lo stesso progetto Supabase. Se questo test\n` +
    `  fallisce, qualcosa è cambiato nelle politiche di "public" e i dati di\n` +
    `  persone vere sono raggiungibili da chi non dovrebbe.\n` +
    `  Non sistemarlo da CronoStrada: è l'altra app che va guardata.\n`);
}

test.describe('Isolamento dall\'app presenze', () => {
  test('un visitatore anonimo non legge nulla di "public"', async ({ request }) => {
    const intestazioni = { apikey: CHIAVE_ANON, Authorization: `Bearer ${CHIAVE_ANON}` };
    const letture = [];
    for (const tabella of TABELLE_ALTRUI) {
      letture.push({ tabella, ...await provaLettura(request, tabella, intestazioni) });
    }
    riporta(letture, 'Un visitatore anonimo');

    // e non deve nemmeno poter scrivere
    const scrittura = await request.post(`${URL_SUPABASE}/rest/v1/members`, {
      headers: { apikey: CHIAVE_ANON, Authorization: `Bearer ${CHIAVE_ANON}` },
      data: { name: 'intruso' }, failOnStatusCode: false,
    });
    expect(scrittura.ok(), 'un anonimo non deve poter scrivere fra i soci').toBe(false);
  });

  test('un organizzatore CronoStrada estraneo non legge nulla di "public"', async ({ request }) => {
    const email = process.env.SUPABASE_TEST_EMAIL;
    const password = process.env.SUPABASE_TEST_PASSWORD;

    if (!email || !password) {
      const avviso =
        'Credenziali di prova assenti (SUPABASE_TEST_EMAIL / SUPABASE_TEST_PASSWORD): '
        + 'il controllo sull\'organizzatore autenticato non è stato eseguito.';
      if (process.env.CI) {
        throw new Error(
          `\n${avviso}\n\n  In CI questo controllo deve girare: è quello che verifica che un\n` +
          `  organizzatore CronoStrada qualunque non veda i soci dell'app presenze.\n` +
          `  Aggiungi i due valori fra i Secrets del repository.\n`);
      }
      test.info().annotations.push({ type: 'non eseguito', description: avviso });
      test.skip(true, avviso);
      return;
    }

    // Accesso vero al server di autenticazione: token autentico, non simulato.
    const accesso = await request.post(
      `${URL_SUPABASE}/auth/v1/token?grant_type=password`,
      { headers: { apikey: CHIAVE_ANON }, data: { email, password }, failOnStatusCode: false });
    expect(accesso.ok(), 'l\'account di prova deve poter accedere').toBe(true);
    const { access_token } = await accesso.json();
    expect(access_token, 'deve arrivare un token').toBeTruthy();

    const intestazioni = { apikey: CHIAVE_ANON, Authorization: `Bearer ${access_token}` };
    const letture = [];
    for (const tabella of TABELLE_ALTRUI) {
      letture.push({ tabella, ...await provaLettura(request, tabella, intestazioni) });
    }
    riporta(letture, 'Un organizzatore CronoStrada estraneo');

    // E non deve poter scrivere. Attenzione: PATCH e DELETE rispondono 200
    // con zero righe toccate, perché l'RLS filtra le righe PRIMA della
    // modifica. Un 200 non significa che sia successo qualcosa: bisogna
    // guardare quante righe tornano indietro.
    const modifica = await request.patch(
      `${URL_SUPABASE}/rest/v1/app_settings?key=neq.__nulla__`,
      { headers: { ...intestazioni, Prefer: 'return=representation' },
        data: { value: 'DIROTTATO' }, failOnStatusCode: false });
    let toccate = [];
    if (modifica.ok()) { try { toccate = await modifica.json(); } catch { toccate = []; } }
    expect(Array.isArray(toccate) ? toccate.length : 0,
      'nessuna impostazione dell\'app presenze deve poter essere modificata').toBe(0);

    const inserimento = await request.post(`${URL_SUPABASE}/rest/v1/app_settings`, {
      headers: intestazioni, data: { key: 'intruso', value: 'x' }, failOnStatusCode: false });
    expect(inserimento.ok(),
      'un organizzatore estraneo non deve poter inserire nell\'app presenze').toBe(false);
  });
});
