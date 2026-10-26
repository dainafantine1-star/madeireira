import { defineConfig,devices } from '@playwright/test';
import { resolve } from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH||=resolve('.cache/playwright');
export default defineConfig({
  testDir:'./e2e',fullyParallel:false,workers:1,timeout:120000,
  reporter:[['list'],['html',{open:'never'}]],
  use:{trace:'retain-on-failure',screenshot:'only-on-failure',actionTimeout:20000,navigationTimeout:30000},
  projects:[
    {name:'chromium-desktop',use:{...devices['Desktop Chrome']}},
    // Firefox trace instrumentation stalls actions on this Windows host, even without snapshots.
    // Assertions, failure screenshots and error contexts remain enabled; Linux CI retains traces.
    {name:'firefox-desktop',use:{...devices['Desktop Firefox'],trace:process.platform==='win32'?'off':'retain-on-failure'}},
    {name:'webkit-desktop',use:{...devices['Desktop Safari']}},
    {name:'iphone-webkit',use:{...devices['iPhone 13']}},
    {name:'android-chromium',use:{...devices['Pixel 7']}}
  ]
});
