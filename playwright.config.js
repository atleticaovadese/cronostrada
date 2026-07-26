'use strict';
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test',
  fullyParallel: true,

  // Nessun tentativo ripetuto: questi test sono deterministici, girano su dati
  // fissi e non dipendono dalla rete. Un fallimento è un fallimento vero e non
  // va nascosto da un secondo tentativo fortunato.
  retries: 0,

  forbidOnly: !!process.env.CI,

  // Due worker, non "quanti core hai".
  // I test della volata misurano intervalli sotto i 300 ms fra un tocco e
  // l'altro: con quattro browser che si contendono la stessa CPU la misura
  // diventa inaffidabile e i test ballano. Meglio un minuto in più che un
  // fallimento che non significa niente.
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 7_000 },

  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list']],

  use: {
    baseURL: 'http://127.0.0.1:8777',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  },

  projects: [
    // I test di riferimento e funzionali girano da computer.
    {
      name: 'computer',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /telefono\.spec\.js/,
    },
    // I test del traguardo da telefono girano su due veri profili di
    // dispositivo, con tocco reale. iPhone usa WebKit, il motore di Safari:
    // è lì che il tastierino di sistema non ha il tasto invio.
    {
      name: 'iphone',
      use: { ...devices['iPhone 14'] },
      testMatch: /telefono\.spec\.js/,
    },
    {
      name: 'android',
      use: { ...devices['Pixel 7'] },
      testMatch: /telefono\.spec\.js/,
    },
  ],

  // Serve la app su http, come fa GitHub Pages.
  webServer: {
    command: 'node tools/serve.js 8777',
    url: 'http://127.0.0.1:8777/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
