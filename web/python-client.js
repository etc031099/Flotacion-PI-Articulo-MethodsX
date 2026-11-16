import {VERSION,verifyResult} from './core.js';
import {validateDocument,sameDocument} from './validation.js';

export async function loopbackAccessInfo({nav=globalThis.navigator,location=globalThis.location,secure=globalThis.isSecureContext}={}){
  const localPage=['localhost','127.0.0.1','[::1]'].includes(location?.hostname);
  const info={localPage,secure:secure===true,permission:'unavailable',permissionName:null};
  if(location&&!localPage&&secure===false)throw Error('La web pública debe abrirse por HTTPS para conectar con Python local. Usa archivos como alternativa.');
  if(localPage){info.permission='same-address-space';return info;}
  if(!nav?.permissions?.query)return info;
  for(const name of ['loopback-network']){
    try{const permission=await nav.permissions.query({name});info.permission=permission.state;info.permissionName=name;break;}catch{/* Unsupported permissions are not inferred as granted. */}
  }
  if(info.permission==='denied')throw Error('El navegador denegó el acceso a Python local. Revisa el permiso de red local/loopback de este sitio o utiliza archivos; no desactives la seguridad.');
  return info;
}

export function loopbackFetchOptions(RequestType=globalThis.Request){
  return RequestType?.prototype&&'targetAddressSpace' in RequestType.prototype?{targetAddressSpace:'loopback'}:{};
}

export class PythonClient{
  constructor({fetcher=globalThis.fetch,timeout=10000}={}){this.fetcher=fetcher;this.timeout=timeout;this.connected=false;this.base=null;this.message='Sin conexión';this.generation=0;this.health=null;this.accessInfo=null;}
  disconnect(){this.generation++;this.connected=false;this.base=null;this.message='Desconectado';}
  async request(base,path,options={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeout);
    const {verifyPythonOrigin=false,...requestOptions}=options;
    try{const response=await this.fetcher.call(globalThis,base+path,{...requestOptions,...loopbackFetchOptions(),signal:controller.signal,cache:'no-store',credentials:'omit'});
      if(!response.ok){let detail='';try{const error=await response.json();if(typeof error.detail==='string')detail=': '+error.detail;}catch{/* Keep HTTP status. */}throw Error(`Python respondió HTTP ${response.status}${detail}`);}
      if(verifyPythonOrigin&&(response.headers?.get('X-FlotaLab-Engine')!=='python'||response.headers?.get('X-FlotaLab-API-Version')!=='1.0.0'||response.headers?.get('X-FlotaLab-Model-Version')!==VERSION||!response.headers?.get('X-FlotaLab-Request-ID')))throw Error('La respuesta no incluye metadatos compatibles de ejecución Python.');
      return await response.json();}
    catch(e){if(e.name==='AbortError')throw Error('Python no respondió dentro del tiempo permitido.');if(e instanceof TypeError)throw Error('No se pudo acceder a Python. Comprueba que el programa esté iniciado, el origen autorizado y el permiso de red local del navegador. Puedes usar archivos.');if(e instanceof SyntaxError)throw Error('El servicio local no devolvió JSON válido.');throw e;}
    finally{clearTimeout(timer);}
  }
  async connect(url){
    const parsed=new URL(url);
    if(!['http:','https:'].includes(parsed.protocol)||!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw Error('Usa una dirección local como http://127.0.0.1:8765, sin rutas ni credenciales.');
    const token=++this.generation,base=parsed.origin;this.connected=false;this.message='Consultando /health…';
    try{if(globalThis.location)this.accessInfo=await loopbackAccessInfo();const health=await this.request(base,'/health');if(token!==this.generation)throw Error('Conexión cancelada.');
      if(health.status!=='ok'||health.engine!=='python'||health.schema_version!==VERSION)throw Error('La respuesta /health no identifica un motor Python compatible.');
      if(health.api_version&&(health.api_version!=='1.0.0'||health.model_version!==VERSION))throw Error('La API o el modelo Python no son compatibles.');
      this.health=health;this.base=base;this.connected=true;this.message='Python confirmó /health';return health;
    }catch(e){if(token===this.generation){this.connected=false;this.message=e.message;}throw e;}
  }
  async ping(){
    if(!this.connected||!this.base)throw Error('Python no está conectado.');const token=this.generation;
    try{const health=await this.request(this.base,'/health');if(token!==this.generation)throw Error('Conexión cancelada.');if(health.status!=='ok'||health.engine!=='python'||health.schema_version!==VERSION)throw Error('El servicio Python ya no es compatible.');return health;}
    catch(e){if(token===this.generation){this.connected=false;this.generation++;this.message=e.message;}throw e;}
  }
  async simulate(config,strategies,schema){
    if(!this.connected||!this.base)throw Error('Conecta Python antes de ejecutar con este motor.');
    const token=this.generation,base=this.base,results={};
    try{
      for(const strategy of strategies){
        const result=await this.request(base,'/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schema_version:VERSION,config,strategy}),verifyPythonOrigin:Boolean(this.health?.api_version)});
        if(token!==this.generation)throw Error('Python se desconectó durante el cálculo.');
        validateDocument(result,schema);if(result.kind!=='result'||result.strategy!==strategy||!sameDocument(result.config,config))throw Error('Python respondió con otro escenario o estrategia.');
        verifyResult(result);results[strategy]=result;
      }
      return results; // These are the returned Python objects, never substituted JS results.
    }catch(e){if(token===this.generation){this.connected=false;this.message=e.message;}throw Error(`No se pudo simular con Python: ${e.message}. Selecciona Navegador o usa archivos.`);}
  }
}
