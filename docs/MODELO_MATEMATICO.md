# Modelo matemático y contrato de simulación 1.0.0

Este documento especifica el núcleo ejecutado en `flotation/core.py` y `web/core.js`. La evidencia del artículo y sus discrepancias están en AUDITORIA_ARTICULO.md. Todos los resultados generados llevan `data_origin="simulated"`.

## 1. Estados, unidades y conexiones

Para i=1,2,3, hᵢ es nivel en cm, Vᵢ volumen en L, Aᵢ área en cm², qᵢ descarga real en L/min y uᵢ orden de descarga en L/min. `1 L=1000 cm³`, `1 min=60 s`. Se conservan las unidades de ingeniería del artículo con conversiones explícitas. Tiempo de integración y muestreo: **Δt=1 s**.

```
Fuente ideal --qin,1--> [C1] --q1 / P1--> [C2] --q2 / P2--> [C3] --q3 / P3--> sumidero
                         |                |                |
                       rebose           rebose           rebose
```

`qin,1=qfeed`, `qin,2=q1`, `qin,3=q2`. El caudal real saliente de una celda entra a la siguiente en el mismo intervalo. No se propaga la orden u sin retardo. Los retardos propios de P2 y P3 no retrasan otra vez las alimentaciones: afectan a sus respectivas descargas.

T-1 del experimento queda fuera del volumen de control y se idealiza como fuente/sumidero. No se afirma conservación de un depósito finito no simulado. La alimentación impuesta puede superar la capacidad de descarga para ensayar rebose; no representa una P-4 calibrada.

## 2. Dos plantas alternativas, sin superposición

### Modelo físico (`model=physical`)

```
Vᵢ = Aᵢ hᵢ / 1000
dVᵢ/dt = (qin,ᵢ − qᵢ − qspill,ᵢ)/60
dhᵢ/dt = [1000/(60 Aᵢ)] (qin,ᵢ − qᵢ − qspill,ᵢ)
Aᵢ = 30×30 = 900 cm²; Hᵢ = 45 cm
```

En torno a un equilibrio interior, sin rebose/vaciado y con perturbación de alimentación nula, la transferencia desde incremento de orden Δu a incremento de nivel Δh es:

`Gp,physical(s)=−[1000/(60A)] exp(−θs)/s`.

El signo negativo se debe a que más descarga reduce el nivel. La pendiente es −0.0185185185 cm/s por L/min. No se usa una ley de válvula proporcional a √h: las bombas imponen descarga mientras haya líquido disponible.

### Modelo identificado (`model=identified`)

Tabla 2: `Gp,identified(s)=k′ exp(−θs)/s`, `k′=−0.001018`.

Se implementa con `Aeq=1000/(60|k′|)=16371.971185 cm²` y el mismo balance, sustituyendo A por Aeq. Entonces `dh/dt=|k′|(qin−qout)`. Es una realización equivalente del integrador identificado; no se añade luego otra ecuación de nivel geométrica. Se asume igual magnitud de ganancia para la entrada de alimentación y la salida de descarga, para conservar un inventario equivalente en serie. Esa transferencia de perturbación no está identificada independientemente en el paper.

`storage_area_cm2` distingue qué área se usó realmente. Los litros `Aeq*h/1000` son inventario **virtual**: por ejemplo, a 30 cm serían ≈491.16 L, frente a 27 L geométricos. No deben interpretarse como litros reales del laboratorio. La altura de seguridad sigue siendo un límite de nivel de simulación; su volumen equivalente tampoco es geométrico.

El factor entre ganancias es ≈18.1911. Usar los Kc finales del paper en el balance geométrico aumenta mucho la agresividad. Por eso se entregan dos configuraciones: `paper_identified.json` conserva k′ y sintonías finales; `physical_simc.json` conserva geometría y recalcula SIMC para ella. Se permite experimentar con otras combinaciones explícitas, sin prometer estabilidad.

No se utiliza `−h/τ1` en ninguno de estos integradores. La ecuación de primer orden (4) del paper tendería al integrador al tomar `τ1→∞`, manteniendo `k/τ1=k′`; con τ1 finito sería otro modelo. No se conoce τ1 finito para reconstruirlo.

## 3. Retardo y cronología discreta

Se adopta `qdelayed,ᵢ[n]=uᵢ[n−dᵢ]`, `d=[7,6,3]` muestras. Historial `u[n<0]=q0=45 L/min`. El retardo identificado se asigna a actuador/caudal como hipótesis; no se afirma que toda la demora experimental pertenezca a la bomba.

En cada intervalo `[n,n+1)`:

1. Se aplican eventos de alimentación/consigna en t=n. En eventos simultáneos del mismo tipo/celda prevalece el último en el arreglo.
2. Se calcula `eᵢ[n]=rᵢ[n]−hᵢ[n]`, con medición ideal sin filtro.
3. Se recorre C1→C2→C3: se conoce qin real, se calcula PI/FF, se limita la orden, se obtiene la descarga retardada y se restringe por disponibilidad de líquido. Esto no resuelve un lazo algebraico: la conexión es estrictamente en serie.
4. Se calcula rebose explícito y se actualiza el volumen por Euler con entradas retenidas constantes.
5. Se acumula IAE sobre el error de inicio del intervalo y se registra el balance.

Un cambio de orden a n=0 empieza a afectar el caudal en `[θ,θ+1)`. El nivel de la fila t=θ aún es el anterior; `next_level_cm` de esa fila ya refleja el cambio. La fila t=θ+1 lo muestra en `level_cm`. No hay un segundo retardo oculto de integración.

## 4. PI, signos, bias y saturación

El PI se expresa en caudal absoluto añadiendo un bias de equilibrio q0 a la ecuación del artículo, interpretada en variables de desviación:

```
eᵢ[n] = rᵢ[n] − hᵢ[n]
ΔIᵢ[n] = (Kcᵢ/τiᵢ) eᵢ[n] Δt           [L/min]
baseᵢ[n] = q0 + Kcᵢ eᵢ[n] + fᵢ[n]
utrial = base + Iprev + ΔI
Inew = Iprev + ΔI, salvo integración que agrave saturación
uraw = base + Inew
u = clip(uraw, umin, umax)
```

Se congela la integración si `utrial>umax y ΔI>0`, o si `utrial<umin y ΔI<0`. Se permite integración que ayude a salir de la saturación. `I[−1]=0`. Se actualiza el integral antes de emitir la orden; ambas implementaciones siguen la misma convención. El anti-windup es una decisión propia, no un detalle recuperado del MATLAB original. No es un predictor de Smith ni compensa saturación por vaciado.

Demostración del signo: si `h>r`, entonces `e<0`. Como `Kc<0`, `Kc e>0`, aumenta u, y después de θ aumenta qout. En el balance esto disminuye `dh/dt`. Si `h<r`, el PI reduce descarga y el nivel sube con la alimentación. Cambiar a error `h−r` exigiría invertir Kc; aquí no se hace.

Límites de ejemplo 0-90 L/min, configurables y comunes a las tres bombas. No hay limitación de rampa. El caudal aplicado procede de una orden ya limitada, pero puede quedar por debajo de umin si la celda se vacía; la protección física tiene prioridad.

## 5. Feedforward: convención explícita

Medición de perturbación `dᵢ[n]=qin,ᵢ[n]`, con historial `dᵢ[−1]=q0`:

- `paper_increment`: `fᵢ[n]=Kffᵢ(dᵢ[n]−dᵢ[n−1])`. Lectura literal de (7)-(8); un escalón produce un pulso de 1 s.
- `accumulated_increment`: `fᵢ[n]=fᵢ[n−1]+Kffᵢ(dᵢ[n]−dᵢ[n−1])`, con f inicial cero. Equivale a `Kffᵢ(dᵢ[n]−q0)`. Variante añadida para estudiar compensación sostenida, no atribuida al paper.
- `strategy=feedback` impone f=0. `strategy=feedback_feedforward` usa el modo configurado y `Kff=[0.8,0.8,1]`.

El término es positivo cuando aumenta la entrada: hace aumentar la descarga, lo que rechaza la perturbación con el signo adecuado. No se divide por k′ pues ya está en L/min. No se aplica un factor de calibración de registros al caudal por segunda vez. No se usa inversión no causal del retardo: por ello incluso Kff=1 no elimina instantáneamente una perturbación.

Las estrategias comparten configuración, condiciones iniciales, eventos externos y horizonte. Los qin de C2/C3 son salidas del lazo anterior, por lo que cambian de forma natural entre estrategias. No se sustituyen por señales externas idénticas, lo cual rompería la conexión del banco.

## 6. SIMC y separación de parámetros

Para `k′<0`, `τc≥θ`, `τc>0`:

`Kc=1/[k′(τc+θ)]`, `τi=min(τ1,4(τc+θ))`.

La función pública `simc` admite τ1 opcional; si se omite, toma el límite integrador y devuelve `τi=4(τc+θ)`. Se conserva θ=[7,6,3], τc=[7,6,8]. Para geometría física, SIMC produce:

| Celda | k′ físico | Kc (L/min)/cm | τi s |
|---|---:|---:|---:|
| 1 | −0.0185185185 | −3.857142857 | 56 |
| 2 | −0.0185185185 | −4.5 | 48 |
| 3 | −0.0185185185 | −4.909090909 | 44 |

`tuning=paper_final` usa siempre `kc_final`/`ti_final_s` explícitos del escenario, sin recalcularlos. `tuning=simc` usa la ganancia de la **planta seleccionada**, no necesariamente el k′ identificado almacenado como referencia en la celda. `controllers` del resultado expone los parámetros efectivamente usados. Los valores iniciales reportados y la discrepancia de celda 3 se preservan en AUDITORIA_ARTICULO.md; no se presentan como resultados reproducidos por SIMC.

## 7. Conservación y límites de inventario

Para cada intervalo, con A elegido según el modo:

```
Vavailable = V[n] + qin[n] Δt/60
qout = min(qdelayed, 60 Vavailable/Δt)
Vtrial = Vavailable − qout Δt/60
qspill = max(0, Vtrial − A H/1000) 60/Δt
V[n+1] = V[n] + (qin − qout − qspill) Δt/60
h[n+1] = 1000 V[n+1]/A
```

No se recorta h sin contabilizar líquido. Una protección final `max(0,h)` elimina únicamente residuales negativos de redondeo. El rebose sale del volumen de control; no alimenta a la siguiente celda como si fuera descarga de bomba.

Al sumar las tres celdas, q1 y q2 se cancelan exactamente en el balance algebraico:

`ΣV[n+1]−ΣV[n]=(qfeed−q3−Σqspill)Δt/60`.

`balance_residual_l` es la diferencia entre el inventario acumulado calculado y esa integral de flujos de frontera. Es volumen real en modo físico y volumen equivalente en modo identificado. Tolerancia de pruebas: 1e−8 L en los escenarios ensayados.

## 8. Integración, estabilidad e IAE

Euler explícito a 1 s coincide con la integración exacta del integrador durante un intervalo si el caudal se retiene constante; el lazo de control sí es una aproximación muestreada. Sin retardo ni saturación, el denominador característico del PI con planta k′/s es `s²+k′Kc s+k′Kc/τi`: coeficientes positivos cuando k′ y Kc son negativos. Esto justifica la acción correctora, pero **no demuestra** estabilidad con retardo arbitrario. La condición τc≥θ y las pruebas de convergencia apoyan las configuraciones de ejemplo; no se garantiza estabilidad de parámetros editados ni equivalencia con un controlador continuo.

La versión 1 fija Δt=1 y rechaza otros pasos. No se presenta una supuesta prueba de refinamiento de paso que el contrato aún no permite. Se ensayan equilibrio, pendientes analíticas de un paso, retardos exactos y convergencia temporal sin saturación; también recuperación después de saturación.

`IAEᵢ=Σ(n=0..N−1) |rᵢ[n]−hᵢ[n]| Δt`, con `N=T/Δt`. Es suma rectangular izquierda de (9), coherente con la retención de señales; no es SSE ni se llama error cuadrático. Cada fila contiene el estado a t=n y `next_level_cm` a t=n+1. `final_level_cm` corresponde a T. No se incluye otro error terminal de duración 1 s.

## 9. API reutilizable e intercambio JSON

Python: `simulate(config, strategy)`, `compare(config)`, `simc(...)`, `validate_config(config)`. JavaScript ES modules: `simulate`, `compare`, `simc`, `validateConfig`. No requieren servicios externos ni dependencias de ejecución. La interfaz de simulación es una función pura respecto a la configuración: no la modifica.

`schemas/simulation-v1.schema.json` usa JSON Schema 2020-12 para escenarios y resultados. `schema_version=1.0.0` y `kind=scenario|result` son obligatorios. Unidades obligatorias: s, cm, L/min, L, cm*s, cm² y unidades de ganancias. El índice `cell` de eventos es **0,1,2**. Los eventos tienen valores absolutos, no incrementos. Los nombres de estrategias son `feedback` y `feedback_feedforward`.

Cada resultado incluye configuración completa, origen simulado, estrategia, áreas de almacenamiento efectivas, controladores realmente usados, IAE, estado final y series con niveles, consignas, errores, entrada, orden, descarga aplicada, rebose, saturación y residual. `saturated` indica limitación de orden o descarga por vaciado, no rebose por sí solo.

El esquema valida estructura; las funciones de validación añaden relaciones entre campos (consigna≤altura, bias dentro de límites, τc≥θ, tiempo de evento dentro del horizonte). El núcleo no depende de un validador JSON Schema en ejecución. Se recomienda validar archivos externos con ambos niveles si se requiere rechazar también propiedades desconocidas.

La fase 2 reemplaza el banco mínimo por el dashboard `index.html` y los módulos de interfaz `web/app.js`, `session.js`, `charts.js` y auxiliares. Sigue consumiendo `web/core.js` sin modificar sus ecuaciones. Un Worker calcula la trayectoria completa al aplicar un escenario; el reloj visual revela muestras a 1/5/10/20 veces el tiempo, manteniendo Δt=1 s. Los cambios de parámetros requieren recalcular el experimento. No se cargan trayectorias prefabricadas.

El IAE visual es un prefijo de la misma suma hasta el tiempo reproducido; en T coincide con el resultado completo. Los cambios de velocidad, pausa, selección de celda, gráficos y búsqueda temporal no alteran la trayectoria ni la configuración. La decimación por extremos sólo reduce puntos dibujados en Canvas, nunca los datos exportados ni el IAE.

El esquema de escenarios/resultados se mantiene en 1.0.0. Un sobre auxiliar `simulation_exchange`, versión 1.0.0, puede agrupar ambas estrategias y declarar el motor Python/JavaScript; sus resultados internos se validan con el esquema original. Las etiquetas de archivo indican origen declarado, no autoría certificada. La importación verifica las muestras por repetición, pero visualiza los objetos originales del archivo. Los CLI permiten escenario exportado del navegador→Python→resultado→navegador, sin API ni Node para usar la web.

La fase 3 implementa el servidor FastAPI/Uvicorn en `flotation/api.py` y `servidor.py`, que llama directamente al mismo `simulate` de Python. No se introducen otras ecuaciones. /health informa versiones/capacidades y /simulate devuelve el resultado 1.0.0 con procedencia Python en cabeceras HTTP; el esquema científico no cambia. El cliente nunca cambia silenciosamente a JavaScript si falla. La conexión local real se verificó en Chrome y Edge. HTTPS/Vercel permanece NOT TESTED hasta disponer de URL pública; ver API_PYTHON.md y VALIDACION_FASE3.md.
