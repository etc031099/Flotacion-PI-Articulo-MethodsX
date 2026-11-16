// Tests the documented alternate-port flow; never stops someone else's API on 8765.
async page => {
  const responses=[];const observe=r=>{if(r.url().startsWith('http://127.0.0.1:8766/'))responses.push(r);};page.on('response',observe);
  const ready=()=>page.waitForFunction(()=>!document.querySelector('#apply').disabled&&!document.querySelector('#play').disabled);
  try{
    await page.locator('#engine').selectOption('javascript');await page.locator('#restore').click();await ready();
    await page.locator('#mode').selectOption('compare');await page.locator('#feed').fill('50');await page.locator('#sp-0').fill('31');await page.locator('#apply').click();await ready();
    let download=page.waitForEvent('download');await page.locator('#exportResult').click();await(await download).saveAs('output/fase6/e7-javascript.json');
    download=page.waitForEvent('download');await page.locator('#exportConfig').click();await(await download).saveAs('output/fase6/e7-escenario.json');
    const cdp=page.__flotaLoopbackPermissionSession??=await page.context().newCDPSession(page);
    const {targetInfo}=await cdp.send('Target.getTargetInfo');
    await cdp.send('Browser.setPermission',{permission:{name:'loopback-network'},setting:'granted',origin:new URL(page.url()).origin,browserContextId:targetInfo.browserContextId});
    await page.locator('#pythonUrl').fill('http://127.0.0.1:8766');await page.locator('#connect').click();
    await page.waitForFunction(()=>document.querySelector('#connectionState').textContent.includes('confirmó'));
    await page.locator('#engine').selectOption('python');await page.locator('#apply').click();await ready();
    if(!(await page.locator('#activeEngine').textContent()).includes('Python · API local'))throw Error('No se usó Python');
    const posts=responses.filter(r=>r.url().endsWith('/simulate'));if(posts.length!==2||posts.some(r=>r.status()!==200))throw Error('No se recibieron las dos respuestas Python');
    download=page.waitForEvent('download');await page.locator('#exportResult').click();await(await download).saveAs('output/fase6/e7-python.json');
    await page.locator('#goEnd').click();await page.locator('#python').scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/fase6-python-conectado.png'});
    const config=posts[0].request().postDataJSON().config;
    await page.locator('#feed').fill('51');await page.locator('#apply').click();await ready();
    if(responses.filter(r=>r.url().endsWith('/simulate')).length!==4)throw Error('Cambio de parámetro no pidió cálculo');
    await page.locator('#feed').fill('50');await page.locator('#apply').click();await ready();
    return {status:'PASS',experiment:7,url:page.url(),port:8766,browser:page.context().browser().version(),permission:'granted via CDP in isolated profile',health:await responses.find(r=>r.url().endsWith('/health')).json(),post_count:responses.filter(r=>r.url().endsWith('/simulate')).length,request_ids:await Promise.all(posts.map(async r=>(await r.allHeaders())['x-flotalab-request-id'])),config};
  }finally{page.off('response',observe);}
}
