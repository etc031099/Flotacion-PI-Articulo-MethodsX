import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {simulate} from '../web/core.js';
const [input,output,strategy='feedback']=process.argv.slice(2);
if(!input||!output){console.error('node scripts/simulate.mjs CONFIG RESULT [feedback|feedback_feedforward]');process.exit(1);}
const result=simulate(JSON.parse((await readFile(input,'utf8')).replace(/^\uFEFF/,'')),strategy);
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,iae_cm_s:result.iae_cm_s}));
