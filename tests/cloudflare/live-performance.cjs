'use strict';

// Real-network paired landing measurements. No routes, cache disabling,
// downloaded/offline SDK, data seed or API writes. Uses the same explicit
// Pages identity arguments as live-hosting.cjs; optional --baseline is restricted
// to the verified public GitHub URL. 24 navigations are measurements, not cases.
const assert = require('node:assert/strict');
const path = require('node:path');
const H = require('./live-hosting.cjs');
const median = numbers => { const sorted = [...numbers].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };
async function main() {
  const config = H.parseArgs(process.argv.slice(2), ['--baseline']);
  const baseline = config.values['--baseline'] || H.GITHUB; assert.equal(baseline, H.GITHUB, 'Only verified public GitHub baseline is allowed');
  const report = {capturedAt: new Date().toISOString(), kind: 'Real HTTPS sessionless landing; exact public SDK and native HTTP cache; no interception or external blocking; no Auth submits, REST, Functions, AI or backend writes',
    identity: H.identity(config), baselineUrl: baseline, measurements: [], errors: [], limitations: [
      'Three samples per site/width/cache are a small desktop lab sample, not a universal latency claim.',
      'Cold means a fresh isolated browser context; machine DNS, sockets and CDN caches may already be warm.',
      'Sites use their actual production/staging public Auth settings GET and actual hosting cache policies.',
      '4x CPU is identical for both sites. No network throttling. Browser cache remains native.'
    ]};
  const browser = await H.playwright().chromium.launch({channel: 'msedge', headless: true});
  try {
    for (const width of [390, 1280]) for (let sample = 0; sample < 3; sample++) {
      const order = sample % 2 ? ['pages', 'github'] : ['github', 'pages'];
      for (const label of order) {
        const base = label === 'pages' ? config.stable : baseline, backend = label === 'pages' ? H.STAGING : H.PRODUCTION;
        const context = await browser.newContext({viewport: {width, height: 844}, serviceWorkers: 'block'});
        const net = H.attachNetwork(context, {origins: [new URL(base).origin], backend, files: config.files});
        const page = await context.newPage(), cdp = await context.newCDPSession(page); page.setDefaultTimeout(30000);
        await cdp.send('Network.enable'); await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
        // Observer records paint only; it does not replace application behavior.
        await page.addInitScript(() => {
          window.__hostingLargestPaint = null;
          try { new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__hostingLargestPaint = entry.startTime; }).observe({type: 'largest-contentful-paint', buffered: true}); } catch {}
        });
        try {
          for (const cache of ['cold', 'warm']) {
            const response = await page.goto(base, {waitUntil: 'load'}); await H.welcome(page);
            if (label === 'pages') await H.verifyRuntime(page, config);
            await page.waitForTimeout(500);
            const metrics = await page.evaluate(() => {
              const n = performance.getEntriesByType('navigation')[0], resources = performance.getEntriesByType('resource');
              return {ttfbMs: n.responseStart - n.requestStart, domContentLoadedMs: n.domContentLoadedEventEnd, loadMs: n.loadEventEnd,
                fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null, lcpMs: window.__hostingLargestPaint,
                documentTransferBytes: n.transferSize, documentDecodedBytes: n.decodedBodySize,
                resourceTransferBytes: resources.reduce((sum, item) => sum + item.transferSize, 0), resourceDecodedBytes: resources.reduce((sum, item) => sum + item.decodedBodySize, 0),
                resources: resources.map(item => ({url: new URL(item.name).origin + new URL(item.name).pathname, transferSize: item.transferSize, decodedBodySize: item.decodedBodySize, durationMs: item.duration})),
                requests: resources.length, authScreen: simpleAuth.screen, appVisible: document.getElementById('app').style.display !== 'none'};
            });
            const raw = await response.allHeaders(), headers = H.headersSummary(new Headers(raw));
            assert.equal(response.status(), 200); assert.equal(metrics.authScreen, 'welcome'); assert.equal(metrics.appVisible, false);
            assert.equal(net.violations.length, 0, 'Unexpected network operation'); assert.equal(net.pageErrors.length, 0, 'JavaScript page error');
            report.measurements.push({label, url: base, width, sample, order: order.indexOf(label), cache, cpuThrottle: 4, ...metrics, headers});
          }
          await net.finish(); assert.equal(net.failures.length, 0, 'Native request failed');
          assert(net.responses.some(row => row.url === backend + '/auth/v1/settings' && row.status === 200), 'Actual public settings read failed');
          assert(!net.responses.some(row => row.status >= 400 && !row.url.endsWith('/favicon.ico')), 'A real resource failed');
        } catch (error) { report.errors.push({label, width, sample, error: H.cleanError(error)}); }
        finally { await net.finish(); report.errors.push(...net.violations.map(row => ({label, width, sample, violation: row}))); await context.close().catch(() => {}); }
      }
    }
  } finally { await browser.close(); }
  report.summaries = [];
  for (const label of ['github', 'pages']) for (const width of [390, 1280]) for (const cache of ['cold', 'warm']) {
    const rows = report.measurements.filter(row => row.label === label && row.width === width && row.cache === cache);
    report.summaries.push({label, width, cache, samples: rows.length, ...Object.fromEntries(['ttfbMs', 'domContentLoadedMs', 'loadMs', 'fcpMs', 'lcpMs', 'documentTransferBytes', 'resourceTransferBytes', 'requests'].map(key => [key, rows.length ? median(rows.map(row => row[key]).filter(value => value !== null)) : null]))});
  }
  report.counts = {navigationMeasurements: report.measurements.length, expectedNavigationMeasurements: 24, uniqueFunctionalCases: 0, errors: report.errors.length};
  H.writeReport(config, report);
  console.log(JSON.stringify({identity: report.identity, counts: report.counts, summaries: report.summaries, errors: report.errors,
    output: config.output ? path.relative(path.resolve(__dirname, '../..'), config.output) : null}, null, 2));
  if (report.errors.length || report.measurements.length !== 24) process.exitCode = 1;
}
main().catch(error => { console.error(H.cleanError(error)); process.exitCode = 1; });
