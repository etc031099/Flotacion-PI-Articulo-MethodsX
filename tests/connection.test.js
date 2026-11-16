import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PythonClient} from '../web/python-client.js';
import {simulate,verifyResult} from '../web/core.js';
import {validateDocument,validateExchange,makeExchange} from '../web/validation.js';
const schema=JSON.parse(readFileSync(new URL('../schemas/simulation-v1.schema.json',import.meta.url),'utf8'));
const config=JSON.parse(readFileSync(new URL('../configs/paper_identified.json',import.meta.url),'utf8'));
const ok=data=>({ok:true,json:async()=>data});
test('JSON validation rejects wrong versions, units, fields, nonfinite values and malformed rows',()=>{
  validateDocument(config,schema);const r=simulate(config);validateDocument(r,schema);
  for(const change of [c=>c.schema_version='2',c=>c.units.flow='m3/s',c=>c.unexpected=true,c=>c.feed_lpm=Infinity]){const c=structuredClone(config);change(c);assert.throws(()=>validateDocument(c,schema));}
  const broken=structuredClone(r);broken.series[0].qout_lpm=[45];assert.throws(()=>validateDocument(broken,schema));
});
test('Versioned result exchange roundtrips with declared provenance',()=>{
  const r=simulate(config);const envelope=makeExchange({feedback:r},'python');const loaded=validateExchange(envelope,schema,verifyResult);assert.equal(loaded.engine,'python');assert.equal(loaded.results.feedback,r);assert.throws(()=>validateExchange({...envelope,exchange_version:'2'},schema,verifyResult));
});
test('Comparison files cannot silently mix different scenarios or duplicate strategies',()=>{
  const a=simulate(config),c=structuredClone(config);c.feed_lpm=46;const b=simulate(c,'feedback_feedforward');assert.throws(()=>validateExchange(makeExchange({a,b},'python'),schema,verifyResult));assert.throws(()=>validateExchange({...makeExchange({a},'python'),results:[a,a]},schema,verifyResult));
});
test('Python never connects without an actual compatible health response',async()=>{
  let calls=0;const client=new PythonClient({fetcher:async()=>{calls++;return ok({status:'ok',engine:'python',schema_version:'1.0.0'});}});assert.equal(client.connected,false);await client.connect('http://127.0.0.1:8765');assert.equal(calls,1);assert.equal(client.connected,true);client.disconnect();assert.equal(client.connected,false);
});
test('Incompatible health, HTTP failure and remote targets do not connect',async()=>{
  const bad=new PythonClient({fetcher:async()=>ok({status:'ok',engine:'javascript',schema_version:'1.0.0'})});await assert.rejects(()=>bad.connect('http://localhost:8765'));assert.equal(bad.connected,false);
  const http=new PythonClient({fetcher:async()=>({ok:false,status:500})});await assert.rejects(()=>http.connect('http://localhost:8765'));assert.equal(http.connected,false);
  await assert.rejects(()=>bad.connect('https://example.org'));await assert.rejects(()=>bad.connect('http://localhost:8765/path'));
});
test('Python simulation displays the returned object and sends the existing scenario contract',async()=>{
  const returned=simulate(config),requests=[];
  const client=new PythonClient({fetcher:async(url,options)=>{requests.push({url,options});return ok(url.endsWith('/health')?{status:'ok',engine:'python',schema_version:'1.0.0'}:returned);}});
  await client.connect('http://localhost:8765');const result=await client.simulate(config,['feedback'],schema);assert.equal(result.feedback,returned);const body=JSON.parse(requests[1].options.body);assert.deepEqual(body.config,config);assert.equal(body.strategy,'feedback');assert.equal(requests[1].url,'http://localhost:8765/simulate');
});
test('API failure disconnects and rejects instead of falling back to JavaScript',async()=>{
  const client=new PythonClient({fetcher:async url=>{if(url.endsWith('/health'))return ok({status:'ok',engine:'python',schema_version:'1.0.0'});throw Error('network disconnected');}});await client.connect('http://localhost:8765');await assert.rejects(()=>client.simulate(config,['feedback'],schema),/Selecciona Navegador/);assert.equal(client.connected,false);
});
test('Wrong scenario, strategy and corrupt Python series are rejected',async()=>{
  for(const mutate of [r=>r.strategy='feedback_feedforward',r=>r.series[1].level_cm[0]+=1,r=>r.config.duration_s=10]){const r=simulate(config);mutate(r);const client=new PythonClient({fetcher:async url=>ok(url.endsWith('/health')?{status:'ok',engine:'python',schema_version:'1.0.0'}:r)});await client.connect('http://localhost:8765');await assert.rejects(()=>client.simulate(config,['feedback'],schema));assert.equal(client.connected,false);}
});
test('Disconnection while health is pending cannot reconnect using a stale response',async()=>{
  let finish;const client=new PythonClient({fetcher:()=>new Promise(resolve=>{finish=resolve;})});const pending=client.connect('http://localhost:8765');client.disconnect();finish(ok({status:'ok',engine:'python',schema_version:'1.0.0'}));await assert.rejects(()=>pending);assert.equal(client.connected,false);
});
test('A request timeout becomes an explicit connection error',async()=>{
  const client=new PythonClient({timeout:5,fetcher:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('timeout'),{name:'AbortError'}))))});await assert.rejects(()=>client.connect('http://localhost:8765'),/tiempo/);assert.equal(client.connected,false);
});
