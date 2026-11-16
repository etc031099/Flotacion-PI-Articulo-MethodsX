import {validateConfig,simc} from './core.js';
export const SCENARIO_NAMES={paper:'Referencia del artículo · cambios de consigna',physical:'Balance físico · SIMC recalculado',disturbance:'Perturbación de alimentación',equilibrium:'Equilibrio del banco'};
export function createPreset(name,reference){
  const c=structuredClone(reference);
  if(name==='physical'){c.model='physical';c.tuning='simc';c.description='Modelo físico geométrico, sintonizado con SIMC.';}
  if(name==='equilibrium'){c.events=[];c.description='Equilibrio didáctico: entrada y descargas iguales.';}
  if(name==='disturbance'){c.events=[{time_s:120,type:'feed',value:55},{time_s:420,type:'feed',value:45}];c.description='Escalón didáctico de alimentación de +10 L/min y retorno.';}
  return validateConfig(c);
}
export function controllerFor(c,i){const x=c.cells[i];return c.tuning==='simc'?simc(c.model==='physical'?-1000/(60*x.area_cm2):x.k_prime,x.theta_s,x.tau_c_s):{kc:x.kc_final,ti_s:x.ti_final_s};}
export function applyParameters(base,values){
  const c=structuredClone(base);
  c.duration_s=values.duration;c.feed_lpm=values.feed;c.feedforward_mode=values.ffMode;c.tuning=values.tuning;
  c.cells.forEach((x,i)=>{x.setpoint_cm=values.setpoints[i];x.initial_level_cm=values.initials[i];x.kff=values.kff[i];if(c.tuning==='paper_final'){x.kc_final=values.kc[i];x.ti_final_s=values.ti[i];}});
  c.events=structuredClone(values.events);
  validateConfig(c);
  // UI limits bound rendering/memory; the core's independent 86400 s contract is unchanged.
  if(c.duration_s>7200)throw Error('La interfaz admite hasta 7200 s por experimento.');
  return c;
}
export function addPerturbation(c,time,delta,returnTime=null){
  if(!Number.isFinite(delta)||!Number.isInteger(time)||time<0||time>=c.duration_s||c.feed_lpm+delta<0)throw Error('Revisa el instante y la magnitud de la perturbación.');
  if(returnTime!==null&&(!Number.isInteger(returnTime)||returnTime<=time||returnTime>=c.duration_s))throw Error('El retorno debe ser posterior al escalón y anterior al final.');
  const events=c.events.filter(e=>e.type!=='feed');events.push({time_s:time,type:'feed',value:c.feed_lpm+delta});if(returnTime!==null)events.push({time_s:returnTime,type:'feed',value:c.feed_lpm});
  return events.sort((a,b)=>a.time_s-b.time_s);
}
