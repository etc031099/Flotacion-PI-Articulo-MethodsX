async page => {
  const phase=page.url().startsWith('https://')?'fase4':'fase3';
  await page.locator('#import').setInputFiles(`output/${phase}/resultados-cli-reales.json`);
  await page.waitForFunction(()=>document.getElementById('activeEngine').textContent.includes('Python · archivo'));
  await page.locator('#goEnd').click();
  await page.locator('#graficas').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].every(c=>c.dataset.renderTime==='900'));
  const origin=await page.locator('#activeEngine').textContent();
  if(!origin.includes('archivo (declarado)'))throw Error('Origen de archivo incorrecto');
  if(!(await page.locator('#status').textContent()).includes('verificados'))throw Error('Archivo Python no validado');
  await page.screenshot({path:`output/playwright/${phase}-python-archivo-real.png`});
  return {passed:3,failed:0,checks:['Escenario exportado por HTML calculado mediante CLI Python','Resultado CLI importado y verificado por HTML','Gráficas y origen de archivo Python visibles'],origin,comparison:await page.locator('#comparison').textContent()};
}
