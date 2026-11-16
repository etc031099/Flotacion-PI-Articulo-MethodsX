import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulate,compare,simc,validateConfig,verifyResult} from '../web/core.js';
const config=()=>JSON.parse(readFileSync(new URL('../configs/paper_identified.json',import.meta.url),'utf8'));
test('Equilibrium and immutable configuration',()=>{
  const c=config();c.events=[];const before=structuredClone(c);
  for(const r of Object.values(compare(c)))assert.ok(r.iae_cm_s.every(v=>v<1e-8));
  assert.deepEqual(c,before);
});
test('Negative controller action, exact seven-second delay and conservation',()=>{
  const c=config();c.events=[];c.cells[0].setpoint_cm=29.9;
  const r=simulate(c);assert.ok(r.series[0].command_lpm[0]>45);
  for(const row of r.series.slice(0,7))assert.equal(row.qout_lpm[0],45);
  assert.equal(r.series[7].qout_lpm[0],r.series[0].command_lpm[0]);
  for(const row of r.series){assert.deepEqual(row.qin_lpm.slice(1),row.qout_lpm.slice(0,2));assert.ok(Math.abs(row.balance_residual_l)<1e-8);}
});
test('SIMC reconstructed independently from experimental final gains',()=>{
  assert.ok(Math.abs(simc(-0.001018,3,8).kc+89.3016610108948)<1e-9);
  assert.equal(simc(-0.001018,3,8).ti_s,44);
  assert.equal(config().cells[2].ti_final_s,44);
});
test('Invalid units, time, geometry and strategy rejected',()=>{
  const c=config();c.units.flow='m3/s';assert.throws(()=>validateConfig(c));
  const b=config();b.dt_s=0.1;assert.throws(()=>simulate(b));
  const d=config();d.cells[0].area_cm2=0;assert.throws(()=>simulate(d));
  assert.throws(()=>simulate(config(),'invalid'));
});
test('Identical scenario and IAE horizon for both strategies',()=>{
  const results=Object.values(compare(config()));
  assert.deepEqual(results[0].config,results[1].config);
  for(const r of results){assert.equal(r.series.length,900);for(let i=0;i<3;i++)assert.equal(r.iae_cm_s[i],r.series.reduce((s,row)=>s+Math.abs(row.error_cm[i]),0));}
});
test('Imported results replay all fields and reject altered series and origin',()=>{
  const r=simulate(config());assert.equal(verifyResult(r),r);
  const altered=structuredClone(r);altered.series[10].qin_lpm[1]+=1;assert.throws(()=>verifyResult(altered));
  const origin=structuredClone(r);origin.data_origin='experimental';assert.throws(()=>verifyResult(origin));
});
