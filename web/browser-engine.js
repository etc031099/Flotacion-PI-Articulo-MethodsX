export class BrowserEngine{
  constructor(){this.serial=0;this.pending=new Map();this.worker=null;}
  simulate(config,strategies){
    if(!this.worker){
      this.worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
      this.worker.onmessage=({data})=>{const p=this.pending.get(data.id);if(!p)return;this.pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.results);};
      this.worker.onerror=()=>{for(const p of this.pending.values())p.reject(Error('No se pudo ejecutar el motor del navegador. Comprueba el servidor HTTP.'));this.pending.clear();this.worker.terminate();this.worker=null;};
    }
    return new Promise((resolve,reject)=>{const id=++this.serial;this.pending.set(id,{resolve,reject});this.worker.postMessage({id,config,strategies});});
  }
}
