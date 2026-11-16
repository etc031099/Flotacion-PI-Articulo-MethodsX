import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const root=resolve(import.meta.dirname,'..'),dist=resolve(root,'dist');
test('Vercel build copies only portable public assets and local module imports resolve',async()=>{
  await import('../scripts/build-static.mjs');
  const html=await readFile(resolve(dist,'index.html'),'utf8');assert.ok(html.includes('web/main.js'));
  for(const name of ['tmp','node_modules','tests','flotation','.git','.codex'])assert.ok(!(await readdir(dist)).includes(name));
  for(const name of await readdir(resolve(dist,'web'))){
    if(!name.endsWith('.js'))continue;
    const path=resolve(dist,'web',name),source=await readFile(path,'utf8');
    assert.ok(!/[A-Z]:[\\/]/.test(source));
    for(const match of source.matchAll(/(?:from\s*|new URL\()\s*['"](\.\.?\/[^'"]+)['"]/g))assert.ok((await stat(resolve(dirname(path),match[1]))).isFile());
  }
  for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){const target=match[1];if(/^(https?:|data:)/.test(target))continue;assert.ok((await stat(resolve(dist,target))).isFile());}
});
