require('../../assets/coach-intake.js');require('../../assets/coach-programming-v4.js');require('../../assets/coach-programming-v5.js');const I=globalThis.SimpleCoachIntakeV5;
const base={...I.emptyBasic(),experience:'lt6',goal:'balanced_mass',days:3,weekdays:['mon','wed','fri'],minutes:60,effort:'unknown',activity:{type:'none',weekdays:[]},inventory:{equipment:I.equipment.map(e=>e.id),custom:[]}};
const four={days:4,weekdays:['mon','tue','thu','sat']},five={days:5,weekdays:['mon','tue','wed','fri','sat']};
module.exports={
 A:{label:'<6 meses · 3 días · 60 min · gimnasio completo',training:structuredClone(base)},
 B:{label:'<6 meses · 4 días · 30 min · mancuernas/bandas',training:{...structuredClone(base),...four,minutes:30,effort:'learning',inventory:{equipment:['dumbbells','bands'],custom:[]}}},
 C:{label:'1–2 años · 4 días · 60 min · estima RIR · vuelta estructurada',training:{...structuredClone(base),...four,experience:'y1_2',effort:'confident',goal:'structured_return'}},
 D:{label:'1–2 años · 4 días · 60 min · masa muscular · gimnasio completo',training:{...structuredClone(base),...four,experience:'y1_2',effort:'confident'}},
 E:{label:'>4 años · 4 días · 60 min · gimnasio completo',training:{...structuredClone(base),...four,experience:'gt4',effort:'habitual'}},
 F:{label:'>4 años · 5 días · 60 min · gimnasio completo',training:{...structuredClone(base),...five,experience:'gt4',effort:'habitual'}},
 G:{label:'>4 años · 5 días · 75 min · gimnasio completo',training:{...structuredClone(base),...five,experience:'gt4',minutes:75,effort:'habitual'}},
 H:{label:'>4 años · 6 días · 45 min · recuperar masa',training:{...structuredClone(base),days:6,weekdays:['mon','tue','wed','thu','fri','sat'],experience:'gt4',minutes:45,effort:'habitual',goal:'regain_mass'}}
};
