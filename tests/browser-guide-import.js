async page=>{
  const download=page.waitForEvent('download');
  await page.locator('#import').setInputFiles('output/fase6/resultado_python_consola.json');
  await page.waitForFunction(()=>document.querySelector('#activeEngine').textContent.includes('Python · archivo'));
  await page.locator('#goEnd').click();await page.locator('#exportResult').click();
  await(await download).saveAs('output/fase6/resultado_python_reimportado.json');
  return {status:'PASS',origin:await page.locator('#activeEngine').textContent(),iae:await page.locator('#comparison').innerText()};
}
