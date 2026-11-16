/** JSON Schema 2020-12 subset used by the checked-in contracts; no remote references. */
const equal=(a,b)=>{
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));
};
export const sameDocument=equal;
export function validateDocument(value,schema){
  function check(v,s,path){
    const fail=message=>{throw Error(`${path}: ${message}`);};
    if(s.$ref){
      if(!s.$ref.startsWith('#/'))fail('referencia externa no permitida');
      const target=s.$ref.slice(2).split('/').reduce((o,k)=>o?.[k],schema);
      if(!target)fail('referencia desconocida');return check(v,target,path);
    }
    if(s.oneOf){let matches=0;for(const branch of s.oneOf){try{check(v,branch,path);matches++;}catch{/* other branch */}}if(matches!==1)fail('versión o estructura JSON incompatible');}
    if(Object.hasOwn(s,'const')&&!equal(v,s.const))fail('valor o unidades incompatibles');
    if(s.enum&&!s.enum.some(x=>equal(v,x)))fail('opción no reconocida');
    if(s.type){
      const ok={object:v!==null&&typeof v==='object'&&!Array.isArray(v),array:Array.isArray(v),number:typeof v==='number'&&Number.isFinite(v),integer:Number.isInteger(v),string:typeof v==='string',boolean:typeof v==='boolean'}[s.type];
      if(!ok)fail(`se esperaba ${s.type}`);
    }
    if(typeof v==='number'){
      if(!Number.isFinite(v))fail('valor no finito');
      for(const [key,ok] of [['minimum',v>=s.minimum],['maximum',v<=s.maximum],['exclusiveMinimum',v>s.exclusiveMinimum],['exclusiveMaximum',v<s.exclusiveMaximum]])if(Object.hasOwn(s,key)&&!ok)fail('fuera de rango');
    }
    if(Array.isArray(v)){
      if((s.minItems!==undefined&&v.length<s.minItems)||(s.maxItems!==undefined&&v.length>s.maxItems))fail('longitud incorrecta');
      if(s.items)v.forEach((x,i)=>check(x,s.items,`${path}[${i}]`));
    }else if(v!==null&&typeof v==='object'){
      for(const key of s.required??[])if(!Object.hasOwn(v,key))fail(`falta ${key}`);
      for(const [key,item] of Object.entries(v)){
        if(s.additionalProperties===false&&!Object.hasOwn(s.properties??{},key))fail(`campo no permitido: ${key}`);
        if(s.properties?.[key])check(item,s.properties[key],`${path}.${key}`);
      }
    }
    if(s.if){let applies=true;try{check(v,s.if,path);}catch{applies=false;}if(applies&&s.then)check(v,s.then,path);}
  }
  check(value,schema,'documento');return value;
}

export function validateExchange(value,schema,verify){
  if(value?.kind!=='simulation_exchange'||value.exchange_version!=='1.0.0'||!['javascript','python'].includes(value.engine))throw Error('Formato de intercambio desconocido.');
  if(Object.keys(value).some(k=>!['kind','exchange_version','engine','results'].includes(k)))throw Error('Metadatos de intercambio no reconocidos.');
  if(!Array.isArray(value.results)||value.results.length<1||value.results.length>2)throw Error('El intercambio requiere uno o dos resultados.');
  const results={};let reference;
  for(const r of value.results){
    validateDocument(r,schema);if(r.kind!=='result')throw Error('Se esperaba un resultado.');verify(r);
    if(results[r.strategy])throw Error('Estrategia duplicada.');
    if(reference&&!equal(reference,r.config))throw Error('Las estrategias deben compartir exactamente el mismo escenario.');
    reference=r.config;results[r.strategy]=r;
  }
  return {results,engine:value.engine};
}

export function makeExchange(results,engine){
  if(!['javascript','python'].includes(engine))throw Error('Motor de origen no conocido.');
  return {kind:'simulation_exchange',exchange_version:'1.0.0',engine,results:Object.values(results)};
}
