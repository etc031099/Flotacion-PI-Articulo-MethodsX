/** Playback and UI selectors. The numerical integrator stays in core.js. */
export const STRATEGIES=['feedback','feedback_feedforward'];
export const CELL_COLORS=['#52d9dc','#b3a0ff','#f9bb6b'];
export function cumulativeIAE(result){
  const output=[[0,0,0]];
  for(const row of result.series)output.push(row.error_cm.map((e,i)=>output.at(-1)[i]+Math.abs(e)*result.config.dt_s));
  return output;
}
export function sampleAt(result,elapsed){
  const n=Math.max(0,Math.min(result.config.duration_s,Math.floor(elapsed)));
  if(n<result.series.length)return result.series[n];
  const last=result.series.at(-1);
  return {...last,time_s:n,level_cm:result.final_level_cm,error_cm:last.setpoint_cm.map((sp,i)=>sp-result.final_level_cm[i])};
}
export function iaeComparison(fb,ff){
  return fb.map((value,i)=>({feedback:value,feedforward:ff[i],percent:value===0?null:100*(value-ff[i])/value,
    winner:Math.abs(value-ff[i])<1e-9?'equal':value<ff[i]?'feedback':'feedback_feedforward'}));
}
export function cellSnapshot(result,elapsed,cell){
  const row=sampleAt(result,elapsed),height=result.config.cells[cell].height_cm;
  const qout=row.qout_lpm[cell];
  return {level:row.level_cm[cell],percent:100*row.level_cm[cell]/height,setpoint:row.setpoint_cm[cell],error:row.error_cm[cell],qin:row.qin_lpm[cell],qout,command:row.command_lpm[cell],spill:row.spill_lpm[cell],saturated:row.saturated[cell],height,
    pumpState:row.spill_lpm[cell]>1e-8?'Rebose':row.saturated[cell]?'Limitada':qout<1e-8?'Detenida':'Operando'};
}
export class SimulationSession{
  constructor(){this.results={};this.prefix={};this.elapsed=0;this.running=false;this.speed=1;this.fraction=0;this.lastTime=null;this.origin=null;}
  get duration(){return Object.values(this.results)[0]?.config.duration_s??0;}
  load(results,origin){
    if(!Object.keys(results).length)throw Error('No hay resultados para visualizar.');
    this.results=results;this.origin=origin;this.prefix=Object.fromEntries(Object.entries(results).map(([s,r])=>[s,cumulativeIAE(r)]));this.reset();
  }
  reset(){this.elapsed=0;this.running=false;this.fraction=0;this.lastTime=null;}
  play(now){if(!this.duration)throw Error('Primero aplica un escenario.');if(this.running)return;if(this.elapsed===this.duration)this.elapsed=0;this.running=true;this.lastTime=now;this.fraction=0;}
  pause(){this.running=false;this.lastTime=null;}
  seek(value){if(!Number.isFinite(Number(value)))throw Error('Tiempo inválido.');this.pause();this.elapsed=Math.max(0,Math.min(this.duration,Math.floor(Number(value))));this.fraction=0;}
  step(){this.seek(this.elapsed+1);}
  setSpeed(value){if(![1,5,10,20].includes(Number(value)))throw Error('Velocidad no admitida.');this.speed=Number(value);this.fraction=0;this.lastTime=null;}
  tick(now){
    if(!this.running)return false;
    if(this.lastTime===null){this.lastTime=now;return false;}
    this.fraction+=Math.max(0,now-this.lastTime)*this.speed/1000;this.lastTime=now;
    const count=Math.floor(this.fraction);if(!count)return false;this.fraction-=count;
    this.elapsed=Math.min(this.duration,this.elapsed+count);if(this.elapsed===this.duration)this.pause();return true;
  }
}
