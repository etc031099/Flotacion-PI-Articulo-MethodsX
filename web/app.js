import {validateConfig,verifyResult} from './core.js';
import {SimulationSession,STRATEGIES,CELL_COLORS,cellSnapshot,sampleAt,iaeComparison} from './session.js';
import {createPreset,controllerFor,applyParameters,addPerturbation} from './scenarios.js';
import {validateDocument,validateExchange,makeExchange,sameDocument} from './validation.js';
import {BrowserEngine} from './browser-engine.js';
import {PythonClient} from './python-client.js';
import {SignalChart,chartSpecifications} from './charts.js';
import {renderEquations,renderSIMC} from './education.js';

const fixed=(n,d=2)=>Number(n).toFixed(d);
function downloadFile(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export async function bootApp({fetcher=globalThis.fetch,browserEngine=new BrowserEngine(),pythonClient=new PythonClient(),chartFactory=container=>new SignalChart(container),raf=callback=>requestAnimationFrame(callback),now=()=>performance.now(),download=downloadFile}={}){
  const el=id=>document.getElementById(id),session=new SimulationSession();
  let reference,schema,base,dirty=false,busy=false,generation=0,selectedCell=0,activeStrategy='feedback',heartbeat=null;
  const charts=Array.from({length:6},()=>chartFactory(el('chartGrid')));
  const text=(id,value)=>{el(id).textContent=value;};
  const message=(value,type='')=>{text('status',value);el('status').className='status-bar '+type;};
  const active=()=>session.results[activeStrategy]??Object.values(session.results)[0];
  const safe=action=>async event=>{try{await action(event);}catch(e){message(e.message,'error');connection();controls();}};
  function connection(){
    const node=el('connectionState');node.replaceChildren();const dot=document.createElement('span');dot.className='dot'+(pythonClient.connected?'':' offline');node.append(dot,document.createTextNode(pythonClient.connected?'Python confirmó /health':'Sin conexión Python'));
    text('connectionMessage',pythonClient.message+(pythonClient.connected?' · El siguiente cálculo puede usar /simulate.':' · Puedes elegir Navegador o intercambiar archivos.'));
    el('disconnect').disabled=!pythonClient.connected;
    if(!pythonClient.connected&&heartbeat!==null){clearInterval(heartbeat);heartbeat=null;}
    const access=pythonClient.accessInfo;
    const note=el('networkAccess');if(note)note.textContent=access?`Acceso local: ${access.localPage?'página loopback; CORS entre puertos':access.permissionName?`${access.permissionName}: ${access.permission}`:'el navegador no informa este permiso; se usa la respuesta real del servicio'}.`:'La conexión se inicia sólo al pulsar Conectar Python. El navegador puede pedir permiso de acceso local.';
  }
  function startHeartbeat(){
    if(heartbeat!==null)clearInterval(heartbeat);
    heartbeat=setInterval(async()=>{if(!pythonClient.connected){connection();return;}try{await pythonClient.ping();}catch(e){session.pause();connection();controls();message(`Se perdió la conexión Python: ${e.message}. Los resultados guardados conservan su origen; selecciona Navegador para nuevos cálculos.`,'error');}},10000);
  }
  function controls(){
    const has=Boolean(active());
    for(const id of ['play','pause','reset','step','time','goEnd'])el(id).disabled=!has||busy;
    el('play').disabled=!has||busy||dirty||session.running;el('pause').disabled=!session.running;
    el('apply').disabled=busy;el('apply').textContent=busy?'Calculando…':'Aplicar y calcular';
    el('exportResult').disabled=!has||busy;el('exportConfig').disabled=!has||busy;
    el('play').textContent=session.elapsed===session.duration&&has?'↺ Reproducir de nuevo':session.elapsed>0?'▶ Continuar':'▶ Iniciar';
    text('playState',busy?'Calculando':dirty?'Cambios pendientes':session.running?'En reproducción':has?(session.elapsed===session.duration?'Finalizado':session.elapsed?'En pausa':'Listo'):'Sin resultados');
    text('bankTag',busy?'CALCULANDO':session.running?'EN REPRODUCCIÓN':'EN PAUSA');
    el('bank').dataset.playing=String(session.running&&!dirty);
  }
  function markDirty(){dirty=true;generation++;busy=false;session.pause();el('preset').value='custom';document.querySelector('.simulation-column').classList.add('is-dirty');text('dirtyLabel','Cambios pendientes. Aplica para calcular un nuevo experimento.');message('Parámetros editados. El banco conserva los resultados anteriores hasta pulsar Aplicar y calcular.','pending');controls();}
  function field(label,id,value,options=''){
    const node=document.createElement('label');node.textContent=label;
    const input=document.createElement('input');input.type='number';input.id=id;input.value=value;input.required=true;
    for(const [key,val] of Object.entries(options))input.setAttribute(key,val);node.append(input);return node;
  }
  function updateHints(){
    const physical=el('model').value==='physical';
    text('modelHint',physical?`Área geométrica: ${base.cells.map(x=>x.area_cm2).join(' / ')} cm². Revisa la sintonía de esta planta.`:'Almacenamiento equivalente. Los litros virtuales no representan geometría real.');
    text('ffHint',el('ffMode').value==='paper_increment'?'Ecs. (7)–(8): un escalón genera un pulso de una muestra.':'Variante experimental de implementación propia: acumula los incrementos de alimentación.');
    text('gainWarning',physical&&el('tuning').value==='paper_final'?'Atención: ganancias explícitas sobre planta física. No se transforman automáticamente; revisa su escala y estabilidad.':'El resultado mostrará las ganancias que realmente se aplicaron.');
    for(let i=0;i<3;i++)for(const prefix of ['kc','ti'])el(`${prefix}-${i}`).disabled=el('tuning').value==='simc';
  }
  function fillForm(config){
    base=structuredClone(config);
    for(const [id,value] of Object.entries({model:config.model,feed:config.feed_lpm,duration:config.duration_s,ffMode:config.feedforward_mode,tuning:config.tuning}))el(id).value=value;
    el('feed').min=config.pump_min_lpm;el('feed').max=config.pump_max_lpm;
    el('setpoints').replaceChildren();el('advancedCells').replaceChildren();
    config.cells.forEach((x,i)=>{
      const target=field(`C${i+1}`,`sp-${i}`,x.setpoint_cm,{min:0,max:x.height_cm,step:'any'});target.style.setProperty('--cell-color',CELL_COLORS[i]);el('setpoints').append(target);
      const section=document.createElement('div');section.className='advanced-cell';section.style.setProperty('--cell-color',CELL_COLORS[i]);const title=document.createElement('h3');title.textContent=`Celda C${i+1} · θ=${x.theta_s} s`;section.append(title);
      const grid=document.createElement('div');grid.className='form-grid';const gains=controllerFor(config,i);
      for(const item of [field('Kc · (L/min)/cm',`kc-${i}`,gains.kc,{max:-0.000001,min:-100000,step:'any'}),field('τi · s',`ti-${i}`,gains.ti_s,{min:.001,max:100000,step:'any'}),field('Kff · adimensional',`ff-${i}`,x.kff,{min:0,max:1,step:'any'}),field('Nivel inicial · cm',`h0-${i}`,x.initial_level_cm,{min:0,max:x.height_cm,step:'any'})])grid.append(item);
      section.append(grid);el('advancedCells').append(section);
    });renderEvents(config.events);updateHints();
  }
  function renderEvents(events){
    el('eventList').replaceChildren();text('eventCount',events.length);
    events.forEach((event,index)=>{
      const row=document.createElement('div');row.className='event-row';
      const header=document.createElement('header');const caption=document.createElement('span');caption.textContent=`Evento ${index+1}`;const remove=document.createElement('button');remove.type='button';remove.className='text-button';remove.textContent='×';remove.setAttribute('aria-label',`Eliminar evento ${index+1}`);remove.onclick=()=>{const events=readEvents();events.splice(index,1);renderEvents(events);markDirty();};header.append(caption,remove);
      const targetLabel=document.createElement('label');targetLabel.textContent='Señal';const select=document.createElement('select');select.dataset.field='target';
      for(const [value,label] of [['feed','Alimentación C1 (L/min)'],['sp-0','Consigna C1 (cm)'],['sp-1','Consigna C2 (cm)'],['sp-2','Consigna C3 (cm)']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}select.value=event.type==='feed'?'feed':`sp-${event.cell}`;targetLabel.append(select);
      const fields=document.createElement('div');fields.className='event-fields';const time=field('Instante · s',`event-time-${index}`,event.time_s,{min:0,step:1});time.querySelector('input').dataset.field='time';const value=field('Valor absoluto',`event-value-${index}`,event.value,{min:0,step:'any'});value.querySelector('input').dataset.field='value';fields.append(time,value);row.append(header,targetLabel,fields);el('eventList').append(row);
    });
  }
  function readEvents(){return Array.from(el('eventList').children).map(row=>{const target=row.querySelector('[data-field=target]').value,event={time_s:row.querySelector('[data-field=time]').valueAsNumber,type:target==='feed'?'feed':'setpoint',value:row.querySelector('[data-field=value]').valueAsNumber};if(target!=='feed')event.cell=Number(target.split('-')[1]);return event;});}
  function readConfig(){
    const invalid=Array.from(el('parameters').querySelectorAll('input,select')).find(input=>!input.checkValidity());
    if(invalid){const details=invalid.closest('details');if(details)details.open=true;invalid.reportValidity();throw Error('Revisa las entradas indicadas. Usa valores numéricos dentro de sus límites.');}
    const values={duration:el('duration').valueAsNumber,feed:el('feed').valueAsNumber,ffMode:el('ffMode').value,tuning:el('tuning').value,events:readEvents()};
    for(const [key,prefix] of Object.entries({setpoints:'sp',initials:'h0',kff:'ff',kc:'kc',ti:'ti'}))values[key]=[0,1,2].map(i=>el(`${prefix}-${i}`).valueAsNumber);
    const c=applyParameters({...base,model:el('model').value},values);validateDocument(c,schema);return c;
  }
  function buildBank(){
    el('bank').replaceChildren();
    for(let i=0;i<3;i++){
      const card=document.createElement('article');card.className='process-cell';card.style.setProperty('--cell-color',CELL_COLORS[i]);card.dataset.cell=i;
      card.innerHTML=`<div class="cell-head"><span class="cell-id">CELDA C${i+1}</span><span class="delay-label" data-read="delay"></span></div><div class="level-big"><span data-read="level">0.00</span><small>cm</small></div><div class="level-percent" data-read="percent"></div>
      <svg class="vessel" viewBox="0 0 210 190" role="img" aria-label="Nivel de pulpa calculado"><defs><linearGradient id="water-${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${CELL_COLORS[i]}" stop-opacity=".65"/><stop offset="1" stop-color="${CELL_COLORS[i]}" stop-opacity=".15"/></linearGradient><pattern id="foam-${i}" width="17" height="9" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r="3" fill="${CELL_COLORS[i]}" opacity=".6"/><circle cx="13" cy="3" r="3" fill="#d8edf0" opacity=".35"/></pattern><clipPath id="tank-clip-${i}"><rect x="44" y="12" width="119" height="153" rx="3"/></clipPath></defs>
      <path d="M15 165H190M36 174H173" stroke="#314659" fill="none"/><rect class="vessel-outline" x="42" y="10" width="123" height="157" rx="5" stroke="#5d7e93" stroke-width="2" fill="#0b1725"/><g clip-path="url(#tank-clip-${i})"><rect data-read="liquid" x="44" y="70" width="119" height="95" fill="url(#water-${i})"/><rect data-read="foam" x="44" y="65" width="119" height="9" fill="url(#foam-${i})"/><line class="sp-line" data-read="target" x1="44" x2="163" y1="70" y2="70"/></g>
      <path d="M36 14H41M36 64H41M36 114H41M36 165H41" stroke="#627b92"/><text x="12" y="18" data-read="maxheight">45</text><text x="12" y="69" data-read="tick2">30</text><text x="12" y="119" data-read="tick1">15</text><text x="18" y="168">0</text><text x="170" y="18">cm</text><path d="M44 170v10h119v-10" fill="none" stroke="#3a5168"/></svg>
      <dl class="cell-data"><div><dt>Consigna</dt><dd data-read="setpoint"></dd></div><div><dt>Error</dt><dd data-read="error" class="error-value"></dd></div><div><dt>Entrada</dt><dd data-read="qin"></dd></div><div><dt>Descarga real</dt><dd data-read="qout"></dd></div></dl>
      <div class="pump-row"><svg class="pump-icon" viewBox="0 0 40 40" aria-hidden="true"><path d="M1 20h5M34 20h5" stroke="currentColor" stroke-width="3"/><circle cx="20" cy="20" r="14" fill="#0c1725" stroke="currentColor" stroke-width="1.5"/><circle cx="20" cy="20" r="10" fill="none" stroke="currentColor" opacity=".3" stroke-width="3"/><g class="pump-rotor"><path d="M20 20v-8m0 8 7 4m-7-4-7 4" stroke="currentColor"/><circle cx="20" cy="12" r="3" fill="currentColor"/><circle cx="27" cy="24" r="3" fill="currentColor"/><circle cx="13" cy="24" r="3" fill="currentColor"/></g><circle cx="20" cy="20" r="3" fill="#c2dde5"/></svg><div class="pump-copy"><strong>P${i+1} · Peristáltica</strong><span data-read="command"></span><span class="pump-state" data-read="state"></span></div></div>${i<2?'<div class="transfer" aria-label="Transferencia a la siguiente celda"><div class="pipe"></div><span class="arrow">›</span><span class="flow-value" data-read="transfer"></span></div>':''}`;
      el('bank').append(card);
    }
  }
  function layoutPipes(){
    const cards=Array.from(el('bank').children);
    for(let i=0;i<2;i++){
      const card=cards[i];if(!card)continue;const own=card.querySelector('.vessel').getBoundingClientRect(),next=cards[i+1].querySelector('.vessel').getBoundingClientRect(),bounds=card.getBoundingClientRect();
      if(!own.width||!own.height)continue;
      const scale=Math.min(own.width/210,own.height/190),nextScale=Math.min(next.width/210,next.height/190);
      const start=own.left+(own.width-210*scale)/2+165*scale,end=next.left+(next.width-210*nextScale)/2+42*nextScale;
      const pipe=card.querySelector('.transfer');pipe.style.left=`${start-bounds.left}px`;pipe.style.width=`${Math.max(1,end-start)}px`;pipe.style.top=`${own.top-bounds.top+(own.height-190*scale)/2+70*scale}px`;pipe.style.right='auto';
    }
  }
  function configureCharts(){if(!active())return;chartSpecifications(session,selectedCell,activeStrategy).forEach((spec,i)=>charts[i].setSpec(spec));}
  function render(){
    const r=active();controls();if(!r)return;
    const row=sampleAt(r,session.elapsed),physical=r.config.model==='physical';
    text('activeModel',physical?'Física · área geométrica':'Identificada · artículo');text('bankModel',physical?`MODELO FÍSICO · A=${r.config.cells.map(x=>x.area_cm2).join('/')} cm²`:'MODELO IDENTIFICADO · VOLUMEN EQUIVALENTE');
    const origin=session.origin;text('activeEngine',`${origin.engine==='python'?'Python':'JavaScript'}${origin.kind==='file'?' · archivo'+(origin.declared?' (declarado)':''):origin.engine==='python'?' · API local':' · navegador'}`);
    text('educationActive',`Planta aplicada: ${physical?'física geométrica':'identificada del artículo'}. Sintonía: ${r.config.tuning==='simc'?'SIMC recalculado':'ganancias explícitas'}.`);
    text('elapsed',session.elapsed);text('total',session.duration);el('time').max=session.duration;el('time').value=session.elapsed;text('timelineEnd',`${session.duration} s`);
    text('sampleNote',session.elapsed===session.duration?'Estado terminal · caudales del último intervalo':`Estado a t=${session.elapsed} s · IAE hasta este instante`);
    text('externalFeed',`${fixed(row.qin_lpm[0])} L/min →`);text('externalOut',`→ ${fixed(row.qout_lpm[2])} L/min`);
    document.querySelectorAll('.process-cell').forEach((card,i)=>{
      const snap=cellSnapshot(r,session.elapsed,i),read=key=>card.querySelector(`[data-read=${key}]`),put=(key,value)=>{read(key).textContent=value;};
      put('delay',`θ = ${r.config.cells[i].theta_s} s`);put('level',fixed(snap.level));put('percent',`${fixed(snap.percent,1)} % de llenado`);put('setpoint',`${fixed(snap.setpoint)} cm`);put('error',`${snap.error>0?'+':''}${fixed(snap.error,3)} cm`);put('qin',`${fixed(snap.qin)} L/min`);put('qout',`${fixed(snap.qout)} L/min`);put('command',`Orden: ${fixed(snap.command)} L/min`);put('state',snap.pumpState+(snap.spill>1e-8?` · ${fixed(snap.spill)} L/min`:''));put('maxheight',String(snap.height));put('tick2',fixed(snap.height*2/3,0));put('tick1',fixed(snap.height/3,0));
      read('state').classList.toggle('warning',snap.saturated||snap.spill>1e-8);card.dataset.flow=String(snap.qout>1e-8);card.dataset.alert=String(snap.spill>1e-8||snap.saturated);card.dataset.level=String(snap.level);
      const y=165-153*snap.percent/100;read('liquid').setAttribute('y',String(y));read('liquid').setAttribute('height',String(165-y));read('foam').setAttribute('y',String(y-4));read('foam').style.display=snap.level>0?'':'none';const spy=165-153*snap.setpoint/snap.height;read('target').setAttribute('y1',String(spy));read('target').setAttribute('y2',String(spy));
      card.querySelector('.vessel').setAttribute('aria-label',`C${i+1}: ${fixed(snap.level)} cm, consigna ${fixed(snap.setpoint)} cm, máximo ${snap.height} cm`);
      card.querySelector('.pump-rotor').style.animationDuration=`${Math.max(.25,4*45/Math.max(snap.qout,.001))}s`;
      if(i<2)put('transfer',`${fixed(snap.qout,1)} L/min`);
    });
    text('balance',`Residual: ${row.balance_residual_l.toExponential(2)} L${physical?'':' equivalentes'}`);
    const fb=session.prefix.feedback?.[session.elapsed],ff=session.prefix.feedback_feedforward?.[session.elapsed];
    el('comparison').replaceChildren();const comparison=fb&&ff?iaeComparison(fb,ff):null;
    for(let i=0;i<3;i++){
      const tr=document.createElement('tr');const values=[`C${i+1}`,fb?fixed(fb[i],3):'—',ff?fixed(ff[i],3):'—',comparison?(comparison[i].percent===null?'—':`${comparison[i].percent>0?'+':''}${fixed(comparison[i].percent,2)} %`):'—',comparison?(comparison[i].winner==='equal'?'Iguales':comparison[i].winner==='feedback'?'Feedback PI':'PI + FF'):'Sin comparar'];
      values.forEach((v,index)=>{const td=document.createElement('td');td.textContent=v;if(index===0){td.style.color=CELL_COLORS[i];td.style.fontWeight=600;}if(index===3&&comparison)td.className=comparison[i].percent===null?'neutral':comparison[i].percent>0?'improved':comparison[i].percent<0?'worse':'neutral';tr.append(td);});el('comparison').append(tr);
    }
    text('comparisonNote',`IAE hasta ${session.elapsed} s; horizonte total ${session.duration} s. ${r.config.feedforward_mode==='paper_increment'?'FF literal: diferencia entre muestras.':'Variante experimental de implementación propia: FF acumulado.'} Misma alimentación externa; C2 y C3 reciben la descarga de su celda anterior.`);
    charts.forEach(chart=>chart.update(session.elapsed));
  }
  function loaded(results,origin){
    session.load(results,origin);dirty=false;document.querySelector('.simulation-column').classList.remove('is-dirty');text('dirtyLabel','Parámetros aplicados. El experimento es reproducible.');
    for(const option of el('viewStrategy').options)option.disabled=!results[option.value];if(!results[activeStrategy])activeStrategy=Object.keys(results)[0];el('viewStrategy').value=activeStrategy;
    configureCharts();renderSIMC(el('simcTable'),active(),reference);render();layoutPipes();
    text('articleResult',`Resultados simulados completos a T=${session.duration} s: `+Object.entries(results).map(([s,r])=>`${s==='feedback'?'PI':'PI+FF'} = [${r.iae_cm_s.map(v=>fixed(v,3)).join(', ')}] cm·s`).join('; ')+'. No equivalen al ensayo publicado.');
  }
  async function compute(){
    session.pause();const c=readConfig(),mode=el('mode').value,strategies=mode==='compare'?STRATEGIES:[mode],engine=el('engine').value,token=++generation;
    busy=true;message(`Calculando ${strategies.length===2?'ambas estrategias':'la estrategia seleccionada'} con ${engine==='python'?'Python local':'JavaScript'}…`);controls();
    try{
      const results=engine==='python'?await pythonClient.simulate(c,strategies,schema):await browserEngine.simulate(c,strategies);
      if(token!==generation)return;
      for(const strategy of strategies){const r=results[strategy];validateDocument(r,schema);if(r.kind!=='result'||r.strategy!==strategy||!sameDocument(r.config,c))throw Error('El motor devolvió un escenario diferente al solicitado.');}
      base=structuredClone(c);busy=false;loaded(results,{engine,kind:'computed',declared:false});connection();message('Cálculo completado. Pulsa Iniciar o recorre el tiempo. Las curvas proceden del motor indicado.');
    }catch(e){if(token!==generation)return;busy=false;dirty=true;session.pause();message(e.message,'error');connection();controls();throw e;}
  }
  async function loadPreset(name){fillForm(createPreset(name,reference));el('preset').value=name;await compute();}
  async function importData(data,rawOrigin='python'){
    let imported;
    const verify=r=>{if(r.config.duration_s>7200)throw Error('La interfaz admite hasta 7200 s.');return verifyResult(r);};
    if(data?.kind==='simulation_exchange')imported=validateExchange(data,schema,verify);
    else{validateDocument(data,schema);if(data.kind==='scenario'){validateConfig(data);if(data.duration_s>7200)throw Error('La interfaz admite hasta 7200 s.');fillForm(data);el('preset').value='custom';await compute();message('Escenario importado y calculado con el motor seleccionado.');return;}verify(data);imported={results:{[data.strategy]:data},engine:rawOrigin};}
    const r=Object.values(imported.results)[0];if(r.config.duration_s>7200)throw Error('La interfaz admite resultados de hasta 7200 s.');
    generation++;busy=false;fillForm(r.config);el('preset').value='custom';el('mode').value=Object.keys(imported.results).length===2?'compare':r.strategy;loaded(imported.results,{engine:imported.engine,kind:'file',declared:true});
    message('Resultados de archivo importados y verificados. Se visualizan las series del archivo; el motor declarado no acredita su autoría.');text('importInfo',`Archivo verificado · origen ${imported.engine==='python'?'Python':'JavaScript'} declarado. Para comparar, importa las dos estrategias juntas o recalcula.`);
  }
  // Bind controls before loading data; the visible state always tracks applied results.
  el('parameters').addEventListener('submit',safe(async event=>{event.preventDefault();await compute();}));
  el('parameters').addEventListener('input',event=>{if(event.target.id==='preset')return;markDirty();});
  el('parameters').addEventListener('change',event=>{if(event.target.id==='preset')return;markDirty();updateHints();});
  el('preset').addEventListener('change',safe(()=>loadPreset(el('preset').value)));
  el('model').addEventListener('change',()=>{
    const c={...base,model:el('model').value,tuning:el('model').value==='physical'?'simc':'paper_final'};el('tuning').value=c.tuning;
    for(let i=0;i<3;i++){const gain=controllerFor(c,i);el(`kc-${i}`).value=gain.kc;el(`ti-${i}`).value=gain.ti_s;}updateHints();
  });
  el('tuning').addEventListener('change',()=>{if(el('tuning').value==='simc'){const c={...base,model:el('model').value,tuning:'simc'};for(let i=0;i<3;i++){const g=controllerFor(c,i);el(`kc-${i}`).value=g.kc;el(`ti-${i}`).value=g.ti_s;}}updateHints();});
  el('addDisturbance').onclick=safe(()=>{const c=readConfig();renderEvents(addPerturbation(c,el('distTime').valueAsNumber,el('distDelta').valueAsNumber,el('returnEnabled').checked?el('returnTime').valueAsNumber:null));markDirty();});
  el('returnEnabled').onchange=()=>{el('returnTime').disabled=!el('returnEnabled').checked;};
  el('addEvent').onclick=safe(()=>{const events=readEvents();events.push({time_s:Math.min(60,el('duration').valueAsNumber-1),type:'setpoint',cell:0,value:el('sp-0').valueAsNumber});renderEvents(events);markDirty();});
  el('restore').onclick=safe(()=>loadPreset('paper'));el('distPreset').onclick=safe(()=>loadPreset('disturbance'));el('comparePreset').onclick=safe(async()=>{el('mode').value='compare';await compute();});
  el('play').onclick=safe(()=>{if(dirty)throw Error('Aplica primero los parámetros pendientes.');session.play(now());render();});
  el('pause').onclick=()=>{session.pause();render();};el('reset').onclick=()=>{session.reset();render();};el('step').onclick=()=>{session.step();render();};el('time').oninput=()=>{session.seek(el('time').value);render();};el('goEnd').onclick=()=>{session.seek(session.duration);render();};el('speed').onchange=()=>session.setSpeed(el('speed').value);
  el('viewStrategy').onchange=()=>{activeStrategy=el('viewStrategy').value;configureCharts();render();};
  document.querySelectorAll('[data-cell]').forEach(button=>{if(button.tagName!=='BUTTON')return;button.onclick=()=>{selectedCell=Number(button.dataset.cell);document.querySelectorAll('button[data-cell]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));configureCharts();render();};});
  el('exportConfig').onclick=safe(()=>{if(!active())throw Error('No hay escenario aplicado.');download(active().config,'flotalab_escenario.json');message('Escenario aplicado exportado. Los cambios pendientes del formulario no se incluyen.');});
  el('exportResult').onclick=safe(()=>{download(makeExchange(session.results,session.origin.engine),'flotalab_resultados.json');message('Series completas exportadas con su motor declarado de origen.');});
  el('import').onchange=safe(async()=>{const file=el('import').files[0];if(!file)return;try{if(file.size>40*1024*1024)throw Error('El archivo supera el límite de 40 MB.');await importData(JSON.parse((await file.text()).replace(/^\uFEFF/,'')),el('rawOrigin').value);}finally{el('import').value='';}});
  el('engine').onchange=()=>{markDirty();message('Motor de próximo cálculo cambiado. Los datos actuales conservan su origen; pulsa Aplicar y calcular.','pending');};
  el('connect').onclick=safe(async()=>{el('connect').disabled=true;try{await pythonClient.connect(el('pythonUrl').value);startHeartbeat();message('Python respondió a /health. Selecciona Python local y aplica el escenario para usar /simulate.');}finally{el('connect').disabled=false;connection();}});
  el('disconnect').onclick=()=>{pythonClient.disconnect();session.pause();generation++;busy=false;connection();message('Python desconectado. Los resultados guardados conservan su origen. Elige Navegador explícitamente para nuevos cálculos.','pending');controls();};
  const readJson=async path=>{const response=await fetcher(path);if(!response.ok)throw Error(`No se pudo cargar ${path} (HTTP ${response.status}).`);return response.json();};
  [reference,schema]=await Promise.all([readJson('configs/paper_identified.json'),readJson('schemas/simulation-v1.schema.json')]);validateDocument(reference,schema);
  const custom=document.createElement('option');custom.value='custom';custom.textContent='Personalizado / importado';custom.disabled=true;el('preset').append(custom);
  renderEquations(el('equations'));buildBank();if(globalThis.ResizeObserver){const observer=new ResizeObserver(layoutPipes);observer.observe(el('bank'));}session.setSpeed(el('speed').value);connection();await loadPreset('paper');
  const frame=time=>{if(session.tick(time))render();raf(frame);};raf(frame);
  return {session,compute,importData,loadPreset,readConfig,render,pythonClient,get dirty(){return dirty;},get busy(){return busy;}};
}
