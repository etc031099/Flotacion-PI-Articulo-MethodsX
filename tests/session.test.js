import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulate,compare} from '../web/core.js';
import {SimulationSession,sampleAt,cellSnapshot,iaeComparison,cumulativeIAE} from '../web/session.js';
import {createPreset,addPerturbation,controllerFor,applyParameters} from '../web/scenarios.js';
import {chartSpecifications,decimate} from '../web/charts.js';
const reference=JSON.parse(readFileSync(new URL('../configs/paper_identified.json',import.meta.url),'utf8'));
const session=()=>{const s=new SimulationSession();s.load(compare(reference),{engine:'javascript'});return s;};
test('Playback: start, pause, continue, step and deterministic reset',()=>{
  const s=session();s.play(0);assert.equal(s.tick(1000),true);assert.equal(s.elapsed,1);s.pause();s.tick(5000);assert.equal(s.elapsed,1);s.play(6000);s.tick(7000);assert.equal(s.elapsed,2);s.step();assert.equal(s.elapsed,3);assert.equal(s.running,false);const result=s.results;s.reset();assert.equal(s.elapsed,0);assert.equal(s.results,result);
});
test('Playback speed changes presentation only; no fractional mathematical step',()=>{
  for(const speed of [1,5,10,20]){const s=session();s.setSpeed(speed);s.play(0);s.tick(1500);assert.equal(s.elapsed,Math.floor(1.5*speed));assert.equal(s.results.feedback.config.dt_s,1);s.tick(3000);assert.equal(s.elapsed,3*speed);}
});
test('Terminal time clamps to T and never adds an IAE interval',()=>{
  const s=session();s.play(0);s.tick(2000000);assert.equal(s.elapsed,900);assert.equal(s.running,false);assert.deepEqual(s.prefix.feedback.at(-1),s.results.feedback.iae_cm_s);assert.equal(sampleAt(s.results.feedback,900).time_s,900);assert.deepEqual(sampleAt(s.results.feedback,900).level_cm,s.results.feedback.final_level_cm);s.step();assert.equal(s.elapsed,900);
});
test('Seek pauses and IAE is zero initially, prefix at n, full integral at T',()=>{
  const s=session();assert.deepEqual(s.prefix.feedback[0],[0,0,0]);s.seek(200);assert.equal(s.running,false);for(let i=0;i<3;i++)assert.equal(s.prefix.feedback[200][i],s.results.feedback.series.slice(0,200).reduce((v,r)=>v+Math.abs(r.error_cm[i]),0));assert.throws(()=>s.seek(NaN));
});
test('All cell snapshots and connector values come from actual core samples',()=>{
  const r=simulate(reference);for(const n of [0,7,60,200,420,899,900])for(let i=0;i<3;i++){const v=cellSnapshot(r,n,i),row=sampleAt(r,n);assert.equal(v.level,row.level_cm[i]);assert.ok(Math.abs(v.percent-row.level_cm[i]/45*100)<1e-12);assert.equal(v.qout,row.qout_lpm[i]);if(i<2)assert.equal(v.qout,row.qin_lpm[i+1]);}
});
test('Comparison handles zero IAE, ties, improvement and deterioration honestly',()=>{
  const c=iaeComparison([0,20,10],[1,10,20]);assert.equal(c[0].percent,null);assert.equal(c[0].winner,'feedback');assert.equal(c[1].percent,50);assert.equal(c[2].percent,-100);assert.equal(iaeComparison([0],[0])[0].winner,'equal');
});
test('Preset generation preserves reference and separates physical tuning',()=>{
  const before=structuredClone(reference),physical=createPreset('physical',reference);assert.equal(physical.tuning,'simc');assert.equal(physical.model,'physical');assert.ok(Math.abs(controllerFor(physical,0).kc+3.857142857)<1e-8);assert.deepEqual(reference,before);assert.deepEqual(createPreset('equilibrium',reference).events,[]);
});
test('Parameter edits and perturbations validate their horizon and units',()=>{
  const c=reference;const values={duration:900,feed:45,ffMode:'paper_increment',tuning:'paper_final',events:c.events,setpoints:[30,33,33],initials:[30,33,33],kff:[.8,.8,1],kc:[-60,-70,-80],ti:[56,30,44]};assert.equal(applyParameters(c,values).cells[0].kc_final,-60);assert.throws(()=>applyParameters(c,{...values,duration:60}));assert.throws(()=>applyParameters(c,{...values,duration:8000}));assert.throws(()=>addPerturbation(c,900,10));assert.throws(()=>addPerturbation(c,10,-100));assert.throws(()=>addPerturbation(c,10,5,5));const events=addPerturbation(c,100,5,200);assert.equal(events.filter(e=>e.type==='setpoint').length,3);assert.equal(events.find(e=>e.type==='feed').value,50);
});
test('Chart source arrays include actual levels, commands, errors and terminal IAE',()=>{
  const s=session(),spec=chartSpecifications(s,1,'feedback');assert.equal(spec.length,6);for(const chart of spec)for(const line of chart.lines)assert.equal(line.values.length,901);assert.equal(spec[0].lines[0].values[420],s.results.feedback.series[420].level_cm[1]);assert.equal(spec[4].lines[0].values[900],s.results.feedback.iae_cm_s[1]);
});
test('Rendering decimation preserves spikes and never exposes future points',()=>{
  const values=Array(10000).fill(0);values[1234]=1000;values[4321]=-1000;const points=decimate(values,5000,100);assert.ok(points.some(([i,v])=>i===1234&&v===1000));assert.ok(points.some(([i,v])=>i===4321&&v===-1000));assert.ok(points.every(([i])=>i<=5000));assert.ok(points.length<=204);assert.deepEqual(decimate(values,0),[[0,0]]);
});
