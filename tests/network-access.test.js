import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loopbackAccessInfo,loopbackFetchOptions,PythonClient} from '../web/python-client.js';
import {readFileSync} from 'node:fs';
import {simulate} from '../web/core.js';
const config=JSON.parse(readFileSync(new URL('../configs/paper_identified.json',import.meta.url),'utf8'));
const schema=JSON.parse(readFileSync(new URL('../schemas/simulation-v1.schema.json',import.meta.url),'utf8'));
test('Loopback page does not mistake optional LNA feature absence for failed connectivity',async()=>{
  const info=await loopbackAccessInfo({nav:{},location:{hostname:'127.0.0.1'},secure:true});assert.equal(info.localPage,true);assert.equal(info.permission,'same-address-space');
});
test('Public insecure context and explicitly denied permission are explained safely',async()=>{
  await assert.rejects(()=>loopbackAccessInfo({nav:{},location:{hostname:'public.example'},secure:false}),/HTTPS/);
  await assert.rejects(()=>loopbackAccessInfo({nav:{permissions:{query:async()=>({state:'denied'})}},location:{hostname:'public.example'},secure:true}),/no desactives/);
});
test('Unsupported granular permission is not granted and never queries the legacy alias',async()=>{
  const names=[];const info=await loopbackAccessInfo({nav:{permissions:{query:async({name})=>{names.push(name);throw Error('unsupported');}}},location:{hostname:'public.example'},secure:true});assert.deepEqual(names,['loopback-network']);assert.equal(info.permission,'unavailable');
  const unavailable=await loopbackAccessInfo({nav:{},location:{hostname:'public.example'},secure:true});assert.equal(unavailable.permission,'unavailable');
});

test('Loopback destination hint is supplied only when Request supports it',()=>{
  class Supported{};Object.defineProperty(Supported.prototype,'targetAddressSpace',{get:()=> 'public'});
  assert.deepEqual(loopbackFetchOptions(Supported),{targetAddressSpace:'loopback'});
  assert.deepEqual(loopbackFetchOptions(class Unsupported{}),{});
  assert.deepEqual(loopbackFetchOptions(null),{});
});
test('Versioned API metadata is required for simulation and cookies are omitted',async()=>{
  const response=simulate(config),observed=[];
  const headers=new Headers({'X-FlotaLab-Engine':'python','X-FlotaLab-API-Version':'1.0.0','X-FlotaLab-Model-Version':'1.0.0','X-FlotaLab-Request-ID':'real-identifier'});
  const client=new PythonClient({fetcher:async(url,options)=>{observed.push(options);return {ok:true,headers,json:async()=>url.endsWith('/health')?{status:'ok',engine:'python',schema_version:'1.0.0',model_version:'1.0.0',api_version:'1.0.0'}:response};}});
  await client.connect('http://127.0.0.1:8765');assert.equal((await client.simulate(config,['feedback'],schema)).feedback,response);assert.ok(observed.every(o=>o.credentials==='omit'));
  headers.set('X-FlotaLab-Engine','javascript');await assert.rejects(()=>client.simulate(config,['feedback'],schema),/metadatos/);assert.equal(client.connected,false);
});
test('HTTP validation errors preserve the API detail for the user',async()=>{
  const client=new PythonClient({fetcher:async()=>({ok:false,status:422,json:async()=>({detail:'Duración excesiva; máximo 7200 s'})})});await assert.rejects(()=>client.connect('http://localhost:8765'),/Duración excesiva/);
});
test('Health heartbeat detects real transport failure without changing mathematical engine',async()=>{
  let online=true;const client=new PythonClient({fetcher:async()=>{if(!online)throw new TypeError('Failed to fetch');return {ok:true,json:async()=>({status:'ok',engine:'python',schema_version:'1.0.0'})};}});await client.connect('http://localhost:8765');await client.ping();online=false;await assert.rejects(()=>client.ping(),/programa esté iniciado/);assert.equal(client.connected,false);
});
test('Native fetch receives its global receiver, as required by browser Web IDL',async()=>{
  const client=new PythonClient({fetcher:async function(){assert.equal(this,globalThis);return {ok:true,json:async()=>({status:'ok',engine:'python',schema_version:'1.0.0'})};}});await client.connect('http://localhost:8765');assert.equal(client.connected,true);
});
