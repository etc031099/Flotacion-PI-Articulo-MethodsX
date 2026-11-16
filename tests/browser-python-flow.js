// Real network only: no page.route(), intercepted responses, or mocked Python.
async page => {
  const checks=[],responses=[],phase=page.url().startsWith('https://')?'fase4':'fase3';let permissionSession;
  const userAgent=await page.evaluate(()=>navigator.userAgent),browserTag=userAgent.includes('Edg/')?'edge':'chrome';
  const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  const observe=response=>{if(response.url().startsWith('http://127.0.0.1:8765/'))responses.push(response);};
  page.on('response',observe);
  try{
    await page.setViewportSize({width:1440,height:1100});await page.reload();
    if(phase==='fase4'){
      // Explicit test-profile permission, equivalent to Allow for this exact site.
      // Keep the CDP session alive: overrides are reset when it detaches.
      permissionSession=page.__flotaLoopbackPermissionSession??=await page.context().newCDPSession(page);
      const {targetInfo}=await permissionSession.send('Target.getTargetInfo');
      await permissionSession.send('Browser.setPermission',{permission:{name:'loopback-network'},setting:'granted',origin:new URL(page.url()).origin,browserContextId:targetInfo.browserContextId});
      check(await page.evaluate(async()=>(await navigator.permissions.query({name:'loopback-network'})).state)==='granted','Permiso loopback explícito en perfil aislado; CORS sigue activo');
    }
    await page.waitForFunction(()=>!document.getElementById('play').disabled);
    check(!(await page.locator('#connectionState').textContent()).includes('confirmó'),'No conexión Python ficticia al abrir');
    await page.locator('#connect').click();
    await page.waitForFunction(()=>document.getElementById('connectionState').textContent.includes('confirmó'));
    const health=responses.find(r=>r.url().endsWith('/health'));
    check(Boolean(health)&&health.status()===200,'GET /health real recibido');
    const healthData=await health.json();check(healthData.engine==='python'&&healthData.api_version==='1.0.0','Versiones del servidor Python verificadas');
    await page.locator('#engine').selectOption('python');await page.locator('#apply').click();
    await page.waitForFunction(()=>document.getElementById('activeEngine').textContent.includes('Python · API local'));
    const first=responses.filter(r=>r.url().endsWith('/simulate'));check(first.length===2,'Dos POST /simulate reales para comparar estrategias');
    const answers=await Promise.all(first.map(r=>r.json()));
    for(let i=0;i<first.length;i++){
      const headers=await first[i].allHeaders();check(headers['x-flotalab-engine']==='python'&&Boolean(headers['x-flotalab-request-id']),`Procedencia HTTP Python y request ID ${i+1}`);
      check(headers['access-control-allow-origin']===new URL(page.url()).origin,'Respuesta CORS real para el origen abierto');
    }
    for(const result of answers){
      await page.locator('#viewStrategy').selectOption(result.strategy);
      for(const t of [0,60,420,900]){
        await page.locator('#time').evaluate((input,n)=>{input.value=String(n);input.dispatchEvent(new Event('input',{bubbles:true}));},t);
        const expected=t===900?result.final_level_cm:result.series[t].level_cm;
        const levels=await page.locator('.process-cell').evaluateAll(cards=>cards.map(c=>Number(c.dataset.level)));
        check(levels.every((v,i)=>Math.abs(v-expected[i])<1e-10),`${result.strategy}: tres niveles visualizados iguales a la respuesta HTTP a t=${t}`);
      }
      const table=await page.locator('#comparison').textContent();check(result.iae_cm_s.every(v=>table.includes(v.toFixed(3))),`IAE visual de ${result.strategy} coincide con Python HTTP`);
    }
    await page.locator('#graficas').scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].every(c=>c.dataset.renderTime==='900'));
    check(await page.locator('canvas').count()===6,'Las seis gráficas representan los datos de API Python');
    await page.screenshot({path:`output/playwright/${phase}-python-api-graficas-${browserTag}.png`});
    await page.locator('#feed').fill('50');await page.locator('#sp-0').fill('31');await page.locator('#apply').click();
    await page.waitForFunction(()=>!document.getElementById('apply').disabled&&document.getElementById('status').textContent.includes('Cálculo completado'));
    const second=responses.filter(r=>r.url().endsWith('/simulate')).slice(2);
    check(second.length===2,'Nueva configuración enviada realmente a Python');
    check(second.every(r=>r.request().postDataJSON().config.feed_lpm===50&&r.request().postDataJSON().config.cells[0].setpoint_cm===31),'Parámetros modificados presentes en el cuerpo HTTP');
    await page.locator('#goEnd').click();
    const downloadResults=page.waitForEvent('download');await page.locator('#exportResult').click();await (await downloadResults).saveAs(`output/${phase}/resultados-web-python-api.json`);
    const downloadConfig=page.waitForEvent('download');await page.locator('#exportConfig').click();await (await downloadConfig).saveAs(`output/${phase}/escenario-web-real.json`);
    check((await page.locator('#activeEngine').textContent()).includes('Python · API local'),'Motor real sigue identificado al exportar');
    await page.locator('#python').scrollIntoViewIfNeeded();await page.screenshot({path:`output/playwright/${phase}-python-conexion-real-${browserTag}.png`});
    const requestIds=await Promise.all([...first,...second].map(async r=>(await r.allHeaders())['x-flotalab-request-id']));
    return {passed:checks.length,failed:0,checks,browser:browserTag,userAgent,browserVersion:page.context().browser().version(),health:healthData,requestIds,first_iae:answers.map(r=>({strategy:r.strategy,iae_cm_s:r.iae_cm_s}))};
  }finally{page.off('response',observe);/* Isolated permission session ends when this test browser closes. */}
}
