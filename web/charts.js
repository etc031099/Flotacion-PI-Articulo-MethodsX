import {CELL_COLORS,sampleAt} from './session.js';

export function chartSpecifications(session,cell,activeStrategy){
  const available=Object.entries(session.results),color=CELL_COLORS[cell];
  const signal=(r,key,i=cell)=>r.series.map(row=>row[key][i]).concat(key==='level_cm'?r.final_level_cm[i]:key==='error_cm'?sampleAt(r,r.config.duration_s).error_cm[i]:r.series.at(-1)[key][i]);
  const lines=(key)=>available.map(([s,r])=>({name:s==='feedback'?'PI':'PI + FF',values:signal(r,key),color,dash:s==='feedback_feedforward'}));
  const current=session.results[activeStrategy]??available[0]?.[1];if(!current)return [];
  const duration=current.config.duration_s;
  const levels=[...lines('level_cm'),{name:'Consigna',values:signal(current,'setpoint_cm'),color:'#cbd0bf',dot:true}];
  const flows=available.flatMap(([s,r])=>[{name:`Entrada ${s==='feedback'?'PI':'PI+FF'}`,values:signal(r,'qin_lpm'),color:'#f9bb6b',dash:s==='feedback_feedforward'},{name:`Descarga ${s==='feedback'?'PI':'PI+FF'}`,values:signal(r,'qout_lpm'),color,dash:s==='feedback_feedforward'}]);
  const iae=available.map(([s])=>({name:s==='feedback'?'PI':'PI + FF',values:session.prefix[s].map(v=>v[cell]),color,dash:s==='feedback_feedforward'}));
  const bank=current.config.cells.flatMap((_,i)=>[{name:`C${i+1}`,values:signal(current,'level_cm',i),color:CELL_COLORS[i]},{name:`SP C${i+1}`,values:signal(current,'setpoint_cm',i),color:CELL_COLORS[i],dot:true}]);
  return [
    {title:`Nivel y consigna · C${cell+1}`,unit:'Nivel (cm)',lines:levels},
    {title:`Alimentación y descarga · C${cell+1}`,unit:'Caudal (L/min)',lines:flows},
    {title:`Orden de bomba P${cell+1}`,unit:'Orden (L/min)',lines:lines('command_lpm')},
    {title:`Error de nivel · C${cell+1}`,unit:'Error (cm)',lines:lines('error_cm')},
    {title:`IAE acumulado · C${cell+1}`,unit:'IAE (cm·s)',lines:iae,floor:0},
    {title:'Niveles de las tres celdas',unit:`Nivel (cm) · ${activeStrategy==='feedback'?'PI':'PI + FF'}`,lines:bank}
  ].map(spec=>({...spec,duration}));
}

// Keep the extrema of each pixel bucket; charts do not alter numerical samples or IAE.
export function decimate(values,end,buckets=600){
  const last=Math.min(end,values.length-1);if(last<0)return [];
  if(last<=buckets*2)return Array.from({length:last+1},(_,i)=>[i,values[i]]);
  const points=[[0,values[0]]],size=(last+1)/buckets;
  for(let b=0;b<buckets;b++){
    const start=Math.floor(b*size),stop=Math.min(last+1,Math.floor((b+1)*size));let low=start,high=start;
    for(let i=start+1;i<stop;i++){if(values[i]<values[low])low=i;if(values[i]>values[high])high=i;}
    for(const i of low<high?[low,high]:low>high?[high,low]:[low])points.push([i,values[i]]);
  }
  points.push([last,values[last]]);return points;
}

const label=n=>Math.abs(n)>=10000?n.toExponential(1):Math.abs(n)>=100?n.toFixed(0):Math.abs(n)>=10?n.toFixed(1):n.toFixed(2);
export class SignalChart{
  constructor(container){
    this.card=document.createElement('article');this.card.className='chart-card';
    this.card.innerHTML='<h3></h3><div class="chart-unit"></div><div class="chart-wrap"><canvas tabindex="0" role="img"></canvas><div class="chart-tooltip" role="status" hidden></div></div><div class="chart-legend"></div>';
    container.append(this.card);this.canvas=this.card.querySelector('canvas');this.tooltip=this.card.querySelector('.chart-tooltip');this.ctx=this.canvas.getContext('2d');this.elapsed=0;this.hover=null;this.visible=true;
    this.canvas.addEventListener('pointermove',e=>{const r=this.canvas.getBoundingClientRect();this.inspect(Math.round((e.clientX-r.left-45)/(r.width-58)*this.spec.duration));});
    this.canvas.addEventListener('pointerleave',()=>{this.hover=null;this.tooltip.hidden=true;this.draw();});
    this.canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();let n=this.hover??this.elapsed;if(e.key==='Home')n=0;else if(e.key==='End')n=this.elapsed;else n+=e.key==='ArrowRight'?1:-1;this.inspect(n);});
    this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(this.canvas);
    this.intersection=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;if(this.visible)this.draw();});this.intersection.observe(this.card);
  }
  setSpec(spec){
    this.spec=spec;this.hover=null;this.tooltip.hidden=true;this.card.querySelector('h3').textContent=spec.title;this.card.querySelector('.chart-unit').textContent=spec.unit;
    this.canvas.setAttribute('aria-label',`${spec.title}. ${spec.unit}. Eje horizontal: segundos. Usa flechas para consultar datos.`);
    const legend=this.card.querySelector('.chart-legend');legend.replaceChildren();
    for(const line of spec.lines){const span=document.createElement('span'),i=document.createElement('i');i.style.setProperty('--series-color',line.color);i.className=line.dot?'dotted':line.dash?'dashed':'';span.append(i,document.createTextNode(line.name));legend.append(span);}
    const values=spec.lines.flatMap(l=>l.values);let min=Infinity,max=-Infinity;
    for(const v of values){min=Math.min(min,v);max=Math.max(max,v);}const pad=Math.max((max-min)*.12,.1);this.range=[Math.max(spec.floor??-Infinity,min-pad),max+pad];this.draw();
  }
  update(elapsed){this.elapsed=elapsed;if(this.hover!==null)this.inspect(Math.min(this.hover,elapsed));else this.draw();}
  inspect(n){
    if(!this.spec)return;this.hover=Math.max(0,Math.min(this.elapsed,n));this.tooltip.hidden=false;
    this.tooltip.textContent=`t = ${this.hover} s\n`+this.spec.lines.map(l=>`${l.name}: ${label(l.values[this.hover])}`).join('\n');
    this.draw();
  }
  draw(){
    if(!this.spec||!this.visible||!this.ctx)return;
    const width=this.canvas.clientWidth,height=this.canvas.clientHeight;if(width<20||height<20)return;
    const dpr=Math.min(globalThis.devicePixelRatio||1,2);
    if(this.canvas.width!==Math.round(width*dpr)||this.canvas.height!==Math.round(height*dpr)){this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);}
    const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    const left=45,top=10,bottom=height-27,right=width-13,[min,max]=this.range;
    const x=n=>left+n/this.spec.duration*(right-left),y=v=>bottom-(v-min)/(max-min)*(bottom-top);
    ctx.font='10px Segoe UI, sans-serif';ctx.lineWidth=1;ctx.textAlign='right';ctx.textBaseline='middle';
    for(let i=0;i<5;i++){const value=min+(max-min)*i/4,py=y(value);ctx.strokeStyle='#253448';ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(right,py);ctx.stroke();ctx.fillStyle='#8198b0';ctx.fillText(label(value),left-7,py);}
    ctx.setLineDash([]);ctx.textBaseline='top';
    for(let i=0;i<4;i++){const n=Math.round(this.spec.duration*i/3);ctx.textAlign=i===0?'left':i===3?'right':'center';ctx.fillStyle='#8198b0';ctx.fillText(String(n),x(n),bottom+8);}
    ctx.fillStyle='#9cafc1';ctx.textAlign='right';ctx.fillText('s',right,bottom+17);
    ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
    for(const line of this.spec.lines){ctx.beginPath();ctx.strokeStyle=line.color;ctx.lineWidth=line.dot?1:1.7;ctx.setLineDash(line.dot?[2,4]:line.dash?[7,4]:[]);
      const points=decimate(line.values,this.elapsed,Math.max(60,Math.floor(right-left)));
      points.forEach(([n,v],i)=>{if(i===0)ctx.moveTo(x(n),y(v));else ctx.lineTo(x(n),y(v));});ctx.stroke();
    }
    ctx.setLineDash([3,3]);ctx.strokeStyle='#c6d5e644';ctx.beginPath();ctx.moveTo(x(this.elapsed),top);ctx.lineTo(x(this.elapsed),bottom);ctx.stroke();
    if(this.hover!==null){ctx.strokeStyle='#e9efff99';ctx.beginPath();ctx.moveTo(x(this.hover),top);ctx.lineTo(x(this.hover),bottom);ctx.stroke();for(const line of this.spec.lines){ctx.fillStyle=line.color;ctx.beginPath();ctx.arc(x(this.hover),y(line.values[this.hover]),3,0,Math.PI*2);ctx.fill();}}
    ctx.restore();this.canvas.dataset.renderTime=String(this.elapsed);
  }
}
