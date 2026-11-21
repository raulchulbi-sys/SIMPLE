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
    workout_date: i < 30 ? null : i < 65 ? '2025-12-31' : '2026-01-01', day: i % 5 ? 'MARTES / PULL' : 'LUNES / PUSH',
    data: { [i % 2 ? 'routine_id' : 'routineId']: id(900 + i % 3), routine_name: 'Retirada ' + i, day_name: i % 7 === 0 ? 'lunes / push' : i % 7 === 1 ? 'Sesión (A.1)' : '', duration_seconds: 600,
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
tables.workouts[0].data.day_name = 'LUNES / PUSH EXTRA';
tables.workouts[310].data.day_name = 'Entreno antiguo único';
tables.workouts[ownCount-2].data.day_name = 'Nuevo día';
tables.workouts[ownCount-3].data.day_name = '';
tables.workouts[ownCount-3].day = ' NUEVO  DIA ';
tables.workouts[311].data.day_name = 'Nuevo día / Movilidad';
tables.workouts.at(-1).data.day_name = 'Sesión exclusiva de la otra cuenta';
for (const row of tables.workouts) {
  row.fixtureDateOrder = row.workout_date || '';
  row.fixtureDateAsc = row.workout_date || '9999-12-31';
}
const sdk = fs.readFileSync(path.join(root, 'tests/interior/mock-sdk.js'), 'utf8');
// Add the PostgREST cursor predicates used by this view to the repository's in-memory SDK.
function installCursorDouble() {
  const from = db.from.bind(db);
  db.from = table => {
    const query = from(table);
    if (table !== 'workouts') return query;
    const select = query.select.bind(query);
    query.select = columns => {
      if (columns === 'id,user_id,day,session_name:data->>day_name') {
        const then = query.then.bind(query);
        query.then = (resolve,reject) => then(result => {
          if (mock.failNames) { mock.failNames = false; return resolve({data:null,error:{message:'offline'}}); }
          return resolve({...result,data:result.data.map(({id,user_id,day,data}) => ({id,user_id,day,session_name:data.day_name}))});
        },reject);
      }
      return select(columns);
    };
    const subset = predicate => query.in('id', mock.tables.workouts.filter(predicate).map(row => row.id));
    query.lt = (key, value) => subset(row => row[key] < value);
    query.gt = (key, value) => subset(row => row[key] > value);
    query.or = expression => {
      if (expression.startsWith('data->>day_name.imatch.')) {
        const match = /^data->>day_name\.imatch\.("(?:[^"\\]|\\.)*"),and\(or\(data->>day_name\.is\.null,data->>day_name\.eq\.""\),day\.imatch\.(.+)\)$/.exec(expression);
        if (!match || match[1] !== match[2]) throw Error('Unexpected name filter');
        const pattern = JSON.parse(match[1]);
        if (!pattern.startsWith('^') || !pattern.endsWith('$')) throw Error('Expected whole session name');
        return subset(row => new RegExp(pattern,'i').test(row.data.day_name || row.day));
      }
      const match = /^workout_date\.(gt|lt)\.([^,]+),and\(workout_date\.eq\.([^,]+),id\.(gt|lt)\.([^)]+)\),workout_date\.is\.null$/.exec(expression);
      if (!match || match[2] !== match[3] || match[1] !== match[4]) throw Error('Unexpected cursor predicate');
      const [, op, date, , , lastId] = match;
      const after = (a, b) => op === 'gt' ? a > b : a < b;
      return subset(row => row.workout_date === null || after(row.workout_date, date) ||
        (row.workout_date === date && after(row.id, lastId)));
    };
    query.update = patch => {
      const filters = {};
      const mutation = {
        eq(key, value) { filters[key] = value; return mutation; },
        select() { return mutation; },
        async single() {
          mock.calls.push({table, write:true});
          if (mock.rejectStage) return {error:{message:'statistics_stage_conflict'}};
          const row = mock.tables.workouts.find(x => x.id === filters.id && x.user_id === filters.user_id &&
            x.user_id === user.id && JSON.stringify(x.data) === filters.data);
          if (!row) return {error:{code:'PGRST116'}};
          if (Object.keys(patch).join() !== 'data') throw Error('Unexpected change outside workout data');
          row.data = structuredClone(patch.data);
          return {data:structuredClone(row), error:null};
        }
      };
      return mutation;
    };
    const order = query.order.bind(query);
    query.order = (key, options) => {
      if (key === 'workout_date' && options.nullsFirst === false)
        return order(options.ascending ? 'fixtureDateAsc' : 'fixtureDateOrder', options);
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
      assert.equal(await history.getByRole('button', {name:'Editar sesión'}).count(), 1);
      assert.equal(await history.getByRole('button', {name:/Eliminar/}).count(), 0);
      assert.equal(await history.locator('.personal-fields').count(), 0);
      const parent = page.locator(index ? '#tMine' : '#tShared');
      assert.equal(await tab.getAttribute('aria-current'), 'page');
      assert.equal(await page.locator('#tabs button.active').count(), 1);
      assert.equal(await tab.evaluate(el => el.matches('.active')), true);
      assert.equal(await parent.getAttribute('aria-current'), null);
      await parent.focus();
      await parent.press('Enter');
      assert.equal(await parent.getAttribute('aria-current'), 'page');
      assert.equal(await parent.evaluate(el => el === document.activeElement), true);
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
    // A failed logout invalidates the old read. The same account must still be able to browse.
    await page.evaluate(() => {
      window.historyHold = true;
      window.releaseHistory = null;
      db.auth.signOut = async () => ({ error: { message: 'Offline fixture' } });
    });
    await openHistory();
    await page.waitForFunction(() => typeof window.releaseHistory === 'function');
    await page.getByRole('button', { name: 'Salir', exact: true }).click();
    await page.getByText('No se pudo cerrar la sesión. Inténtalo de nuevo.', { exact: true }).waitFor();
    await page.evaluate(() => window.releaseHistory());
    await page.waitForFunction(() => document.querySelectorAll('#history details').length === 25);
    await personal.getByRole('button', { name: 'Ver más sesiones' }).click();
    await page.waitForFunction(() => document.querySelectorAll('#history details').length === 29);
    assert.equal(await currentCards.last().locator('.history-title').innerText(), 'Retirada 0');
    assert.equal(await page.evaluate(() => mock.calls.some(c => c.write)), false);
    await page.evaluate(rows => { mock.tables.workouts = rows; }, tables.workouts);
    await openHistory();
    const filter = personal.getByRole('button', {name:'Filtrar'});
    const picker = personal.getByLabel('Sesión de entrenamiento');
    await page.evaluate(({routine,copy,aid,days}) => {
      assignments = [
        {id:aid,client_id:user.id,trainer_routine_id:routine},
        {id:'copy-assignment',client_id:user.id,trainer_routine_id:'template',client_routine_id:copy}
      ];
      mock.tables.routine_assignments = assignments;
      mock.tables.routines.push({id:routine,name:'Plan asignado'});
      mock.tables.routine_days = days;
      mock.failNames = true;
    }, {routine:id(770),copy:id(771),aid:id(775),days:[
      ...['LUNES / PUSH','MARTES / PULL','MIÉRCOLES / LEG','Nuevo di\u0301a'].map((name,i)=>({
        id:id(780+i),routine_id:id(770),day_order:i,name
      })), {id:id(785),routine_id:id(771),day_order:0,name:'VIERNES / UPPER'}
    ]});
    await filter.click();
    await personal.getByText('No se han podido cargar todas las sesiones.').waitFor();
    await personal.getByRole('button',{name:'Reintentar carga de sesiones'}).click();
    await picker.getByRole('option',{name:'Entreno antiguo único',exact:true}).waitFor({state:'attached'});
    const choices = await picker.locator('option').allTextContents();
    assert.deepEqual(choices.slice(0,5),['Todas las sesiones','LUNES / PUSH','MARTES / PULL','MIÉRCOLES / LEG','VIERNES / UPPER']);
    assert.equal(choices.filter(x=>x.toLowerCase()==='lunes / push').length,1);
    assert.ok(choices.includes('LUNES / PUSH EXTRA'));
    for (const placeholder of ['Nuevo día', 'Nuevo di\u0301a', ' NUEVO  DIA '])
      assert.ok(!choices.includes(placeholder));
    assert.ok(!choices.includes('Sesión exclusiva de la otra cuenta'));
    async function apply(term, direction) {
      if (!await picker.isVisible()) await filter.click();
      await picker.selectOption({label:term});
      await personal.getByLabel('Orden por fecha').selectOption(direction);
      await personal.getByRole('button', {name:'Aplicar'}).click();
    }
    await apply('Nuevo día / Movilidad','desc');
    await currentCards.first().waitFor();
    assert.deepEqual(await currentCards.locator('.history-title').allTextContents(), ['Retirada 311']);
    await apply('LUNES / PUSH', 'asc');
    const expected = tables.workouts.filter(row => row.user_id === profiles[0].id &&
      (row.data.day_name || row.day).toLowerCase()==='lunes / push').sort((a,b) =>
        a.fixtureDateAsc.localeCompare(b.fixtureDateAsc) || a.id.localeCompare(b.id));
    for (let n = 25; n < expected.length; n += 25) {
      await personal.getByRole('button', {name:'Ver más sesiones'}).click();
      await page.waitForFunction(n => document.querySelectorAll('#history details').length === n, Math.min(n+25, expected.length));
    }
    assert.deepEqual(await currentCards.locator('.history-title').allTextContents(), expected.map(r => r.data.routine_name));
    await apply('MARTES / PULL','desc');
    assert.ok((await currentCards.locator('summary').allTextContents()).every(s=>s.includes('MARTES / PULL')));
    assert.equal(await currentCards.count(),25);
    await apply('MIÉRCOLES / LEG', 'asc');
    await personal.getByText('Todavía no hay entrenamientos guardados para esta sesión.').waitFor();
    await page.evaluate(() => { window.historyHold = true; window.releaseHistory = null; });
    await apply('MARTES / PULL', 'asc');
    await page.waitForFunction(() => typeof window.releaseHistory === 'function');
    await apply('Sesión (A.1)', 'desc');
    await currentCards.first().waitFor();
    await page.evaluate(() => window.releaseHistory());
    assert.match(await currentCards.first().innerText(), /Sesión \(A\.1\)/);
    await filter.click();
    await personal.getByRole('button', {name:'Restablecer'}).click();
    await currentCards.first().waitFor();
    assert.match(await currentCards.first().innerText(), /Retirada 1104/);
    assert.match(await currentCards.nth(1).locator('summary').innerText(), /Nuevo día/);
    assert.match(await currentCards.nth(2).locator('summary').innerText(), /NUEVO\s+DIA/);
    await currentCards.first().locator('summary').click();
    const edit = currentCards.first().getByRole('button', {name:'Editar sesión'});
    const dialog = page.getByRole('dialog', {name:'Editar sesión'});
    const weight = dialog.getByRole('textbox', {name:/Peso en kg/});
    const save = dialog.getByRole('button', {name:'Guardar cambios'});
    async function openEdit() { await edit.click(); await weight.waitFor(); }
    const writes = () => page.evaluate(() => mock.calls.filter(c => c.write).length);
    await openEdit();
    await weight.fill('20');
    await dialog.getByRole('button', {name:'Cancelar'}).click();
    assert.equal(await writes(), 0);
    await openEdit();
    await weight.fill('-1');
    await save.click();
    await dialog.getByText('Introduce un valor válido para KG.').waitFor();
    assert.equal(await writes(), 0);
    await weight.fill('22,5');
    await dialog.getByRole('textbox', {name:/Repeticiones/}).fill('10');
    await dialog.getByRole('textbox', {name:/Notas de/}).fill('Nota corregida');
    await dialog.getByRole('textbox', {name:/Descanso de/}).fill('90');
    await dialog.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await dialog.waitFor({state:'detached'});
    assert.equal(await writes(), 1);
    const wanted = structuredClone(tables.workouts);
    const exercise = wanted[ownCount-1].data.exercises[0];
    Object.assign(exercise.sets[0], {kg:'22.5',reps:'10'});
    Object.assign(exercise, {notes:'Nota corregida',rest_seconds:90});
    assert.deepEqual(await page.evaluate(() => mock.tables.workouts), wanted);
    await currentCards.first().getByText('Nota corregida', {exact:false}).waitFor();
    await openHistory();
    await currentCards.first().locator('summary').click();
    await openEdit();
    assert.equal(await weight.inputValue(), '22.5');
    await page.evaluate(id => { mock.tables.workouts.find(row => row.id === id).data.exercises[0].notes = 'Otra pestaña'; }, wanted[ownCount-1].id);
    await weight.fill('88');
    await save.click();
    await dialog.getByText(/La sesión ha cambiado/).waitFor();
    assert.equal(await save.isDisabled(), true);
    await dialog.getByRole('button', {name:'Cancelar'}).click();
    await openEdit();
    assert.equal(await weight.inputValue(), '22.5');
    assert.equal(await dialog.getByRole('textbox', {name:/Notas de/}).inputValue(), 'Otra pestaña');
    await page.evaluate(() => { mock.rejectStage = true; });
    await weight.fill('99');
    await save.click();
    await dialog.getByText(/etapa de estadísticas anterior/).waitFor();
    await dialog.getByRole('button', {name:'Cancelar'}).click();
    await page.evaluate(() => {
      const days = ['MARTES / PULL','LUNES / PUSH','MIÉRCOLES / LEG','LUNES / PUSH'];
      mock.tables.workouts = mock.tables.workouts.slice(0,4).map((row,i) => ({
        ...row, workout_date:'2026-11-' + (15+i), fixtureDateOrder:'2026-11-' + (15+i),
        data:{...row.data, routine_name:'Fuerza · Bloque 1',day_name:days[i]}
      }));
    });
    await openHistory();
    await apply('LUNES / PUSH','desc');
    await currentCards.nth(1).waitFor();
    await filter.click();
    const screenshots = process.env.SIMPLE_HISTORY_PREVIEWS;
    await page.locator('#toast').waitFor({state:'hidden'});
    for (const width of [320,390,1280]) {
      await page.setViewportSize({width,height:850});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const nav = await page.locator('#tabs button:visible').evaluateAll(buttons =>
        buttons.map(button => ({x:button.getBoundingClientRect().x,y:button.getBoundingClientRect().y,width:button.offsetWidth})));
      assert.equal(nav[0].y, nav[1].y);
      assert.ok(nav[0].x + nav[0].width <= nav[1].x);
      if (screenshots && width !== 320) await page.screenshot({path:path.join(screenshots,'historial-'+width+'.png')});
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(() => simpleTheme.set('dark'));
    if (screenshots) await page.screenshot({path:path.join(screenshots,'historial-oscuro.png')});
    await personal.getByRole('button', {name:'Filtrar'}).click();
    await currentCards.first().locator('summary').click();
    await openEdit();
    if (screenshots) await dialog.screenshot({path:path.join(screenshots,'editar-sesion.png')});
    assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth), false);
    await page.evaluate(() => resetAuthSession());
    await enter(page,1);
    assert.equal(await page.getByRole('dialog', {name:'Editar sesión'}).count(),0);
    await openHistory();
    assert.match(await currentCards.first().innerText(), /Retirada 9000/);
    await page.setViewportSize({width:320,height:750});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.evaluate(() => { window.historyHold = true; window.releaseHistory = null; });
    await filter.click();
    await page.waitForFunction(() => typeof window.releaseHistory === 'function');
    await page.evaluate(() => resetAuthSession());
    await enter(page,0);
    await openHistory();
    await filter.click();
    await picker.getByRole('option',{name:'Entreno antiguo único'}).waitFor({state:'attached'});
    await page.evaluate(async () => { window.releaseHistory(); await new Promise(resolve=>setTimeout(resolve,0)); });
    assert.equal(await picker.getByRole('option',{name:'Sesión exclusiva de la otra cuenta'}).count(),0);
    console.log('OK · selector por día asignado, copia, historial retirado, aislamiento y reintento');
    console.log('OK · filtro literal, fallback, ambas direcciones, cursor con fechas repetidas y nulas, respuesta obsoleta');
    console.log('OK · volver para ambos roles, móvil y escritorio, cancelar, validar, guardar una sola vez, conflicto y etapa anterior');
    console.log('OK · tras fallar el cierre de sesión, la misma cuenta vuelve a leer y paginar');
    console.log('OK · página repetida rechazada sin duplicados, reintento correcto');
    console.log('OK · borrado concurrente en la primera página, cinco sesiones restantes accesibles');
    console.log('OK · respuesta de cuenta anterior descartada, error y reintento, cuenta vacía');
    console.log('OK · Chrome · dos roles, rutina ausente, 1.106 sesiones, paginación, aislamiento, series y notas, navegación sin escrituras');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
