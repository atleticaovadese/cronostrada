'use strict';
/* Genera gli screenshot della schermata Arrivi su iPhone e Android. */

const { chromium, webkit, devices } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const RADICE = path.resolve(__dirname, '..');
// Le immagini finiscono dove indichi, fuori dal repository per non appesantirlo:
//     node tools/schermate.js <cartella-di-uscita>
const USCITA = process.argv[2] ? path.resolve(process.argv[2]) : path.join(RADICE, 'schermate');
const PORTA = 8778;

fs.mkdirSync(USCITA, { recursive: true });

const RIF = JSON.parse(fs.readFileSync(path.join(RADICE, 'reference_anon.json'), 'utf8'));
// una manciata di atleti veri (anonimizzati) per avere nomi credibili
// pettorali a tre cifre: fanno vedere meglio il tastierino all'opera
const ISCRITTI = RIF.iscritti
  .filter(x => String(x.pett).length === 3)
  .sort((a, b) => a.pett - b.pett)
  .slice(0, 40)
  .map((x, n) => ({
    id: 'i' + n, pett: x.pett, cognome: x.cognome, nome: x.nome, sesso: x.sesso,
    societa: x.societa, nascita: x.nascita, conferma: 'S',
  }));
const PETT_ESEMPIO = ISCRITTI[5].pett;
const PETT_ASSEGNATO = ISCRITTI[12].pett;   // un iscritto vero, non un numero a caso

async function scatta(nome, tipo, browserType) {
  const browser = await browserType.launch();
  const ctx = await browser.newContext({ ...devices[tipo] });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept().catch(() => { }));
  await page.goto(`http://127.0.0.1:${PORTA}/index.html`);
  await page.waitForFunction(() => typeof S !== 'undefined' && C !== null);

  await page.evaluate(({ gente, anno }) => {
    S.cfg.nome = '7ª Stradolcetto';
    S.cfg.anno = anno; S.cfg.data = anno + '-09-14'; S.cfg.km = 10;
    S.iscritti = gente;
    touched();
  }, { gente: ISCRITTI, anno: RIF._annoRiferimento });

  await page.tap('nav button:text-is("Arrivi")');
  await page.tap('#btnStart');

  // qualche arrivo, uno senza pettorale
  await page.evaluate(pettDisponibili => {
    const base = Date.now() - S.start;
    S.arrivi = [
      { id: 'a1', pett: pettDisponibili[0], ms: base + 2039680, corr: 0 },
      { id: 'a2', pett: pettDisponibili[1], ms: base + 2057440, corr: 0 },
      { id: 'a3', pett: null, ms: base + 2090310, corr: 0 },
      { id: 'a4', pett: pettDisponibili[2], ms: base + 2118900, corr: 0 },
    ];
    touched();
  }, ISCRITTI.slice(0, 3).map(i => i.pett));

  const salva = async etichetta => {
    const f = path.join(USCITA, `${nome}-${etichetta}.png`);
    await page.screenshot({ path: f });
    console.log('  ' + path.basename(f));
  };

  // 1. tastierino pronto
  await page.waitForTimeout(2600);
  await salva('1-tastierino');

  // 2. pettorale digitato: il pulsante diventa "ARRIVO <n>"
  for (const c of String(PETT_ESEMPIO)) {
    await page.tap(`#padGrid button:text-is("${c}")`);
  }
  await page.waitForTimeout(200);
  await salva('2-pettorale-digitato');

  // 3. assegnazione posticipata dall'elenco
  await page.tap('#padGrid button:text-is("C")');
  const cella = page.locator('#arrTable tbody tr.nobib input.mono').first();
  await cella.scrollIntoViewIfNeeded();
  await cella.tap();
  for (const c of String(PETT_ASSEGNATO)) {
    await page.tap(`#padGrid button:text-is("${c}")`);
  }
  await page.waitForTimeout(250);
  await salva('3-assegnazione');

  await browser.close();
}

(async () => {
  const srv = spawn('node', ['tools/serve.js', String(PORTA)], { cwd: RADICE, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  try {
    console.log('iPhone 14 (WebKit, il motore di Safari):');
    await scatta('iphone', 'iPhone 14', webkit);
    console.log('Pixel 7 (Chromium, Android):');
    await scatta('android', 'Pixel 7', chromium);
  } finally {
    srv.kill();
  }
  console.log('fatto');
})();
