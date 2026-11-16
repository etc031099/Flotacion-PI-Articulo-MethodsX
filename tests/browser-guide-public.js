// Real production requests and browser errors; no response interception.
async page => {
  const checks=[],errors=[],failed=[];
  const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  const onError=e=>errors.push(e.message),onConsole=m=>{if(m.type()==='error')errors.push(m.text());},onFailed=r=>failed.push(r.url());
  page.on('pageerror',onError);page.on('console',onConsole);page.on('requestfailed',onFailed);
  try{
    const response=await page.reload();await page.waitForFunction(()=>!document.querySelector('#play').disabled);
    check(response.status()===200,'Documento público HTTP 200');
    check(page.url().startsWith('https://flotacion-pi-methodsx.vercel.app/'),'Origen HTTPS de producción real');
    check(await page.locator('.process-cell').count()===3,'Banco de tres celdas disponible');
    const paths=['web/main.js','web/app.js','web/core.js','web/worker.js','web/python-client.js','web/style.css','web/icon.svg','configs/paper_identified.json','schemas/simulation-v1.schema.json'];
    const assets=[];
    for(const path of paths){const asset=await page.request.get(new URL(path,page.url()).href);assets.push({path,status:asset.status()});check(asset.status()===200,`Recurso público 200: ${path}`);}
    for(const path of ['flotation/core.py','servidor.py','.env','configuracion_servidor.json']){const forbidden=await page.request.get(new URL(path,page.url()).href);check(forbidden.status()===404,`Archivo fuera del bundle: ${path}`);}
    check((await page.locator('.python-guide').textContent()).includes('Python 3.11'),'Guía de requisitos y conexión publicada');
    check(errors.length===0,'Sin errores JavaScript ni consola durante carga válida');check(failed.length===0,'Sin fallos de recursos durante carga válida');
    // Downloads intentionally cancel their navigation (net::ERR_ABORTED); audit them via Download.failure.
    page.off('requestfailed',onFailed);
    const link=page.locator('.python-guide a').first();check((await link.getAttribute('href')).includes('/releases/download/v1.0.1/Python_Flotacion_v1.0.1.zip'),'Descarga enlazada a entrega definitiva');
    const downloadPromise=page.waitForEvent('download');await link.click();const download=await downloadPromise;
    await download.saveAs('output/fase6/Python_Flotacion-descargado-web.zip');check((await download.failure())===null,'ZIP descargado realmente desde el enlace público');
    await page.setViewportSize({width:1440,height:1100});await page.locator('#python').scrollIntoViewIfNeeded();
    const browser=await page.evaluate(()=>navigator.userAgent.includes('Edg/')?'edge':'chrome');
    await page.screenshot({path:`output/playwright/fase6-guia-publica-${browser}.png`});
    return {passed:checks.length,failed:0,url:page.url(),checks,assets,errors,failedRequests:failed,browser};
  }finally{page.off('pageerror',onError);page.off('console',onConsole);page.off('requestfailed',onFailed);}
}
