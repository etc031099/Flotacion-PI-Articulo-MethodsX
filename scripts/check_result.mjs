import {readFile} from 'node:fs/promises';
import {verifyResult} from '../web/core.js';
import {validateExchange} from '../web/validation.js';
const r=JSON.parse(await readFile(process.argv[2],'utf8'));
if(r.kind==='simulation_exchange'){
  const schema=JSON.parse(await readFile(new URL('../schemas/simulation-v1.schema.json',import.meta.url),'utf8'));
  validateExchange(r,schema,verifyResult);
}else verifyResult(r);
