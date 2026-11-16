import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {bootApp} from '../web/app.js';
import {compare,simulate} from '../web/core.js';
import {makeExchange} from '../web/validation.js';
import {PythonClient} from '../web/python-client.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ref=JSON.parse(readFileSync(new URL('../configs/paper_identified.json',import.meta.url),'utf8'));
const schema=JSON.parse(readFileSync(new URL('../schemas/simulation-v1.schema.json',import.meta.url),'utf8'));
const windows=[];
async function setup(options={}){
  const window=new Window({url:'http://localhost:8000'});windows.push(window);window.document.write(html);globalThis.document=window.document;window.document.getElementById('speed').value='10';
  const charts=[],downloads=[],requests=[],frames=[];let timer=0;
  const browserEngine={simulate:async(c,strategies)=>{requests.push({c,strategies});return Object.fromEntries(strategies.map(s=>[s,simulate(c,s)]));}};
  const chartFactory=()=>{const chart={setSpec(spec){this.spec=spec;},update(n){this.elapsed=n;}};charts.push(chart);return chart;};
  const app=await bootApp({fetcher:async path=>({ok:true,json:async()=>path.startsWith('configs')?structuredClone(ref):schema}),browserEngine,chartFactory,raf:fn=>{frames.push(fn);},now:()=>timer,download:(data,name)=>downloads.push({data,name}),...options});
  const el=id=>window.document.getElementById(id),event=(id,name)=>el(id).dispatchEvent(new window.Event(name,{bubbles:true,cancelable:true}));
  const click=id=>el(id).click(),settle=()=>new Promise(resolve=>setTimeout(resolve,0));
  return {app,window,el,event,click,settle,charts,downloads,requests,setTime:n=>{timer=n;},frame:n=>{const fn=frames.shift();fn(n);}};
}
after(async()=>{for(const w of windows)await w.happyDOM.abort();delete globalThis.document;});
test('UI initially displays all three true core levels and six signal charts',async()=>{
  const t=await setup();assert.equal(t.el('activeEngine').textContent,'JavaScript · navegador');assert.equal(t.window.document.querySelectorAll('.process-cell').length,3);for(let i=0;i<3;i++){const card=t.window.document.querySelector(`.process-cell[data-cell="${i}"]`);assert.equal(Number(card.dataset.level),ref.cells[i].initial_level_cm);}assert.equal(t.charts.length,6);assert.equal(t.app.session.duration,900);
});
test('UI Start, Pause, Continue, Step, Reset and end controls work',async()=>{
  const t=await setup();t.click('play');assert.equal(t.app.session.running,true);t.frame(1000);assert.equal(t.app.session.elapsed,10);t.click('pause');assert.equal(t.app.session.running,false);t.click('step');assert.equal(t.app.session.elapsed,11);t.setTime(2000);t.click('play');t.frame(3000);assert.equal(t.app.session.elapsed,21);t.click('reset');assert.equal(t.app.session.elapsed,0);t.click('goEnd');assert.equal(t.app.session.elapsed,900);assert.match(t.el('comparison').textContent,/42.345/);
});
test('Edits pause playback and cannot masquerade as applied parameters',async()=>{
  const t=await setup();t.click('play');t.el('sp-0').value='31';t.event('sp-0','input');assert.equal(t.app.session.running,false);assert.equal(t.app.dirty,true);assert.equal(t.el('play').disabled,true);assert.equal(t.app.session.results.feedback.config.cells[0].setpoint_cm,30);await t.app.compute();assert.equal(t.app.session.results.feedback.config.cells[0].setpoint_cm,31);assert.equal(t.app.dirty,false);
});
test('Invalid horizon is rejected without replacing or erasing previous results',async()=>{
  const t=await setup(),previous=t.app.session.results;t.el('duration').value='60';t.event('duration','input');await assert.rejects(()=>t.app.compute());assert.equal(t.app.session.results,previous);assert.equal(t.app.session.running,false);
});
test('Both strategy modes and active-view selector display the requested real dataset',async()=>{
  const t=await setup();t.el('mode').value='feedback_feedforward';await t.app.compute();assert.deepEqual(Object.keys(t.app.session.results),['feedback_feedforward']);assert.equal(t.el('viewStrategy').value,'feedback_feedforward');assert.equal(t.el('viewStrategy').options[0].disabled,true);t.el('mode').value='compare';await t.app.compute();t.el('viewStrategy').value='feedback';t.event('viewStrategy','change');t.click('goEnd');assert.match(t.el('comparison').textContent,/-0.24 %/);assert.match(t.el('comparison').textContent,/Feedback PI/);
});
test('Preset model switches to geometric SIMC and restore returns to paper finals',async()=>{
  const t=await setup();await t.app.loadPreset('physical');assert.equal(t.app.session.results.feedback.config.model,'physical');assert.equal(t.app.session.results.feedback.config.tuning,'simc');assert.match(t.el('activeModel').textContent,/Física/);await t.app.loadPreset('paper');assert.equal(t.app.session.results.feedback.controllers[0].kc,-62);assert.equal(t.app.session.results.feedback.config.feedforward_mode,'paper_increment');
});
test('Advanced explicit gains, Kff and initial levels alter the actual configuration',async()=>{
  const t=await setup();t.el('kc-0').value='-60';t.el('ti-0').value='60';t.el('ff-0').value='.5';t.el('h0-0').value='29';await t.app.compute();const r=t.app.session.results.feedback;assert.equal(r.controllers[0].kc,-60);assert.equal(r.controllers[0].ti_s,60);assert.equal(r.config.cells[0].kff,.5);assert.equal(r.series[0].level_cm[0],29);assert.match(t.el('simcTable').textContent,/Editado por usuario/);
});
test('Perturbation button edits actual feed events; apply runs them',async()=>{
  const t=await setup();t.el('distTime').value='100';t.el('distDelta').value='5';t.el('returnTime').value='200';t.click('addDisturbance');await t.settle();await t.app.compute();const rows=t.app.session.results.feedback.series;assert.equal(rows[99].qin_lpm[0],45);assert.equal(rows[100].qin_lpm[0],50);assert.equal(rows[200].qin_lpm[0],45);
});
test('Export/import roundtrip preserves scenario, complete IAE, version and declared engine',async()=>{
  const t=await setup();t.click('exportResult');await t.settle();const file=t.downloads[0].data;assert.equal(file.kind,'simulation_exchange');assert.equal(file.engine,'javascript');const before=t.app.session.results.feedback.iae_cm_s;await t.app.importData(file);assert.deepEqual(t.app.session.results.feedback.iae_cm_s,before);assert.match(t.el('activeEngine').textContent,/archivo/);t.click('exportConfig');assert.equal(t.downloads.at(-1).data.kind,'scenario');await t.app.importData(t.downloads.at(-1).data);assert.match(t.el('activeEngine').textContent,/navegador/);
});
test('Legacy Python result is displayed as declared file origin; corruption is refused',async()=>{
  const t=await setup(),r=simulate(ref,'feedback_feedforward');await t.app.importData(r,'python');assert.match(t.el('activeEngine').textContent,/Python · archivo \(declarado\)/);assert.equal(t.app.session.results.feedback_feedforward,r);const corrupt=structuredClone(r);corrupt.series[10].level_cm[1]=999;await assert.rejects(()=>t.app.importData(corrupt,'python'));assert.equal(t.app.session.results.feedback_feedforward,r);
});
test('Python mode cannot silently reuse browser results when disconnected',async()=>{
  const t=await setup(),previous=t.app.session.results;t.el('engine').value='python';t.event('engine','change');await assert.rejects(()=>t.app.compute(),/Conecta Python/);assert.equal(t.app.session.results,previous);assert.match(t.el('activeEngine').textContent,/JavaScript/);assert.match(t.el('status').textContent,/Conecta Python/);
});
test('API-derived dataset is returned by Python and retains Python origin after disconnect',async()=>{
  const returned=compare(ref),client=new PythonClient({fetcher:async(url,options)=>({ok:true,json:async()=>url.endsWith('/health')?{status:'ok',engine:'python',schema_version:'1.0.0'}:returned[JSON.parse(options.body).strategy]})});
  const t=await setup({pythonClient:client});await client.connect('http://localhost:8765');t.el('engine').value='python';await t.app.compute();assert.equal(t.app.session.results.feedback,returned.feedback);assert.match(t.el('activeEngine').textContent,/Python · API/);t.click('disconnect');assert.equal(client.connected,false);assert.match(t.el('activeEngine').textContent,/Python · API/);assert.equal(t.el('engine').value,'python');
});
test('Changing the chart cell rebinds signals without modifying the experiment',async()=>{
  const t=await setup(),results=t.app.session.results;const button=t.window.document.querySelector('button[data-cell="2"]');button.click();assert.match(t.charts[0].spec.title,/C3/);assert.equal(t.charts[0].spec.lines[0].values[420],results.feedback.series[420].level_cm[2]);assert.equal(t.app.session.results,results);
});
