import {simc} from './core.js';
export function renderEquations(container){
  const cards=[
    ['01 / INVENTARIO','Balance de volumen','V = A·h / 1000\ndV/dt = (Qin − Qout − Qrebose)/60','V en L, A en cm², h en cm y Q en L/min. La conversión 1000 cm³/L y 60 s/min evita mezclar unidades.','Se usa en cada celda. Mayor área significa menor variación de nivel ante el mismo desequilibrio. El rebose se contabiliza, no se elimina líquido silenciosamente.','Balance de ingeniería añadido; geometría, p. 2 y Figura 2.'],
    ['02 / RESPUESTA','Caudal, nivel y retardo','dh/dt = 1000(Qin − Qout)/(60A)\nGp(s) = −1000·e^(−θs)/(60A·s)','Gp relaciona incrementos de descarga ordenada en L/min con nivel en cm. θ es el retardo en segundos. Válido sin vaciado ni rebose.','Colas de 7, 6 y 3 muestras retienen las órdenes antes de aplicarlas. Más retardo pospone la corrección y puede favorecer oscilaciones.','Balance propio y retardos de Tabla 2, p. 12.'],
    ['03 / IDENTIFICACIÓN','Modelo del artículo','Gp(s) = k′·e^(−θs)/s\nk′ = −0.001018 cm/s/(L/min)','El integrador identificado usa una ganancia negativa común a las tres celdas. No añade el polo de primer orden de la Ec. (4).','Se realiza con área equivalente Aeq=1000/(60|k′|). Mayor |k′| aumenta la rapidez del nivel. La extensión de igual ganancia a Qin es un supuesto propio.','Tabla 2, p. 12; estimación k′=Δy/(Δt·Δu), Ec. (5), p. 10.'],
    ['04 / TIEMPO DISCRETO','Integración a un segundo','h[n+1] = h[n] + Δt·1000\n          ·(Qin[n]−Qout[n]−Qrebose[n])/(60A)','Δt=1 s. h[n] corresponde al inicio del intervalo; h[n+1], al estado siguiente. Las señales se retienen durante el paso.','La reproducción ×1/×5/×10/×20 revela muestras ya calculadas; no cambia Δt. qout real de C1 alimenta C2 y qout real de C2 alimenta C3.','Discretización propia. Muestreo experimental de 1 s, p. 13.'],
    ['05 / FEEDBACK','Controlador PI','e[n] = r[n] − h[n]\nI[n] = I[n−1] + (Kc/τi)·e[n]·Δt\nu = clip(Q0 + Kc·e + I + f)','e y r en cm; Kc en (L/min)/cm; τi en s. I y f son contribuciones de caudal en L/min. Q0 es el bias inicial.','El error corrige la orden. Anti-windup condicional congela incrementos que agravan saturación. Un τi menor acumula corrección más rápido; mayor |Kc| aumenta la reacción.','PI: Ecs. (1) y (7), pp. 2 y 12. Bias y anti-windup: implementación propia.'],
    ['06 / PERTURBACIONES','Acción feedforward','f[n] = Kff·(Qin[n] − Qin[n−1])\nVariante: f[n] = Kff·(Qin[n] − Q0)','Kff es adimensional. f en L/min. Ganancias finales [0.8,0.8,1.0]. Se mide la alimentación de cada celda.','La forma literal produce un pulso ante un escalón. La segunda expresión acumula incrementos: Variante experimental de implementación propia. Más Kff añade más compensación; no garantiza menor IAE.','Ecs. (7)–(8), p. 12; la acumulación no se atribuye al artículo.'],
    ['07 / DESEMPEÑO','Integral absoluta del error','IAEi(T) = ∫₀ᵀ |ei(t)| dt\nIAEi[n] = Σ(m=0..n−1) |ei[m]|·Δt','IAE en cm·s, siempre no negativo. No es suma de cuadrados. Se integra sólo hasta el instante visualizado.','Se calculan prefijos de error con las mismas muestras en ambas estrategias. Un error más grande o persistente aumenta IAE; no se añade un intervalo al estado terminal.','Ec. (9), p. 13. Suma rectangular izquierda propia.']
  ];
  for(const [num,title,equation,variables,use,source] of cards){const card=document.createElement('article');card.className='equation-card';for(const [tag,text,cls] of [['span',num],['h3',title],['code',equation],['p',variables],['p',use],['p',source,'equation-source']]){const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;card.append(node);}container.append(card);}
}
export function renderSIMC(container,result,reference){
  const c=result.config,calculated=reference.cells.map(x=>simc(x.k_prime,x.theta_s,x.tau_c_s));
  const rows=[
    ['k′ identificado · cm/s/(L/min)',reference.cells.map(x=>x.k_prime)],
    ['k′ de la planta aplicada · cm/s/(L/min)',c.cells.map(x=>c.model==='physical'?-1000/(60*x.area_cm2):x.k_prime),true],
    ['Área de almacenamiento aplicada · cm²',result.storage_area_cm2,true],
    ['θ aplicado · s',c.cells.map(x=>x.theta_s)],['τc aplicado · s',c.cells.map(x=>x.tau_c_s)],
    ['Kc inicial reportado · Tabla 2',[-70.2,-81.8,-78.1]],['τi inicial reportado · s',[56,48,52]],
    ['Kc SIMC recalculado · k′ del paper',calculated.map(x=>x.kc)],['τi SIMC recalculado · s',calculated.map(x=>x.ti_s)],
    ['Kc final experimental · Tabla 2',reference.cells.map(x=>x.kc_final)],['τi final experimental · s',reference.cells.map(x=>x.ti_final_s)],
    ['Kff aplicado · adimensional',c.cells.map(x=>x.kff),true],
    ['Kc realmente aplicado',result.controllers.map(x=>x.kc),true],['τi realmente aplicado · s',result.controllers.map(x=>x.ti_s),true],
    ['Origen de la sintonía aplicada',c.cells.map((x,i)=>c.tuning==='simc'?`SIMC · ${c.model==='physical'?'físico':'identificado'}`:x.kc_final===reference.cells[i].kc_final&&x.ti_final_s===reference.cells[i].ti_final_s?'Final del artículo':'Editado por usuario'),true]
  ];
  container.replaceChildren();for(const [title,values,active] of rows){const tr=document.createElement('tr');if(active)tr.className='active-row';for(const value of [title,...values]){const td=document.createElement('td');td.textContent=typeof value==='number'?Math.abs(value)<.01&&value!==0?String(value):Number.isInteger(value)?String(value):value.toFixed(3):value;tr.append(td);}container.append(tr);}
}
