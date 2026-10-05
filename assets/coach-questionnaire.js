/* Questionnaire presentation. Premium is instantiated only by the offline test preview. */
const coachIntake=globalThis.SimpleCoachIntakeV5;
const coachBasicSteps=['experience','goal','days','weekdays','minutes','effort','excluded','activity'];
function coachQuestionTitle(key,premium=false){return ({experience:premium?'¿Cuánto tiempo llevas entrenando de forma constante y estructurada?':'¿Cuánto tiempo llevas entrenando de forma constante?',goal:premium?'¿Cuál es tu objetivo principal durante los próximos meses?':'¿Cuál es tu objetivo principal?',days:premium?'¿Cuántos días puedes entrenar consistentemente?':'¿Cuántos días puedes entrenar de forma realista cada semana?',weekdays:'¿Qué días tienes disponibles normalmente?',minutes:'¿Cuánto tiempo puedes dedicar aproximadamente a cada entrenamiento?',effort:premium?'Cuando terminas una serie exigente, ¿puedes estimar aproximadamente cuántas repeticiones más podrías haber realizado?':'Cuando haces una serie exigente, ¿qué experiencia tienes estimando cuántas repeticiones podrías haber hecho todavía?',excluded:'¿Hay ejercicios que no quieres que SIMPLE Coach utilice?',activity:premium?'¿Realizas alguna actividad que pueda afectar a tu recuperación?':'¿Realizas regularmente otro deporte o actividad física exigente?',inventory:'¿Qué equipamiento tienes disponible?',pause:'¿Has tenido alguna pausa superior a 2 meses durante el último año?',weak_points:'¿Qué grupos musculares consideras más rezagados respecto al resto de tu físico?',minutes_by_day:'¿Cuánto tiempo tienes en cada uno de estos días?',confidence:'¿Qué confianza tienes estimando un RIR 1–2?',recovery:'Cuando vuelves a entrenar un mismo grupo muscular, normalmente llegas…',sleep:'¿Cuánto duermes habitualmente?',stress:'¿Cómo describirías tu nivel habitual de estrés?',distribution:'Si ambas opciones fueran igual de efectivas para ti, ¿qué preferirías?'}[key]);}
function coachStartQuestionnaire(training=null,premium=false){
 const isNew=training?.schema_version==='basic-intake-v2';
 if(training&&!isNew&&!premium){
  coachShell('<h3>Tu cuestionario anterior</h3>'+coachTrainingMarkup(training)+'<p>Se conserva con su versión original. No cambia tu rutina ni se convierte al nuevo cuestionario.</p><div class="buttons"><button class="btn" id="coachPermissions" data-keep-enabled="true">Ver o retirar permiso</button>'+(simpleCoach.accepted?'':'<button class="btn primary" id="coachNewQuestionnaire" data-keep-enabled="true">Completar el nuevo cuestionario</button>')+'</div>');
  $('coachPermissions').onclick=coachShowConsent;if($('coachNewQuestionnaire'))$('coachNewQuestionnaire').onclick=()=>coachStartQuestionnaire();return;
 }
 simpleCoach.wizard={owner:user.id,premium,step:0,data:training?structuredClone(training):(premium?coachIntake.emptyPremium():coachIntake.emptyBasic())};
 if(isNew&&coachIntake.basicErrors(training,false).length){coachShell('<p>No se pudo interpretar este borrador. No se ha sobrescrito. Vuelve a abrir SIMPLE Coach para reintentar.</p>');return;}
 coachRenderQuestionnaire();
}
function coachWizardSteps(){const w=simpleCoach.wizard;return [...(w.premium?coachIntake.premiumSteps(w.data):coachBasicSteps),'inventory'];}
function coachOptionList(key,options,value,multi=false){return '<fieldset class="coach-answer-list" data-field="'+key+'"><legend class="sr-only">'+esc(coachQuestionTitle(key,simpleCoach.wizard.premium)||key)+'</legend>'+options.map(o=>'<label class="coach-answer"><input type="'+(multi?'checkbox':'radio')+'" name="'+key+'" value="'+esc(String(o.id))+'" '+((multi?value.includes(o.id):value===o.id)?'checked':'')+'><span>'+esc(o.label)+'</span></label>').join('')+'</fieldset>';}
function coachEquipmentCatalogue(){return simpleCoach.wizard.premium?globalThis.SimpleCoachIntake.equipment:coachIntake.equipment;}
function coachSyncAllEquipment(){
 const all=$('coachAllEquipment');if(!all)return;
 const selected=simpleCoach.wizard.data.inventory.equipment;
 const equipment=coachEquipmentCatalogue(),count=equipment.filter(e=>selected.includes(e.id)).length;
 all.checked=count===equipment.length;all.indeterminate=count>0&&!all.checked;
}
function coachQuestionBody(key){
 const w=simpleCoach.wizard,t=w.data,I=w.premium?globalThis.SimpleCoachIntake:coachIntake,p=w.premium,num=values=>values.map(id=>({id,label:id===90?'90 minutos o más':String(id)+(key==='days'?' días':' minutos')}));
 if(key==='experience')return coachOptionList(key,I.experience,t.experience);
 if(key==='goal')return coachOptionList(key,p?I.premiumGoals:I.goals,t.goal);
 if(key==='days')return '<p class="muted">Elige una frecuencia que puedas mantener habitualmente.</p>'+coachOptionList(key,num([2,3,4,5,6]),t.days);
 if(key==='weekdays')return '<p class="muted">Selecciona '+t.days+' días. Puedes volver atrás para cambiar la frecuencia.</p>'+coachOptionList(key,I.weekdays,t.weekdays,true);
 if(key==='minutes')return coachOptionList(key,num(I.minutes),t.minutes);
 if(key==='effort')return coachOptionList(key,p?I.effort.map((o,i)=>({...o,label:['No','Más o menos','Bastante bien','Utilizo RIR/RPE habitualmente'][i]})):I.effort,t.effort);
 if(key==='excluded')return '<p class="muted">Solo indica los que quieres excluir. SIMPLE Coach seleccionará los ejercicios de tu rutina. Excluir este ejercicio no excluye automáticamente otras variantes.</p><label for="coachSearch">Buscar ejercicio</label><input type="search" id="coachSearch" autocomplete="off" placeholder="Nombre del ejercicio"><p class="muted" id="coachSelectedCount">'+t.excluded.length+' excluidos · máximo 20</p><div id="coachSearchResults">'+coachOptionList(key,I.exercises.map(e=>({id:e.id,label:e.name})),t.excluded,true)+'</div><p id="coachNoResults" role="status" hidden>No hay coincidencias.</p>';
 if(key==='inventory')return '<p class="muted">Indica lo que existe. No es una selección de ejercicios obligatorios. El trabajo con peso corporal está disponible sin equipo.</p><label for="coachSearch">Buscar equipamiento</label><input type="search" id="coachSearch" autocomplete="off" placeholder="Máquina o material"><p id="coachSelectedCount" class="muted">'+t.inventory.equipment.length+' equipos del catálogo disponibles</p><div id="coachSearchResults">'+I.categories.map(c=>'<details class="coach-equipment-category" open><summary>'+esc(c.label)+'</summary>'+coachOptionList('equipment',I.equipment.filter(e=>e.category===c.id),t.inventory.equipment,true)+'</details>').join('')+'</div><p id="coachNoResults" role="status" hidden>No hay coincidencias.</p><details id="coachCustom"><summary>+ Añadir máquina/equipamiento</summary><label for="coachCustomName">Nombre corto</label><input id="coachCustomName" maxlength="40" autocomplete="off" aria-describedby="coachCustomHint"><p class="muted" id="coachCustomHint">Sin información personal ni médica. Se guarda como disponibilidad; no se enviará a OpenAI ni se usará sin una correspondencia con el catálogo.</p><button class="btn" id="coachAddEquipment" type="button" data-keep-enabled="true">Añadir equipo</button><p id="coachCustomError" role="alert"></p></details><ul class="coach-custom-list">'+t.inventory.custom.map((s,i)=>'<li>'+esc(s)+' <button type="button" class="btn" data-remove-equipment="'+i+'" aria-label="Quitar '+esc(s)+'" data-keep-enabled="true">Quitar</button></li>').join('')+'</ul>';
 if(key==='activity')return coachOptionList('activity',I.activities,t.activity.type)+'<div id="coachActivityDetails" '+(!t.activity.type||t.activity.type==='none'?'hidden':'')+'><h4>Días habituales</h4>'+coachOptionList('activity_weekdays',I.weekdays,t.activity.weekdays,true)+(p?'<label for="coachActivityMinutes">Duración aproximada</label><select id="coachActivityMinutes"><option value="">Elige la duración</option>'+num(I.minutes).map(o=>'<option value="'+o.id+'" '+(t.activity.minutes===o.id?'selected':'')+'>'+o.label+'</option>').join('')+'</select><h4>Exigencia</h4>'+coachOptionList('activity_intensity',I.levels,t.activity.intensity):'')+'</div>';
 if(key==='pause')return coachOptionList(key,[{id:'yes',label:'Sí'},{id:'no',label:'No'}],t.pause===null?null:t.pause?'yes':'no');
 if(key==='weak_points')return '<p class="muted">'+(t.experience==='y1_2'?'Opcional. ':'')+'Máximo 2. Es información inicial, no una orden permanente de especialización.</p>'+coachOptionList(key,I.weakPoints,t.weak_points,true);
 if(key==='minutes_by_day')return I.weekdays.filter(d=>t.weekdays.includes(d.id)).map(d=>'<label>'+d.label+'<select data-day-minutes="'+d.id+'"><option value="">Elige la duración</option>'+num(I.minutes).map(o=>'<option value="'+o.id+'" '+(t.minutes_by_day[d.id]===o.id?'selected':'')+'>'+o.label+'</option>').join('')+'</select></label>').join('');
 if(key==='sleep')return coachOptionList(key,I.sleep,t.sleep)+'<h4>¿Tu horario de sueño suele ser estable? (opcional)</h4>'+coachOptionList('sleep_stability',I.stability,t.sleep_stability);
 return coachOptionList(key,{confidence:I.levels,recovery:I.recovery,stress:I.levels.map(o=>({...o,label:{low:'Bajo',medium:'Medio',high:'Alto'}[o.id]})),distribution:I.distribution}[key],t[key]);
}
function coachRenderQuestionnaire(){
 const w=simpleCoach.wizard;if(!w||w.owner!==user?.id)return;
 const steps=coachWizardSteps();w.step=Math.min(w.step,steps.length-1);const key=steps[w.step],count=steps.length-1;
 coachShell('<section class="coach-questionnaire"><p class="coach-step" id="coachStep">'+(key==='inventory'?'Tu equipamiento':(w.step+1)+' de '+count)+'</p><h3 id="coachQuestion" tabindex="-1">'+esc(coachQuestionTitle(key,w.premium))+'</h3><form id="coachForm" novalidate>'+coachQuestionBody(key)+'<div class="coach-step-actions"><button class="btn" type="button" id="coachBack" data-keep-enabled="true">Atrás</button><button class="btn primary" type="submit" id="coachNext" data-keep-enabled="true">'+(key==='inventory'?'Revisar respuestas':'Continuar')+'</button></div><button class="coach-draft-link" type="button" id="coachDraft" data-keep-enabled="true">Guardar borrador</button></form><div id="coachProposal"></div><div class="buttons"><button class="coach-draft-link" type="button" id="coachPermissions" data-keep-enabled="true">Ver o retirar permiso</button>'+(simpleCoach.intake?.state==='draft'&&!w.premium?'<button class="coach-draft-link" id="coachDeleteDraft" data-keep-enabled="true">Borrar borrador</button>':'')+'</div><div id="coachDeleteConfirm"></div></section>');
 if(w.premium){$('coachDialog').querySelector('.coach-heading + p').textContent='Premium · preview sintética. No se guarda en Supabase ni se envía a OpenAI.';$('coachPermissions').hidden=true;}
 if(w.premium){
  $('coachDialog').querySelector('.coach-questionnaire').classList.add('coach-premium-questionnaire');
  if(key==='inventory'){
   $('coachSearch').previousElementSibling.insertAdjacentHTML('beforebegin','<label class="coach-answer coach-all-equipment"><input type="checkbox" id="coachAllEquipment" aria-describedby="coachAllEquipmentHint"><span>Tengo todo el equipamiento</span></label><p class="muted" id="coachAllEquipmentHint">Marca todo el catálogo de abajo. Si falta algún equipo, puedes desmarcarlo después. No modifica tus exclusiones.</p>');
   coachSyncAllEquipment();
  }
 }
 $('coachQuestion').focus();$('coachPermissions').onclick=coachShowConsent;
 $('coachBack').onclick=()=>{if(simpleCoach.busy)return;if(w.step){w.step--;coachRenderQuestionnaire();}else if(w.premium)coachDialog().close();else coachShowConsent();};
 $('coachForm').onchange=e=>coachQuestionChange(e);
 $('coachForm').onsubmit=e=>{e.preventDefault();if(simpleCoach.busy)return;const errors=coachQuestionErrors(key);if(errors){$('coachError').textContent=errors;$('coachError').setAttribute('tabindex','-1');$('coachError').focus();return;}if(key==='inventory')coachWizardReview();else{w.step++;coachRenderQuestionnaire();}};
 $('coachDraft').onclick=()=>{if(w.premium){sessionStorage.setItem('coach-premium-preview',JSON.stringify(w.data));$('coachStatus').textContent='Borrador de demostración guardado solo en esta pestaña.';}else coachSave(false);};
 if($('coachDeleteDraft'))$('coachDeleteDraft').onclick=coachDeleteDraft;
 if($('coachSearch'))$('coachSearch').oninput=()=>{const q=$('coachSearch').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();let shown=0;$('coachSearchResults').querySelectorAll('.coach-answer').forEach(l=>{l.hidden=!l.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q);if(!l.hidden)shown++;});$('coachSearchResults').querySelectorAll('details').forEach(d=>{d.hidden=![...d.querySelectorAll('.coach-answer')].some(l=>!l.hidden);if(q)d.open=true;});$('coachNoResults').hidden=!!shown;};
 if($('coachAddEquipment'))$('coachAddEquipment').onclick=()=>{const s=$('coachCustomName').value.trim();if(!coachIntake.customName(s)||w.data.inventory.custom.length>=10||w.data.inventory.custom.some(x=>x.toLowerCase()===s.toLowerCase())||coachIntake.equipment.some(x=>x.label.toLowerCase()===s.toLowerCase())){$('coachCustomError').textContent='Usa un nombre de 2–40 caracteres, sin datos personales ni médicos, y comprueba que no exista ya. Máximo 10 equipos adicionales.';return;}w.data.inventory.custom.push(s);coachRenderQuestionnaire();$('coachCustom').open=true;};
 $('coachForm').querySelectorAll('[data-remove-equipment]').forEach(b=>b.onclick=()=>{w.data.inventory.custom.splice(Number(b.dataset.removeEquipment),1);coachRenderQuestionnaire();});
}
function coachQuestionChange(e){
 const w=simpleCoach.wizard,t=w.data,input=e.target,f=input.closest('[data-field]')?.dataset.field;
 simpleCoach.reviewed=false;$('coachError').textContent='';
 if(w.premium&&input.id==='coachAllEquipment'){
  t.inventory.equipment=input.checked?coachEquipmentCatalogue().map(e=>e.id):[];
  $('coachSearchResults').querySelectorAll('input[name="equipment"]').forEach(x=>x.checked=t.inventory.equipment.includes(x.value));
  $('coachSelectedCount').textContent=t.inventory.equipment.length+' equipos del catálogo disponibles';coachSyncAllEquipment();
 }
 else if(input.dataset.dayMinutes){if(input.value)t.minutes_by_day[input.dataset.dayMinutes]=Number(input.value);else delete t.minutes_by_day[input.dataset.dayMinutes];}
 else if(input.id==='coachActivityMinutes')t.activity.minutes=input.value?Number(input.value):null;
 else if(f){
  const selected=[...input.closest('[data-field]').querySelectorAll('input:checked')].map(x=>x.value);
  if(f==='weekdays'){if(selected.length>t.days){input.checked=false;$('coachError').textContent='Selecciona exactamente '+t.days+' días.';return;}t.weekdays=selected;}
  else if(f==='days'){t.days=Number(input.value);if(t.weekdays.length>t.days)t.weekdays=[];}
  else if(f==='minutes')t.minutes=Number(input.value);
  else if(f==='pause')t.pause=input.value==='yes';
  else if(f==='activity'){t.activity.type=input.value;if(input.value==='none'){t.activity.weekdays=[];$('coachActivityDetails').querySelectorAll('input').forEach(x=>x.checked=false);if($('coachActivityMinutes'))$('coachActivityMinutes').value='';}$('coachActivityDetails').hidden=input.value==='none';}
  else if(f==='activity_weekdays')t.activity.weekdays=selected;
  else if(f==='activity_intensity')t.activity.intensity=input.value;
  else if(f==='equipment'){t.inventory.equipment=coachIntake.equipment.filter(x=>selected.includes(x.id)||t.inventory.equipment.includes(x.id)&&!input.closest('[data-field]').querySelector('[value="'+x.id+'"]')).map(x=>x.id);$('coachSelectedCount').textContent=t.inventory.equipment.length+' equipos del catálogo disponibles';}
  else if(f==='excluded'){if(selected.length>20){input.checked=false;$('coachError').textContent='Puedes excluir hasta 20 ejercicios.';return;}t.excluded=selected;$('coachSelectedCount').textContent=selected.length+' excluidos · máximo 20';}
  else if(f==='weak_points'){let value=selected;if(input.checked&&input.value==='unsure')value=['unsure'];else if(input.checked)value=selected.filter(x=>x!=='unsure');if(value.length>2){input.checked=false;$('coachError').textContent='Selecciona como máximo 2 grupos.';return;}t.weak_points=value;input.closest('fieldset').querySelectorAll('input').forEach(x=>x.checked=value.includes(x.value));}
  else t[f]=input.value;
 }
 if(w.premium)coachIntake.normalizePremium(t);
 if(f==='equipment')coachSyncAllEquipment();
}
function coachQuestionErrors(key){
 const w=simpleCoach.wizard,t=w.data,errors=w.premium?coachIntake.premiumErrors(t):coachIntake.basicErrors(t);
 if(key==='inventory'&&errors.includes('inventory'))return 'Revisa el equipamiento indicado.';
 if(key==='inventory'&&!w.premium&&!errors.length){const groups=new Set(coachIntake.allowedExercises(t).map(e=>e.group));if(!['knee','hip','push','pull','core'].every(g=>groups.has(g)))return 'Con este material y estas exclusiones no podemos cubrir el entrenamiento. Revisa las exclusiones y el equipo; para los ejercicios de tracción hacen falta bandas, mancuernas u otro equipo del catálogo.';}
 if(errors.includes(key))return key==='weekdays'?'Selecciona exactamente '+t.days+' días.':key==='activity'?'Indica la actividad y completa sus días habituales.':'Completa esta respuesta para continuar.';
 return '';
}
function coachWizardTraining(complete=true){const w=simpleCoach.wizard;if(!w||w.owner!==user?.id||w.premium)throw Error('coach_invalid_training');return coachIntake.assertBasic(w.data,complete);}
function coachWizardMarkup(t){
 const I=coachIntake,label=(list,id)=>list.find(x=>x.id===id)?.label||'Sin responder',p=t.schema_version==='premium-intake-v1';
 const fields=[['Experiencia',label(I.experience,t.experience)],['Objetivo',label(p?I.premiumGoals:I.goals,t.goal)],['Días',t.days],['Disponibilidad',t.weekdays.map(d=>label(I.weekdays,d)).join(', ')],['Duración',p?t.weekdays.map(d=>label(I.weekdays,d)+': '+t.minutes_by_day[d]+' min').join(', '):t.minutes+' min'],['Estimación del esfuerzo',label(I.effort,t.effort)],['Ejercicios excluidos',t.excluded.map(id=>I.exercises.find(e=>e.id===id)?.name).join(', ')||'Ninguno'],['Otra actividad',label(I.activities,t.activity.type)+(t.activity.weekdays.length?' · '+t.activity.weekdays.map(d=>label(I.weekdays,d)).join(', '):'')],['Equipo disponible',t.inventory.equipment.map(id=>label(I.equipment,id)).join(', ')||'Peso corporal'],['Equipo adicional (no se envía a OpenAI)',t.inventory.custom.join(', ')||'Ninguno']];
 if(p){fields.push(['Pausa superior a 2 meses',t.pause?'Sí':'No'],['Puntos débiles',t.weak_points.map(id=>label(I.weakPoints,id)).join(', ')||'Sin especialización declarada'],['Confianza RIR',t.confidence?label(I.levels,t.confidence):'No procede'],['Recuperación',label(I.recovery,t.recovery)],['Sueño',label(I.sleep,t.sleep)],['Horario de sueño',t.sleep_stability?label(I.stability,t.sleep_stability):'No indicado'],['Estrés',label(I.levels,t.stress)],['Distribución',label(I.distribution,t.distribution)]);if(t.activity.type!=='none')fields.push(['Actividad: duración / exigencia',t.activity.minutes+' min · '+label(I.levels,t.activity.intensity)]);}
 return '<dl class="coach-context">'+fields.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(String(v))+'</dd>').join('')+'</dl>';
}
function coachWizardReview(){
 const w=simpleCoach.wizard,errors=w.premium?coachIntake.premiumErrors(w.data):coachIntake.basicErrors(w.data);if(errors.length){$('coachError').textContent='Revisa las respuestas pendientes antes de continuar.';return;}
 simpleCoach.reviewed=true;$('coachForm').hidden=true;
 $('coachProposal').innerHTML='<h3 id="coachReviewHeading" tabindex="-1">Revisa tus respuestas</h3>'+coachWizardMarkup(w.data)+(w.premium?'<p>Preview terminada. Premium permanece desactivado: estas respuestas no se guardan en Supabase ni se envían a OpenAI.</p>':'<p>Solo se enviará el contexto Basic de entrenamiento. El equipo adicional queda fuera del envío. La propuesta tendrá revisión humana.</p>')+'<div class="buttons"><button class="btn" data-coach-action data-keep-enabled="true" id="coachReviewBack">Volver y editar</button>'+(!w.premium&&!simpleCoach.accepted?'<button class="btn primary" data-coach-action data-keep-enabled="true" id="coachConfirmSend">Enviar y generar propuesta</button>':'')+'</div>';
 $('coachReviewBack').onclick=()=>{simpleCoach.reviewed=false;coachRenderQuestionnaire();};if($('coachConfirmSend'))$('coachConfirmSend').onclick=()=>coachSave(true);$('coachReviewHeading').focus();
}
