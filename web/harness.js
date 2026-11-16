import {compare,validateConfig,verifyResult} from './core.js';
const el=id=>document.getElementById(id);
let results={};
function status(message,error=false){el('status').textContent=message;el('status').classList.toggle('error',error);}
function safely(action){return async()=>{try{await action();}catch(e){status(e.message,true);}};}
function config(){return validateConfig(JSON.parse(el('config').value));}
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function render(){
  el('iae').replaceChildren();
  for(const [strategy,r] of Object.entries(results)){
    const row=document.createElement('tr');
    for(const value of [strategy==='feedback'?'Feedback':'Feedback + feedforward',...r.iae_cm_s.map(v=>v.toFixed(3))]){const td=document.createElement('td');td.textContent=value;row.append(td);}
    el('iae').append(row);
  }
  const r=results[el('strategy').value];
  if(!r){el('bank').replaceChildren();el('modelInfo').textContent='Importa o ejecuta esta estrategia para inspeccionar su serie.';el('balance').textContent='';return;}
  el('time').max=r.series.length-1;
  const index=Math.min(Number(el('time').value),r.series.length-1),row=r.series[index];
  el('instant').textContent=`${row.time_s} s (estado al inicio del intervalo)`;
  el('modelInfo').textContent=`Modelo: ${r.config.model} · Sintonía: ${r.config.tuning} · FF: ${r.config.feedforward_mode} · Horizonte: ${r.config.duration_s} s · Datos simulados`;
  el('bank').replaceChildren();
  for(let i=0;i<3;i++){
    const card=document.createElement('article');card.className='cell';
    const heading=document.createElement('strong');heading.textContent=`Celda ${i+1} → P-${i+1}`;
    const tank=document.createElement('div');tank.className='tank';tank.setAttribute('aria-label',`Nivel ${row.level_cm[i].toFixed(3)} cm, consigna ${row.setpoint_cm[i]} cm`);
    const liquid=document.createElement('div');liquid.className='liquid';liquid.style.height=`${100*row.level_cm[i]/r.config.cells[i].height_cm}%`;
    const target=document.createElement('div');target.className='target';target.style.bottom=`${100*row.setpoint_cm[i]/r.config.cells[i].height_cm}%`;tank.append(liquid,target);
    const readings=document.createElement('div');readings.className='readings';
    for(const [label,value,unit] of [['Nivel',row.level_cm[i],'cm'],['Consigna',row.setpoint_cm[i],'cm'],['Entrada',row.qin_lpm[i],'L/min'],['Orden',row.command_lpm[i],'L/min'],['Descarga real',row.qout_lpm[i],'L/min'],['Rebose',row.spill_lpm[i],'L/min']]){const p=document.createElement('p');p.textContent=`${label}: ${value.toFixed(3)} ${unit}`;readings.append(p);}
    card.append(heading,tank,readings);el('bank').append(card);
  }
  el('balance').textContent=`Residual acumulado de volumen: ${row.balance_residual_l.toExponential(3)} L ${r.config.model==='identified'?'equivalentes':''}. Línea naranja: consigna.`;
}
async function load(){const response=await fetch(`configs/${el('preset').value}.json`);if(!response.ok)throw Error('No se pudo cargar el ejemplo.');const c=await response.json();validateConfig(c);el('config').value=JSON.stringify(c,null,2);results=compare(c);render();status('Ejemplo ejecutado en JavaScript. Puedes importar un resultado Python para verificarlo.');}
el('load').onclick=safely(load);
el('run').onclick=safely(()=>{results=compare(config());render();status('Comparación completada. Mismo escenario externo y horizonte para ambas estrategias.');});
el('exportConfig').onclick=safely(()=>download(config(),'escenario.json'));
el('exportResult').onclick=safely(()=>{const r=results[el('strategy').value];if(!r)throw Error('Ejecuta o importa primero la estrategia seleccionada.');download(r,`resultado_${r.strategy}.json`);});
el('import').onchange=safely(async()=>{
  const file=el('import').files[0];if(!file)return;
  const data=JSON.parse((await file.text()).replace(/^\uFEFF/,''));
  if(data.kind==='result'){
    verifyResult(data);el('config').value=JSON.stringify(data.config,null,2);results={[data.strategy]:data};el('strategy').value=data.strategy;render();status('Resultado importado y verificado: todas las series coinciden con la repetición en JavaScript.');
  }else{validateConfig(data);el('config').value=JSON.stringify(data,null,2);results=compare(data);render();status('Escenario importado y ejecutado con ambas estrategias.');}
});
el('strategy').onchange=render;el('time').oninput=render;
safely(load)();
