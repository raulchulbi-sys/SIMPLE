'use strict';
// Fresh browser profile. All HTTP responses come from this test or the local source tree.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.SIMPLE_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const origin = 'https://simple.invalid';
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const profiles = ['client', 'trainer'].map((role, i) => ({ id: id(i + 1), role, name: role }));
function session(owner, i) {
  return { id: id((owner === profiles[0].id ? 10000 : 20000) + i), user_id: owner,
    workout_date: i < 30 ? null : i < 65 ? '2025-12-31' : '2026-01-01', day: 'Día guardado',
    data: { [i % 2 ? 'routine_id' : 'routineId']: id(900 + i % 3), routine_name: 'Retirada ' + i, duration_seconds: 600,
      exercises: [{ name: 'Ejercicio <guardado>', notes: 'Nota del propietario', rest_seconds: 60,
        sets: [{ set: 1, kg: 12, reps: 8, rir: 0 }] }] } };
}
const ownCount = 1105;
const tables = { profiles, routines: [
  { id: id(901), owner_id: profiles[0].id, name: 'En papelera', deleted_at: '2026-02-01' },
  { id: id(902), owner_id: id(50), name: 'Asignación retirada', deleted_at: null }
], routine_assignments: [],
  workouts: [...Array.from({ length: ownCount }, (_, i) => session(profiles[0].id, i)),
    session(profiles[1].id, 9000)] };
for (const row of tables.workouts) row.fixtureDateOrder = row.workout_date || '';
const sdk = fs.readFileSync(path.join(root, 'tests/interior/mock-sdk.js'), 'utf8');
// Add the PostgREST cursor predicates used by this view to the repository's in-memory SDK.
function installCursorDouble() {
  const from = db.from.bind(db);
  db.from = table => {
    const query = from(table);
    if (table !== 'workouts') return query;
    const subset = predicate => query.in('id', mock.tables.workouts.filter(predicate).map(row => row.id));
    query.lt = (key, value) => subset(row => row[key] < value);
    query.or = expression => {
      const match = /^workout_date\.lt\.([^,]+),and\(workout_date\.eq\.([^,]+),id\.lt\.([^)]+)\),workout_date\.is\.null$/.exec(expression);
      if (!match || match[1] !== match[2]) throw Error('Unexpected cursor predicate');
      const [, date, , lastId] = match;
      return subset(row => row.workout_date === null || row.workout_date < date ||
        (row.workout_date === date && row.id < lastId));
    };
    const order = query.order.bind(query);
    query.order = (key, options) => {
      if (key === 'workout_date' && options.nullsFirst === false)
        return order('fixtureDateOrder', options);
      return order(key, options);
    };
    return query;
  };
}
async function enter(page, index) {
  await page.evaluate(async ({ tables, index }) => {
    mock.tables = structuredClone(tables);
    user = { id: tables.profiles[index].id, email: 'fixture@example.invalid' };
    await start();
  }, { tables, index });
  await page.locator('#app').waitFor({ state: 'visible' });
}
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.SIMPLE_CHROME_EXECUTABLE || undefined });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) {
        const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
        if (file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile())
          return route.fulfill({ path: file });
      }
      if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('supabase-js'))
        return route.fulfill({ contentType: 'text/javascript', body: sdk });
      if (url.pathname === '/auth/v1/settings')
        return route.fulfill({ json: { external: {} } });
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(4000);
    await page.goto(origin);
    await page.waitForFunction(() => typeof simpleAuth !== 'undefined' && !simpleAuth.busy && typeof start === 'function');
    await page.evaluate(installCursorDouble);
    const missing = [];
    for (const index of [0, 1]) {
      await page.setViewportSize({ width: index ? 360 : 390, height: 820 });
      if (index) await page.evaluate(() => resetAuthSession());
      await enter(page, index);
      await page.getByRole('button', { name: 'Mis rutinas', exact: true }).click();
      const tab = page.getByRole('button', { name: 'Mi historial', exact: true });
      if (!(await tab.count())) {
        const nav = await page.locator('#tabs button:visible').allTextContents();
        console.log(profiles[index].role, 'Navegación visible:', nav.map(x => x.trim()).filter(Boolean));
        missing.push(profiles[index].role);
        continue;
      }
      await tab.click();
      const history = page.locator('#history');
      const cards = history.locator('details');
      await cards.first().waitFor();
      if (index === 0) {
        assert.equal(await cards.count(), 25);
        for (let loaded = 25; loaded < ownCount; loaded += 25) {
          await history.getByRole('button', { name: 'Ver más sesiones' }).click();
          await page.waitForFunction(n => document.querySelectorAll('#history details').length === n,
            Math.min(loaded + 25, ownCount));
        }
        const titles = await cards.locator('.history-title').allTextContents();
        assert.equal(new Set(titles).size, ownCount);
        assert.equal(titles[0], 'Retirada ' + (ownCount - 1));
        assert.equal(titles.at(-1), 'Retirada 0');
        assert.equal(await history.getByText('Retirada 9000', { exact: true }).count(), 0);
      } else {
        assert.equal(await cards.count(), 1);
        assert.match(await cards.first().innerText(), /Retirada 9000/);
      }
      const summary = cards.last().locator('summary');
      await summary.click();
      assert.match(await cards.last().innerText(), /Ejercicio <guardado>/);
      assert.match(await cards.last().innerText(), /Nota del propietario/);
      assert.match(await cards.last().innerText(), /Descanso: 60 s/);
      assert.match(await cards.last().innerText(), /Duración de la sesión: 10 min/);
      const values = await cards.last().locator('.history-row:not(.history-label) span').allTextContents();
      assert.deepEqual(values, ['1', '12', '8', '0']);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (process.env.SIMPLE_HISTORY_SCREENSHOT && index === 0)
        await cards.last().screenshot({ path: process.env.SIMPLE_HISTORY_SCREENSHOT });
      assert.equal(await history.locator('button,input,textarea,select').count(), 0);
      assert.equal(await page.evaluate(() => mock.calls.some(c => c.write)), false);
      assert.deepEqual(await page.evaluate(() => mock.tables.workouts), tables.workouts);
    }
    assert.deepEqual(missing, [], 'Falta acceso desde Mis rutinas con la rutina retirada');
    // Delay a read from the former account, then sign in as a different fixture.
    await page.evaluate(() => {
      const from = db.from.bind(db);
      db.from = table => {
        const query = from(table);
        if (table === 'workouts') {
          const then = query.then.bind(query);
          query.then = (resolve, reject) => then(result => {
            if (window.historyRecord) {
              window.historyRecord = false;
              window.recordedHistory = structuredClone(result);
            }
            if (window.historyReplay) {
              window.historyReplay = false;
              resolve(window.recordedHistory);
            } else if (window.historyHold) {
              window.historyHold = false;
              window.releaseHistory = () => resolve(result);
            } else if (window.historyFail) {
              window.historyFail = false;
              resolve({ data: null, error: { message: 'fixture' } });
            } else resolve(result);
          }, reject);
        }
        return query;
      };
      window.historyHold = true;
    });
    async function openHistory() {
      await page.waitForFunction(() => {
        const nav = document.querySelector('#tMine, #tShared');
        return nav && nav.dataset.robustClick !== '1';
      });
      await page.getByRole('button', { name: 'Mis rutinas', exact: true }).click();
      await page.getByRole('button', { name: 'Mi historial', exact: true }).click();
    }
    await openHistory();
    await page.waitForFunction(() => typeof window.releaseHistory === 'function');
    await page.evaluate(() => resetAuthSession());
    await enter(page, 0);
    await page.evaluate(() => { mock.tables.workouts = []; window.historyFail = true; });
    await openHistory();
    const personal = page.locator('#history');
    await personal.getByText('No se pudo cargar el historial.', { exact: true }).waitFor();
    await personal.getByRole('button', { name: 'Reintentar' }).click();
    await personal.getByText('Todavía no tienes sesiones guardadas.').waitFor();
    await page.evaluate(async () => {
      window.releaseHistory();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.equal(await personal.locator('details').count(), 0);
    assert.equal(await personal.getByText('Todavía no tienes sesiones guardadas.').isVisible(), true);
    assert.equal(await page.evaluate(() => mock.calls.some(c => c.write)), false);
    await page.evaluate(rows => {
      mock.tables.workouts = rows;
      window.historyRecord = true;
    }, tables.workouts.slice(0, 30).map(row => ({
      ...row, workout_date: '2026-04-01', fixtureDateOrder: '2026-04-01'
    })));
    await openHistory();
    const currentCards = personal.locator('details');
    await page.waitForFunction(() => document.querySelectorAll('#history details').length === 25);
    await page.evaluate(() => { window.historyReplay = true; });
    await personal.getByRole('button', { name: 'Ver más sesiones' }).click();
    await personal.getByRole('button', { name: 'Reintentar' }).waitFor();
    assert.equal(await currentCards.count(), 25);
    // Another tab removes a previously displayed workout. The remaining five must still follow.
    await page.evaluate(() => { mock.tables.workouts.pop(); });
    await personal.getByRole('button', { name: 'Reintentar' }).click();
    await page.waitForFunction(() => document.querySelectorAll('#history details').length === 30);
    assert.equal(await currentCards.last().locator('.history-title').innerText(), 'Retirada 0');
    console.log('OK · página repetida rechazada sin duplicados, reintento correcto');
    console.log('OK · borrado concurrente en la primera página, cinco sesiones restantes accesibles');
    console.log('OK · respuesta de cuenta anterior descartada, error y reintento, cuenta vacía');
    console.log('OK · Chrome · dos roles, rutina ausente, 1.106 sesiones, paginación, aislamiento, series y notas, cero escrituras');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
