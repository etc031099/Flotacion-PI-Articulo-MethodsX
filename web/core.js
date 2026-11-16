/** Deterministic counterpart of flotation/core.py; browser ES module. */
export const VERSION = '1.0.0';
export const UNITS = {time:'s',level:'cm',flow:'L/min',volume:'L',iae:'cm*s',area:'cm^2',kc:'L/min/cm',k_prime:'cm/s/(L/min)',kff:'1'};
export function simc(k, theta, tc, tau1 = null) {
  if (!(k < 0 && theta >= 0 && tc > 0 && tc >= theta) || (tau1 !== null && tau1 <= 0)) throw Error('Invalid SIMC parameters');
  return {kc:1/(k*(tc+theta)),ti_s:tau1===null?4*(tc+theta):Math.min(tau1,4*(tc+theta))};
}
export function validateConfig(c) {
  const req=(ok,msg)=>{if(!ok)throw Error(msg);};
  const num=x=>typeof x==='number' && Number.isFinite(x);
  req(c.schema_version===VERSION && c.kind==='scenario','Unsupported scenario version/kind');
  req(c.units && Object.keys(c.units).length===Object.keys(UNITS).length && Object.entries(UNITS).every(([k,v])=>c.units[k]===v),'Units must match schema 1.0.0');
  req(['physical','identified'].includes(c.model),'Unknown model');
  req(['paper_final','simc'].includes(c.tuning),'Unknown tuning');
  req(['paper_increment','accumulated_increment'].includes(c.feedforward_mode),'Unknown feedforward mode');
  req(c.dt_s===1,'This version requires dt_s = 1');
  req(Number.isInteger(c.duration_s)&&c.duration_s>=1&&c.duration_s<=86400,'Invalid duration');
  req(num(c.feed_lpm)&&c.feed_lpm>=0,'Invalid feed');
  req(num(c.pump_min_lpm)&&num(c.pump_max_lpm)&&0<=c.pump_min_lpm&&c.pump_min_lpm<c.pump_max_lpm,'Invalid pump limits');
  req(c.pump_min_lpm<=c.feed_lpm&&c.feed_lpm<=c.pump_max_lpm,'Bias outside pump limits');
  req(Array.isArray(c.cells)&&c.cells.length===3,'Exactly three cells required');
  for(const x of c.cells){
    for(const key of ['area_cm2','height_cm','initial_level_cm','setpoint_cm','k_prime','theta_s','tau_c_s','kc_final','ti_final_s','kff'])req(num(x[key]),'Invalid cell field: '+key);
    req(x.area_cm2>0&&x.height_cm>0,'Invalid geometry');
    req(x.initial_level_cm>=0&&x.initial_level_cm<=x.height_cm&&x.setpoint_cm>=0&&x.setpoint_cm<=x.height_cm,'Level outside cell');
    req(Number.isInteger(x.theta_s)&&x.theta_s>=0&&x.theta_s<=3600,'Delay must be integer seconds');
    req(x.tau_c_s>0&&x.tau_c_s>=x.theta_s,'Invalid tau_c');
    req(x.k_prime<0&&x.kc_final<0&&x.ti_final_s>0&&x.kff>=0&&x.kff<=1,'Invalid controller');
  }
  req(Array.isArray(c.events),'events must be an array');
  for(const e of c.events){
    req(Number.isInteger(e.time_s)&&e.time_s>=0&&e.time_s<c.duration_s,'Invalid event time');
    req(['feed','setpoint'].includes(e.type)&&num(e.value),'Invalid event');
    if(e.type==='feed')req(e.value>=0,'Negative feed');
    else {req(Number.isInteger(e.cell)&&e.cell>=0&&e.cell<3,'Invalid cell index');req(e.value>=0&&e.value<=c.cells[e.cell].height_cm,'Invalid setpoint');}
  }
  return c;
}
export function simulate(config,strategy='feedback') {
  const c=structuredClone(validateConfig(config));
  if(!['feedback','feedback_feedforward'].includes(strategy))throw Error('Unknown strategy');
  const cells=c.cells;
  const areas=cells.map(x=>c.model==='physical'?x.area_cm2:1000/(60*Math.abs(x.k_prime)));
  const gains=cells.map((x,i)=>c.tuning==='simc'?simc(-1000/(60*areas[i]),x.theta_s,x.tau_c_s):{kc:x.kc_final,ti_s:x.ti_final_s});
  let h=cells.map(x=>x.initial_level_cm);
  const sp=cells.map(x=>x.setpoint_cm),integral=[0,0,0],ff=[0,0,0],previousIn=Array(3).fill(c.feed_lpm);
  const queues=cells.map(x=>Array(x.theta_s).fill(c.feed_lpm));
  let iae=[0,0,0], feed=c.feed_lpm,boundaryVolume=0;
  const series=[],sum=a=>a.reduce((s,v)=>s+v,0);
  const initialVolume=sum(h.map((y,i)=>areas[i]*y/1000));
  for(let t=0;t<c.duration_s;t++){
    for(const e of c.events)if(e.time_s===t){if(e.type==='feed')feed=e.value;else sp[e.cell]=e.value;}
    const errors=sp.map((s,i)=>s-h[i]);
    const commands=[],incoming=[],outgoing=[],spills=[],saturated=[];
    for(let i=0;i<3;i++){
      const cell=cells[i],gain=gains[i],area=areas[i],qin=i===0?feed:outgoing[i-1];
      const delta=qin-previousIn[i];previousIn[i]=qin;
      if(strategy==='feedback_feedforward')ff[i]=cell.kff*delta+(c.feedforward_mode==='accumulated_increment'?ff[i]:0);
      const base=c.feed_lpm+gain.kc*errors[i]+ff[i],increment=gain.kc/gain.ti_s*errors[i];
      const trial=base+integral[i]+increment;
      if(!((trial>c.pump_max_lpm&&increment>0)||(trial<c.pump_min_lpm&&increment<0)))integral[i]+=increment;
      const raw=base+integral[i],command=Math.max(c.pump_min_lpm,Math.min(c.pump_max_lpm,raw));
      let delayed=command;
      if(queues[i].length){delayed=queues[i].shift();queues[i].push(command);}
      const available=h[i]*area/1000+qin/60,qout=Math.min(delayed,available*60),volume=available-qout/60;
      const spill=Math.max(0,volume-area*cell.height_cm/1000)*60;
      commands.push(command);incoming.push(qin);outgoing.push(qout);spills.push(spill);saturated.push(raw!==command||qout!==delayed);
    }
    const newH=h.map((y,i)=>Math.max(0,1000/areas[i]*(areas[i]*y/1000+(incoming[i]-outgoing[i]-spills[i])/60)));
    iae=iae.map((v,i)=>v+Math.abs(errors[i]));
    boundaryVolume+=(feed-outgoing[2]-sum(spills))/60;
    const residual=sum(newH.map((y,i)=>areas[i]*y/1000))-initialVolume-boundaryVolume;
    series.push({time_s:t,level_cm:[...h],setpoint_cm:[...sp],error_cm:errors,qin_lpm:incoming,command_lpm:commands,qout_lpm:outgoing,spill_lpm:spills,saturated,next_level_cm:[...newH],balance_residual_l:residual});
    h=newH;
  }
  return {schema_version:VERSION,kind:'result',data_origin:'simulated',units:{...UNITS},strategy,config:c,storage_area_cm2:areas,controllers:gains,iae_cm_s:iae,final_level_cm:h,series};
}
export function compare(config){return Object.fromEntries(['feedback','feedback_feedforward'].map(s=>[s,simulate(config,s)]));}

/** Check an imported Python/JS result by replaying its scenario, including every series field. */
export function verifyResult(result){
  const expected=simulate(result.config,result.strategy);
  function check(a,b,path){
    if(typeof b==='number'){
      if(typeof a!=='number'||!Number.isFinite(a)||Math.abs(a-b)>1e-8+1e-11*Math.abs(b))throw Error('Resultado inconsistente: '+path);
    }else if(b!==null&&typeof b==='object'){
      if(a===null||typeof a!=='object'||Array.isArray(a)!==Array.isArray(b)||Object.keys(a).length!==Object.keys(b).length)throw Error('Estructura inconsistente: '+path);
      for(const key of Object.keys(b))check(a[key],b[key],path+'.'+key);
    }else if(a!==b)throw Error('Metadato inconsistente: '+path);
  }
  check(result,expected,'result');
  return result;
}
