// Sanitized synthetic report; never copies users, tokens, operation IDs or provider credentials.
const fs=require('fs'),path=require('path'),I=require('../../assets/coach-intake.js'),Q=require('../../assets/coach-programming-v4.js');
const dir=path.join(__dirname,'results'),read=n=>JSON.parse(fs.readFileSync(path.join(dir,n))),hist={A:2,B:3,E:4,G:5};
const table=(head,rows)=>'| '+head.join(' | ')+' |\n| '+head.map(()=> '---').join(' | ')+' |\n'+rows.map(r=>'| '+r.join(' | ')+' |').join('\n')+'\n';
const pct=v=>(v*100).toFixed(1)+' %',span=a=>Math.min(...a)+'–'+Math.max(...a),label=(arr,id)=>arr.find(x=>x.id===id)?.label||id;
const all='ABCDEFGH'.split('').map(k=>read('real-quality-'+k+'.json'));
let doc='# Ocho generaciones reales sintéticas · basic-initial-v4\n\nSin aprobación ni aceptación. No hay datos de participantes reales. Los nombres de ejercicio se obtienen del ID de catálogo devuelto por OpenAI; no se sustituyen para mejorar el resultado. Descripción y «por lado» son derivados deterministas de la aplicación.\n\n';
let comparison='# Comparación histórica v3 / v4\n\nUna salida por perfil y versión, sin nuevas llamadas v3. No es un ensayo de eficacia ni una estimación de variabilidad del modelo. Ambas versiones se recuentan con la misma metadata muscular y fórmula temporal v4 para comparar. No se modifica ni invalida retrospectivamente v3.\n\n';
const summary=[];
for(const r of all){
 const p=r.proposal||r.diagnostic?.proposal,t=r.training,q=p?Q.evaluate(p,t):null;
 summary.push({case:r.case,passed:r.passed,state:r.state,cost:r.estimated_cost_usd,unique:q?.unique,sets:q?.totalSets,minutes:q?.days.map(d=>d.minutes),warnings:q?.warnings,failures:q?.failures,muscles:q?.muscles});
 doc+='## '+r.case+' · '+r.label+'\n\n';
 doc+='Estado real: '+r.state+'. Modelo: '+r.model+'. Coste USD: '+r.estimated_cost_usd+'.\n\n';
 doc+='### Entrada exacta enviada (sin identidad ni salud)\n\n```json\n'+JSON.stringify(t,null,2)+'\n```\n\n';
 if(!p){doc+='No hubo propuesta interpretable. Error: '+r.error_code+'\n\n';continue;}
 doc+='### Propuesta completa\n\n'+p.name+'\n\n'+p.description+'\n\n';
 for(const [i,d] of p.days.entries())doc+='**'+d.name+'** — '+q.days[i].sets+' series, '+q.days[i].minutes+' min estimados ('+pct(q.days[i].ratio)+').\n\n'+table(['Ejercicio','Series','Reps','RIR','Descanso'],d.exercises.map(e=>[e.name,e.sets,e.reps_min+'–'+e.reps_max+(Q.byName.get(e.name)?.unilateral?' por lado':''),e.rir,e.rest_seconds+' s']))+'\n';
 doc+='### Evaluación reproducible\n\n'+q.unique+' ejercicios distintos; '+q.totalSets+' series.\n\n'+table(['Grupo','Series principales','Días principales','Participación secundaria (series)','Días secundarios'],Object.entries(q.muscles).map(([g,v])=>[Q.labels[g],v.direct,v.frequency,v.secondary,v.secondary_frequency]))+'\n';
 doc+='Patrones (series): '+Object.entries(q.patterns).map(([g,n])=>g+': '+n).join('; ')+'.\n\n';
 doc+='Avisos: '+(q.warnings.map(w=>w.code+': '+w.message+(w.muscle?' ['+Q.labels[w.muscle]+']':'')+(w.day?' ['+w.day+']':'')).join(' / ')||'ninguno de las heurísticas')+'.\n\n';
 doc+='Fallos deterministas: '+(q.failures.join(', ')||'ninguno')+'.\n\n';
 doc+=Object.entries(q.smallMuscles).map(([g,v])=>'- '+Q.labels[g]+': '+v.note).join('\n')+'\n\n';
 if(hist[r.case]){
  const old=read('historical-'+hist[r.case]+'.json'),o=Q.evaluate(old.proposal,old.training);
  const same=require('util').isDeepStrictEqual(t,old.training);
  comparison+='## '+r.case+'\n\nEntrada exactamente igual: '+same+'.\n\n';
  const flat=x=>x.days.flatMap(d=>d.exercises);
  comparison+=table(['Métrica','v3 archivada','v4 real'],[['Ejercicios distintos',o.unique,q.unique],['Series totales',o.totalSets,q.totalSets],['Minutos por sesión (misma fórmula)',o.days.map(d=>d.minutes).join('/'),q.days.map(d=>d.minutes).join('/')],['RIR',span(flat(old.proposal).map(e=>e.rir)),span(flat(p).map(e=>e.rir))],['Descanso s',span(flat(old.proposal).map(e=>e.rest_seconds)),span(flat(p).map(e=>e.rest_seconds))],...Object.keys(q.muscles).map(g=>[Q.labels[g]+' (directas / frecuencia / secundarias)',o.muscles[g].direct+' / '+o.muscles[g].frequency+' / '+o.muscles[g].secondary,q.muscles[g].direct+' / '+q.muscles[g].frequency+' / '+q.muscles[g].secondary])])+'\n';
  const names=x=>[...new Set(flat(x).map(e=>e.name))];comparison+='Ejercicios v3: '+names(old.proposal).join('; ')+'.\n\nEjercicios v4: '+names(p).join('; ')+'.\n\n';
  comparison+='Avisos de actividad v3: '+(o.warnings.filter(w=>w.code.startsWith('sport')).map(w=>w.code+' '+w.day).join('; ')||'ninguno')+'.\n\nAvisos de actividad v4: '+(q.warnings.filter(w=>w.code.startsWith('sport')).map(w=>w.code+' '+w.day).join('; ')||'ninguno')+'.\n\n';
 }
}
fs.writeFileSync(path.join(__dirname,'GENERACIONES.md'),doc.trimEnd()+'\n');fs.writeFileSync(path.join(__dirname,'COMPARATIVA.md'),comparison.trimEnd()+'\n');
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary.map(({muscles,warnings,...x})=>({...x,warnings:warnings?.map(w=>w.code)})),null,2));
