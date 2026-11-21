'use strict';

function personalSessionCard(row, expanded = false) {
  const day = row.data?.day_name || row.day;
  const date = simpleFormatDateKey(row.workout_date) || 'Fecha no disponible';
  return historySessionCard(row, row.data?.routine_name || 'Entrenamiento',
    [day, date].filter(Boolean).join(' · '), expanded, true);
}

// Read only the session labels from older workouts, including retired routines.
async function savedSessionNames(ownerId, isCurrent) {
  const names = new Set();
  let cursor = null;
  while (isCurrent()) {
    let query = db.from('workouts').select('id,user_id,day,session_name:data->>day_name')
      .eq('user_id', ownerId).order('id', {ascending:true}).limit(300);
    if (cursor) query = query.gt('id', cursor);
    const {data, error} = await query;
    if (!isCurrent()) return [];
    if (error || !Array.isArray(data)) throw Error('session_names_unavailable');
    if (!data.length) break;
    for (const row of data) {
      if (row.user_id !== ownerId || typeof row.id !== 'string' || !row.id || (cursor && row.id <= cursor))
        throw Error('invalid_session_names');
      cursor = row.id;
      names.add(row.session_name || row.day);
    }
  }
  return [...names].filter(name => typeof name === 'string' && name.trim())
    .sort((a,b) => a.localeCompare(b,'es',{numeric:true}));
}

async function routineSessionNames(routineId) {
  const {data, error} = await db.from('routine_days').select('routine_id,name')
    .eq('routine_id', routineId).order('day_order').order('id');
  if (error || !Array.isArray(data) || data.some(day => day.routine_id !== routineId))
    throw Error('routine_days_unavailable');
  return data.map(day => day.name);
}

async function personalSessionChoices(ownerId, isCurrent) {
  const direct = new Set(), sources = [];
  for (const a of assignments || []) {
    if (a.client_id !== ownerId || a.client_deleted_at) continue;
    if (a.client_routine_id) direct.add(a.client_routine_id);
    else sources.push(simpleClientRoutine.read(db,ownerId,a.trainer_routine_id).then(r => r.days.map(day => day.name)));
  }
  for (const routine of routines || []) {
    // reload() has already scoped this collection to the signed-in owner's active routines.
    if (routine.id && !routine.deleted_at) direct.add(routine.id);
  }
  for (const id of direct) sources.push(routineSessionNames(id));
  sources.push(savedSessionNames(ownerId, isCurrent));
  const results = await Promise.allSettled(sources);
  const names = new Map();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const name of result.value) {
      if (typeof name !== 'string' || !name.trim()) continue;
      if (/^nuevo\s+d[ií]a$/iu.test(name.trim().normalize('NFC'))) continue;
      const key = name.toLowerCase();
      if (!names.has(key)) names.set(key, name);
    }
  }
  return {names:[...names.values()], complete:results.every(result => result.status === 'fulfilled')};
}

function personalHistoryQuery(ownerId, term, ascending, cursor, size) {
  let query = db.from('workouts').select('id,user_id,day,workout_date,data').eq('user_id', ownerId);
  if (term) {
    // Match the whole saved label, including literal punctuation in routine names.
    const pattern = JSON.stringify('^' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
    query = query.or(`data->>day_name.imatch.${pattern},and(or(data->>day_name.is.null,data->>day_name.eq.""),day.imatch.${pattern})`);
  }
  if (cursor) {
    const op = ascending ? 'gt' : 'lt';
    if (cursor.workout_date === null) {
      query = query.is('workout_date', null)[op]('id', cursor.id);
    } else {
      query = query.or(`workout_date.${op}.${cursor.workout_date},and(workout_date.eq.${cursor.workout_date},id.${op}.${cursor.id}),workout_date.is.null`);
    }
  }
  return query.order('workout_date', {ascending, nullsFirst:false}).order('id', {ascending}).limit(size + 1);
}

function personalHistoryRowFollows(row, previous, ascending) {
  if (!previous) return true;
  if (row.workout_date === previous.workout_date)
    return ascending ? row.id > previous.id : row.id < previous.id;
  if (row.workout_date === null) return true;
  if (previous.workout_date === null) return false;
  return ascending ? row.workout_date > previous.workout_date : row.workout_date < previous.workout_date;
}

function renderPersonalHistory() {
  const box = $('history'), owner = user, epoch = simpleAuth.epoch;
  box.innerHTML = `
    <div class="personal-heading"><h2 tabindex="-1">Mi historial</h2>
      <button type="button" class="btn personal-toggle" aria-expanded="false" aria-controls="historyFilters">Filtrar</button></div>
    <form id="historyFilters" class="personal-filter card" hidden>
      <label>Sesión de entrenamiento<select name="term"><option value="">Todas las sesiones</option></select></label>
      <label>Orden por fecha<select name="order"><option value="desc">Más recientes primero</option><option value="asc">Más antiguas primero</option></select></label>
      <div class="personal-choices-status" hidden><span class="muted" role="status"></span>
        <button type="button" class="btn" hidden>Reintentar carga de sesiones</button></div>
      <div class="personal-filter-actions"><button type="reset" class="btn">Restablecer</button><button type="submit" class="btn primary" data-keep-enabled="true">Aplicar</button></div>
    </form>
    <p class="personal-applied muted" hidden></p>
    <div class="personal-sessions"></div><p class="muted" role="status"></p>
    <button type="button" class="btn personal-more" hidden>Ver más sesiones</button>`;
  const list = box.querySelector('.personal-sessions'), more = box.querySelector('.personal-more');
  const status = box.querySelector('.personal-sessions + [role="status"]'), form = box.querySelector('form');
  const toggle = box.querySelector('.personal-toggle'), summary = box.querySelector('.personal-applied');
  const isCurrent = () => list.isConnected && user === owner && simpleAuth.epoch === epoch;
  const seen = new Set(), size = 25;
  let term = '', ascending = false, cursor = null, generation = 0;

  const select = form.elements.term, feedback = form.querySelector('.personal-choices-status');
  const retry = feedback.querySelector('button'), notice = feedback.querySelector('[role="status"]');
  let loadingChoices = false, choicesReady = false;

  async function loadChoices() {
    if (loadingChoices || choicesReady || !isCurrent()) return;
    loadingChoices = true;
    feedback.hidden = false;
    select.disabled = select.options.length === 1;
    retry.hidden = true;
    notice.textContent = 'Cargando sesiones…';
    try {
      const {names, complete} = await personalSessionChoices(owner.id, isCurrent);
      if (!isCurrent()) return;
      const selected = select.value;
      select.replaceChildren(new Option('Todas las sesiones',''));
      for (const name of names) select.add(new Option(name, name));
      if (selected) {
        const match = names.find(name => name.toLowerCase() === selected.toLowerCase());
        if (!match) select.add(new Option(selected, selected));
        select.value = match || selected;
      }
      choicesReady = complete;
    } catch {
      choicesReady = false;
    } finally {
      loadingChoices = false;
      if (isCurrent()) {
        select.disabled = false;
        if (!form.hidden && document.activeElement === toggle) select.focus();
        feedback.hidden = choicesReady;
        retry.hidden = choicesReady;
        notice.textContent = choicesReady ? '' : 'No se han podido cargar todas las sesiones.';
      }
    }
  }
  retry.onclick = loadChoices;
  function setFilterOpen(open) {
    form.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      loadChoices();
      if (!select.disabled) select.focus();
    } else toggle.focus();
  }
  toggle.onclick = () => setFilterOpen(form.hidden);
  function applyFilters() {
    generation++;
    term = select.value;
    ascending = form.elements.order.value === 'asc';
    summary.textContent = [term && 'Sesión: ' + term, ascending && 'Más antiguas primero'].filter(Boolean).join(' · ');
    summary.hidden = !summary.textContent;
    toggle.classList.toggle('has-filters', !summary.hidden);
    setFilterOpen(false);
    cursor = null;
    seen.clear();
    list.replaceChildren();
    more.disabled = false;
    loadPage();
  }
  form.onsubmit = event => { event.preventDefault(); applyFilters(); };
  form.onreset = event => {
    event.preventDefault();
    form.elements.term.value = '';
    form.elements.order.value = 'desc';
    applyFilters();
  };
  async function loadPage() {
    if (!owner?.id || !isCurrent() || more.disabled) return;
    const request = generation;
    const current = () => isCurrent() && generation === request;
    more.disabled = true;
    more.hidden = !cursor;
    status.textContent = 'Cargando sesiones…';
    try {
      const {data, error} = await personalHistoryQuery(owner.id, term, ascending, cursor, size);
      if (!current()) return;
      if (error || !Array.isArray(data)) throw Error('personal_history_read');
      let previous = cursor;
      for (const row of data) {
        if (row.user_id !== owner.id || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(row.id)
          || (row.workout_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(row.workout_date))
          || !personalHistoryRowFollows(row, previous, ascending)) throw Error('personal_history_row');
        previous = row;
      }
      const page = data.slice(0, size);
      list.insertAdjacentHTML('beforeend', page.filter(row => !seen.has(row.id)).map(row => personalSessionCard(row)).join(''));
      page.forEach(row => seen.add(row.id));
      if (page.length) cursor = page[page.length - 1];
      status.textContent = seen.size ? '' : term ? 'Todavía no hay entrenamientos guardados para esta sesión.' : 'Todavía no tienes sesiones guardadas.';
      more.hidden = data.length <= size;
      more.textContent = 'Ver más sesiones';
    } catch {
      if (!current()) return;
      status.textContent = 'No se pudo cargar el historial.';
      more.textContent = 'Reintentar';
      more.hidden = false;
    } finally {
      if (current()) more.disabled = false;
    }
  }
  list.onclick = event => {
    const button = event.target.closest('button[data-edit-session]');
    if (button && isCurrent() && seen.has(button.dataset.editSession))
      openPersonalSessionEditor(button, owner, isCurrent);
  };
  more.onclick = loadPage;
  box.querySelector('h2').focus({preventScroll:true});
  loadPage();
}

async function openPersonalSessionEditor(button, owner, historyCurrent) {
  const box = $('history'), id = button.dataset.editSession;
  if (!historyCurrent() || box.querySelector('dialog[open]')) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'personal-edit';
  dialog.setAttribute('aria-labelledby', 'personalEditTitle');
  dialog.innerHTML = `<form>
    <h2 id="personalEditTitle">Editar sesión</h2><p class="muted personal-edit-name"></p>
    <div class="personal-fields"></div><p class="personal-message" role="status">Cargando sesión…</p>
    <div class="personal-filter-actions"><button type="button" class="btn">Cancelar</button>
    <button class="btn primary" type="submit" disabled>Guardar cambios</button></div></form>`;
  box.append(dialog);
  const form = dialog.querySelector('form'), message = dialog.querySelector('[role="status"]');
  const save = form.querySelector('[type="submit"]'), cancel = form.querySelector('[type="button"]');
  const current = () => historyCurrent() && button.isConnected && dialog.open;
  let session, saving = false;
  form.onsubmit = event => event.preventDefault();
  cancel.onclick = () => dialog.close();
  dialog.oncancel = event => { if (saving) event.preventDefault(); };
  dialog.onclose = () => { dialog.remove(); if (button.isConnected) button.focus(); };
  dialog.showModal();
  try {
    const {data, error} = await readOwnWorkout(id, owner.id);
    if (!current()) return;
    if (error || data?.id !== id || data.user_id !== owner.id || !Array.isArray(data.data?.exercises)) throw Error();
    session = data;
    dialog.querySelector('.personal-edit-name').textContent = [session.data.routine_name,
      session.data.day_name || session.day, simpleFormatDateKey(session.workout_date)].filter(Boolean).join(' · ');
    dialog.querySelector('.personal-fields').innerHTML = sessionExerciseFields(session.data.exercises, id);
    message.textContent = '';
    save.disabled = !session.data.exercises.some(Boolean);
  } catch {
    if (current()) message.textContent = 'No se pudo abrir la sesión. Cierra y vuelve a intentarlo.';
  }
  form.onsubmit = async event => {
    event.preventDefault();
    if (saving || !session || !current()) return;
    if (save.disabled) return;
    let changes;
    try { changes = editedSessionData(session.data, form, true); }
    catch (error) { message.textContent = error.message; return; }
    if (!changes) { message.textContent = 'No hay cambios que guardar.'; return; }
    saving = true;
    const controls = Array.from(form.elements);
    controls.forEach(el => { el.disabled = true; });
    message.textContent = 'Guardando…';
    try {
      const written = await updateOwnWorkout(id, owner.id, session.data, changes);
      if (!current()) return;
      if (written.error) throw written.error;
      if (written.data?.id !== id || written.data.user_id !== owner.id) throw Error('unexpected_write');
      const verified = await readOwnWorkout(id, owner.id);
      if (!current()) return;
      const row = verified.data;
      if (verified.error || row?.id !== id || row.user_id !== owner.id || !sameSessionData(row.data, changes))
        throw Error('unconfirmed');
      syncSessionObservation(session, row);
      const card = button.closest('details');
      dialog.close();
      card.insertAdjacentHTML('afterend', personalSessionCard(row, true));
      const edited = card.nextElementSibling;
      card.remove();
      edited.querySelector('button')?.focus();
      toast('Cambios guardados correctamente');
    } catch (error) {
      if (!current()) return;
      session = null;
      if (error.code === 'PGRST116' || error.message === 'workout_edit_conflict')
        message.textContent = 'La sesión ha cambiado. Cierra y vuelve a abrirla para revisar la última versión.';
      else if (error.message?.includes('statistics_stage_conflict'))
        message.textContent = 'Esta sesión pertenece a una etapa de estadísticas anterior y ya no se puede editar.';
      else message.textContent = 'No se han podido confirmar los cambios. Vuelve a abrir la sesión para comprobarla.';
    } finally {
      saving = false;
      if (current()) {
        controls.forEach(el => { el.disabled = !session; });
        cancel.disabled = false;
      }
    }
  };
}
