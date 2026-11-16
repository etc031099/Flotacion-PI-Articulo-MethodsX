import {simulate} from './core.js';
self.onmessage=({data})=>{
  try{self.postMessage({id:data.id,results:Object.fromEntries(data.strategies.map(s=>[s,simulate(data.config,s)]))});}
  catch(e){self.postMessage({id:data.id,error:e.message});}
};
