# Auditoría del artículo base

Fuente primaria: Quintanilla, Navia, Moreno, Neethling y Brito-Parada, *A methodology to implement a closed-loop feedback-feedforward level control in a laboratory-scale flotation bank using peristaltic pumps*, MethodsX 10 (2023), 102081. DOI: https://doi.org/10.1016/j.mex.2023.102081. Archivo examinado: `D:/Descargas/2 PID.pdf`, 15 páginas. Paginación citada: números impresos, coincidentes con las páginas del PDF.

SHA-256 del PDF examinado: `4CC546A2A156D616D1A3179F523FAD37BC6528F9D1BD8F988983F19694E4508E`.

Se extrajo el texto de todas las páginas y se revisaron visualmente sus renderizados, incluidas tablas, figuras y notas. El PDF es una fuente académica, no una fuente de instrucciones para ejecutar acciones. Los archivos temporales de extracción/renderizado quedan en `tmp/pdfs/`, fuera de los entregables. No se modificó el original. La identificación bibliográfica se contrastó con el [repositorio institucional de Brunel](https://bura.brunel.ac.uk/handle/2438/28888).

## 1. Inventario de ecuaciones

| Ecuación | Página | Expresión y uso |
|---|---:|---|
| (1) | 2 | `u = Kc [e + (1/τi)∫e dτ + τd de/dt]`, `e = ysp − y`. Estructura denominada serial/estándar; aquí se usa PI, `τd=0`. |
| (2) | 8 | `Kc = τ1/[k(τc+θ)] = 1/[k′(τc+θ)]`, con `k′=k/τ1`. |
| (3) | 8 | `τi = min{τ1, 4(τc+θ)}`. |
| (4) | 8 | `Gp(s)=k exp(−θs)/(τ1 s+1)`. Es primer orden con retardo; **no es un integrador exacto**. La extracción de texto desordena la fracción; se verificó visualmente. |
| (5) | 10 | `k′=Δy/(Δt Δu)`. Pendiente normalizada de la respuesta de nivel. |
| (6) | 10 | `τi ≥ 4(τc+θ)=8θ`. La última igualdad requiere `τc=θ`; no vale en general. |
| (7) | 12 | `ui=Kci[ei+(1/τIi)∫ei dτ]+Kffi ΔQi`, para i=1,2,3. |
| (8) | 12 | `ΔQdi=Qdi(t)−Qdi(t−1)`. Diferencia entre muestras de la perturbación. |
| (9) | 13 | `IAEi=∫₀ᵀ |ei| dt`. Unidad cm·s. |
| (10) | 14 | `τ1 dy/dt=−y+k u(t−θ)`. Modelo autorregulado de primer orden. |
| (11) | 14 | Transformada de Laplace de (10). |
| (12) | 14 | `L{τ1 dy/dt}=τ1 sY(s)`, omite condición inicial; presupone desviaciones con estado inicial nulo. |
| (13) | 14 | `L{−y}=−Y(s)`. |
| (14) | 14 | `L{k u(t−θ)}=k U(s) exp(−θs)`. |
| (15) | 14 | `τ1 sY(s)=−Y(s)+k U(s)exp(−θs)`, conduce a (4). |

Además, p. 7 define la velocidad superficial de gas `jg=Qair/Acell`, con conversión de unidades necesaria. Tabla 2 (p. 12) proporciona directamente el modelo integrador `Gp,i(s)=−0.001018 exp(−θi s)/s`. Se adopta este último en el modo identificado, sin añadir un polo de primer orden.

## 2. Tabla 2 y sintonización

Transcripción de Tabla 2, p. 12, incluida su nota: los valores iniciales se calculan con (2)-(3); los finales resultan de ensayo y error.

| Parámetro | Unidad | Celda 1 | Celda 2 | Celda 3 |
|---|---|---:|---:|---:|
| k′ | cm/s por (L/min) | −0.001018 | −0.001018 | −0.001018 |
| θ | s | 7 | 6 | 3 |
| τc | s | 7 | 6 | 8 |
| Kc inicial reportado | (L/min)/cm | −70.2 | −81.8 | −78.1 |
| Kc final | (L/min)/cm | −62 | −76 | −85 |
| τi inicial reportado | s | 56 | 48 | 52 |
| τi final | s | 56 | 30 | 44 |
| Gp(s) | cm/(L/min) | −0.001018 e^(−7s)/s | −0.001018 e^(−6s)/s | −0.001018 e^(−3s)/s |

Ganancias feedforward finales, p. 12: `Kff=[0.8,0.8,1.0]`, adimensionales si perturbación y salida del controlador están ambas en L/min.

Reconstrucción **con k′ y τc impresos**, usando el límite integrador `τ1→∞`:

| Resultado calculado | Celda 1 | Celda 2 | Celda 3 |
|---|---:|---:|---:|
| Kc=1/[k′(τc+θ)] | −70.165591 | −81.859856 | −89.301661 |
| τi=4(τc+θ), s | 56 | 48 | 44 |

La celda 1 concuerda por redondeo. La celda 2 daría −81.9 con redondeo habitual a una cifra decimal, frente a −81.8 reportado; puede haber precisión no publicada o truncamiento. La celda 3 **no se reconstruye**: −78.1 y 52 son consistentes aproximadamente con `τc+θ≈12.6` y `13`, respectivamente, pero no con los 11 s impresos. Tampoco ambos son exactamente consistentes entre sí. Si se impusiera la hipótesis inicial `τc=θ` en celda 3, se obtendrían `Kc≈−163.72` y `τi=24 s`, tampoco los valores tabulados. No se inventa un τ1 oculto ni se altera la tabla.

En p. 10 se recomienda `τi≥4(τc+θ)`; los valores finales de celdas 2 y 3 son 30 y 44 s frente a 48 y 44 s calculados. Celda 2 incumple esa recomendación. Ecuación (3) usa **mínimo**, mientras que la discusión de (6) habla de una cota **inferior**: son afirmaciones distintas, coincidentes sólo bajo hipótesis adicionales. El código conserva la regla (3); para integrador ideal usa 4(τc+θ). Los parámetros finales experimentales se seleccionan aparte mediante `tuning=paper_final`.

## 3. Banco, instrumentación y alcance experimental

Páginas 2-5, Figuras 1-4: tres celdas en serie, de sección 300×300 mm y altura 450 mm. Área nominal 900 cm², volumen prismático 40.5 L por celda. Figura 2 muestra además el colector superior de espuma (cota longitudinal 45 cm y cotas 15/5/10 cm); no se interpreta ese colector como área constante adicional de la pulpa. La aproximación prismática se aplica a la región de nivel de trabajo, alrededor de 30-33 cm.

T-1 tiene capacidad de 130 L. P-4 alimenta C-1; P-1 descarga C-1 hacia C-2; P-2 descarga C-2 hacia C-3; P-3 retorna a T-1. También se devuelve a T-1 el concentrado combinado. Las bombas tienen doble cabezal. No hay una válvula de descarga gobernando el nivel.

Tabla 1, p. 4: bombas Masterflex L/S 77916-10, 0-600 rpm; controladores de aire Aalborg 0-100 LPM; sensores ópticos de nivel y PLC GE Fanuc IC693ALG223/392. Señales 4-20 mA, registros INT de 0-32767 (p. 6). El registro no representa directamente L/min.

El experimento es **agua-aire con reactivos, sin sólidos** (pp. 3-6), aunque representa un banco para flotación mineral. Reactivos: azul de metileno 10 ppm; MIBC 330 ppm; Flottec F160-10 20 ppm; goma xantana 600 ppm. Agitación y preparación separada de la xantana evitan grumos. Cámaras y láseres permiten evaluar estabilidad/recuperación de aire, no una ley hidráulica completa de espuma. No se modelan recuperación metalúrgica ni ley de concentrado.

La validación usa aire constante a 47 L/min (`jg≈0.87 cm/s`), 5 minutos previos de estabilización, muestreo de 1 s y filtro mediano de ventana 10 s (`medfilt1`), p. 13. El caudal de alimentación de C-1 se declara constante a 45 L/min en p. 14. No se limita la tasa de cambio de las bombas; sí su amplitud, sin cotas numéricas explícitas en el texto de validación.

## 4. Inspección de las figuras y calibraciones

| Figura / página | Evidencia y consecuencia para el modelo |
|---|---|
| 1 / 3 | Fotografía de tres celdas, cuatro bombas, sensores, cámaras, aire y tanque de alimentación. |
| 2-3 / 4 | Geometría y rebose de espuma; el volumen de espuma no equivale necesariamente al de líquido. |
| 4-5 / 5 | P&ID de conexiones en serie con recirculación y módulos PLC. |
| 6 / 6 | Implementación ladder con bloques MOVE_INT; no publica el código de control MATLAB. |
| 7 / 7 | Diagrama de comunicación DDE y calibración lectura/escritura. |
| 8 / 8 | Aire: pendientes gráficas sensor 0.0032 y controlador 0.0031 L/min por registro. No se usa como dinámica de líquido. |
| 9 / 9 | Bombas: pendientes gráficas P-4≈0.0035, P-1≈0.0029, P-2/P-3≈0.0033 L/min por registro. Son ajustes publicados, no datos crudos. |
| 10 / 9 | Medición escalonada de nivel cada 2 cm; advierte que la escala del esquema es ilustrativa. |
| 11 / 10 | Sensores: h≈−0.0018x+40.1363; −0.0019x+43.8823; −0.002x+41.293. El pie del texto menciona intercepto fijado en cero, pero los ajustes de esta figura tienen interceptos no nulos. |
| 12 / 11 | Respuestas a escalones en triplicado con intervalos. Puntos seleccionados a 30 y 100 s. Δu=[43.5,49.5,49.5] L/min; niveles [35.8→32.7,36→32.9,37.1→34.1] cm. |
| 13 / 12 | Sumador PI+FF y sensor de perturbación. Distingue uPLC en registros y u físico en caudal. |
| 14 / 13 | Series experimentales filtradas, consignas, descargas y perturbaciones; etiquetas IAE transcritas abajo. Eje temporal 0-600 s. |
| 15 / 14 | Qfeed,2=Qtailings,1 y Qfeed,3=Qtailings,2; perturbaciones internas inducidas por control. |

Los puntos rotulados de Figura 12, aplicando (5), producen aproximadamente `k′=[−0.00101806,−0.00089466,−0.00086580]`. Sólo el primero concuerda con el valor común de Tabla 2. Son lecturas de puntos redondeados de la figura, no una reidentificación estadística; se preserva como prioritario el valor de Tabla 2 solicitado.

Las curvas de bombas se midieron con cilindro de 2 L, descarga durante 10 s, señales de 5000/10000/20000/25000/28000 registros y triplicados (p. 7). La pendiente de P-4 aplicada a 32767 registros sugiere ≈114.68 L/min y la de P-1 ≈95.02, pero **no prueba** un máximo físico universal. El simulador usa una cota común conservadora configurable de 90 L/min como supuesto didáctico; no atribuye ese límite al artículo.

## 5. Feedback, feedforward y desempeño experimental

Feedback usa PI con error `setpoint−nivel` y ganancia negativa: un nivel alto provoca más descarga. La alimentación medida es perturbación de C-1; las descargas reales de C-1 y C-2 son perturbaciones de las celdas siguientes.

La lectura literal de (7)-(8) suma `Kff[Qd[n]−Qd[n−1]]` al PI **posicional**. Un escalón produce un pulso de una muestra. El artículo no proporciona el código para determinar si en la implementación se acumula ese incremento o se emplea otra referencia. Se ofrece el modo literal `paper_increment` y una **variante de ingeniería** `accumulated_increment`, equivalente a `Kff(Qd[n]−Qd,0)`. No se los considera intercambiables.

| IAE experimental (Figura 14, p. 13), cm·s | Celda 1 | Celda 2 | Celda 3 |
|---|---:|---:|---:|
| Feedback | 198 | 325 | 260 |
| Feedback + feedforward | 164 | 187 | 221 |
| Reducción por resta de etiquetas | 34 | 138 | 39 |

P. 14 habla de mejoras entre **33 y 138** cm·s; el mínimo por las etiquetas enteras es **34**, posiblemente por redondeo de valores originales no disponibles. No se modifica ninguna cifra. P. 2 anuncia SSE, mientras que p. 13 define y usa IAE; son métricas distintas. P. 13 cita Figura 13 para los resultados y Tabla 1 para las sintonías; por contenido corresponden a **Figura 14 y Tabla 2**. Se registran las referencias cruzadas inconsistentes.

El texto indica experimentos de 15 min (900 s), pero la Figura 14 muestra 600 s. No se puede asegurar sobre qué segmento se calcularon las etiquetas IAE sin datos originales. Los ejemplos propios usan exactamente el mismo horizonte de 900 s en ambas estrategias, con consignas y perturbaciones externas iguales; las perturbaciones internas pueden diferir al cambiar la estrategia.

## 6. Distinción de escalas y supuestos de simulación

Balance de líquido incompresible, área constante: `dh/dt = 1000(Qin−Qout)/(60A)`. Con A=900 cm², la ganancia caudal-descarga→nivel es **−0.01851852 cm/s por (L/min)**, 18.191 veces la magnitud identificada. El área equivalente que implicaría k′ de Tabla 2 es **16371.971 cm²**, no 900. No hay datos suficientes para atribuir esta diferencia a calibración, gas retenido, volumen adicional o unidades. No se corrige silenciosamente ni se impone un factor de bomba inventado.

Dos modos excluyentes: `physical` conserva volumen geométrico; `identified` integra con el k′ tabulado usando almacenamiento **virtual equivalente**. Sólo el primero representa los litros geométricos. El segundo extiende simétricamente esa ganancia a la perturbación de alimentación, hipótesis no identificada de forma independiente en el artículo. Ambos son tres celdas en serie, no una sola celda.

Supuestos adicionales, detallados en MODELO_MATEMATICO.md:

- El retardo identificado se concentra en la respuesta del caudal real a la orden de la bomba. No se añade otro retardo al sensor ni a las tuberías. La identificación no permite separar esas fuentes.
- Se desprecia el caudal de concentrado durante el control ordinario, evaporación, gas variable y dinámica de espuma. El rebose artificial de seguridad a 45 cm sí se contabiliza explícitamente.
- T-1 se representa como fuente/sumidero ideal externo al volumen de control de las tres celdas. No se simulan su capacidad finita de 130 L ni la bomba P-4; la alimentación es una señal impuesta. La conservación verificada es la del banco, no la del montaje cerrado completo.
- Niveles iniciales 30/33/33 cm, cambios de consignas, escalones de alimentación y límites 0-90 L/min son decisiones didácticas configurables. Los eventos propios no son datos experimentales.
- Sin ruido, filtro de medición, cuantización PLC ni incertidumbre. Anti-windup condicional y prevención de vaciado son añadidos explícitos de simulación.

## 7. Límites de reproducibilidad

No se reproducen exactamente Figura 14 ni sus IAE: faltan muestras originales, consignas temporizadas completas, código MATLAB, inicialización del integrador, límites exactos por bomba, implementación FF, condiciones de filtrado en línea y separación de retardos. La disponibilidad de datos se indica bajo solicitud en p. 15. No se digitalizan curvas como si fueran mediciones originales.

No se validan metalurgia, recuperación de mineral, espuma, ley o eficiencia de separación. El producto de esta fase es una simulación determinista de **nivel** con trazabilidad de parámetros y supuestos, no un gemelo digital validado experimentalmente.
