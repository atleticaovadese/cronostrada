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
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
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
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Serve la app su http, come fa GitHub Pages.
  webServer: {
    command: 'node tools/serve.js 8777',
    url: 'http://127.0.0.1:8777/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
