const I=require('../../assets/coach-intake.js');
const base={...I.emptyBasic(),experience:'lt6',goal:'balanced_mass',days:3,weekdays:['mon','wed','fri'],minutes:60,effort:'unknown',activity:{type:'none',weekdays:[]},inventory:{equipment:I.equipment.map(e=>e.id),custom:[]}};
const four={days:4,weekdays:['mon','tue','thu','sat']};
module.exports={
 A:{label:'Principiante <6 meses, 3 días, 60 min, gimnasio',training:structuredClone(base)},
 B:{label:'Principiante <6 meses, 4 días, 30 min, mancuernas/bandas',training:{...structuredClone(base),...four,minutes:30,effort:'learning',inventory:{equipment:['dumbbells','bands'],custom:[]}}},
 C:{label:'Principiante, 2 días, 60 min, vuelta estructurada',training:{...structuredClone(base),days:2,weekdays:['tue','fri'],goal:'structured_return'}},
 D:{label:'6–12 meses, 3 días, 45 min, recuperar masa',training:{...structuredClone(base),experience:'m6_12',minutes:45,effort:'learning',goal:'regain_mass'}},
 E:{label:'1–2 años, 4 días, fútbol martes/viernes, exclusiones históricas',training:{...structuredClone(base),...four,experience:'y1_2',minutes:90,effort:'confident',excluded:['bar_squat','db_rdl','leg_press','pulldown'],activity:{type:'football',weekdays:['tue','fri']}}},
 F:{label:'1–2 años, 4 días, 60 min, exclusiones, vuelta estructurada',training:{...structuredClone(base),...four,experience:'y1_2',effort:'confident',goal:'structured_return',excluded:['bar_squat','db_rdl','leg_press','pulldown','chest_press','reverse_lunge']}},
 G:{label:'Más de 4 años, 5 días, 60 min',training:{...structuredClone(base),experience:'gt4',days:5,weekdays:['mon','tue','wed','fri','sat'],effort:'habitual'}},
 H:{label:'Más de 4 años, 6 días, 45 min, recuperar masa',training:{...structuredClone(base),experience:'gt4',days:6,weekdays:['mon','tue','wed','thu','fri','sat'],minutes:45,effort:'habitual',goal:'regain_mass'}}
};
