# Guía de la interfaz FlotaLab · Fase 2

## Abrir el laboratorio

En una terminal del directorio del proyecto:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Visita <http://127.0.0.1:8000>. No abras `index.html` con `file://`: módulos, Worker y carga de configuraciones necesitan HTTP. La simulación funciona en JavaScript sin Python de cálculo; el comando anterior sólo sirve archivos y puede sustituirse por otro servidor estático. No usa bibliotecas de gráficos ni servicios remotos.

## Leer el banco

- C1 turquesa, C2 violeta y C3 naranja: cada tarjeta muestra nivel en cm, porcentaje relativo a su altura máxima, consigna, error `r−h`, caudal entrante y descarga real.
- El líquido y la línea de consigna se posicionan con las muestras del motor. La espuma es una representación gráfica declarada; no es una variable simulada.
- P1/P2/P3 son bombas peristálticas de descarga, con orden en L/min y estado operando/detenida/limitada. El caudal real puede diferir de la orden por el retardo o el vaciado.
- Las tuberías muestran la descarga real de la celda anterior, que es alimentación de la siguiente. Se anima el flujo sólo mientras se reproduce y hay caudal; no se usan niveles aleatorios.
- “Rebose” indica que el balance contabiliza descarga de seguridad al llegar a la altura máxima; se muestra su caudal. “Limitada” indica saturación de orden o restricción por falta de líquido. Una bomba puede tener caudal cero durante un retardo aun cuando su nueva orden sea distinta.
- El residual es el error acumulado del balance del banco. En la planta identificada se expresa en litros **equivalentes**; no se afirma que sean litros del montaje físico.

La cabecera muestra por separado la planta y el motor de los **datos aplicados**. El selector de motor en la sección Python controla el **próximo cálculo**, no renombra los datos existentes.

## Controles de reproducción

El motor calcula la trayectoria al aplicar un escenario, a partir de las ecuaciones del núcleo y los parámetros actuales; no carga curvas prefabricadas. El reloj reproduce esas muestras:

| Control | Acción |
|---|---|
| Iniciar / Continuar | Inicia o reanuda desde el instante actual. |
| Pausar | Detiene reloj, rotor de bombas y movimiento de tuberías. |
| Reiniciar ↺ | Regresa a t=0 del mismo experimento, sin cambiar parámetros ni resultados. |
| Avanzar ▸\| | Pausa y avanza exactamente 1 s. |
| ×1, ×5, ×10, ×20 | Cambia velocidad de reproducción, nunca Δt=1 s. |
| Barra temporal | Consulta un segundo exacto y pausa. |
| Ver resultado final | Lleva al estado terminal T y muestra el IAE completo. |
| Reproducir de nuevo | Desde T, vuelve a t=0 y comienza el mismo resultado determinista. |

En t=n se presenta el estado inicial del intervalo `[n,n+1)` y el IAE ya integrado hasta n. En t=T se presenta el estado terminal real; los caudales mostrados son los del último intervalo, no un nuevo paso agregado artificialmente. El IAE terminal coincide con el del archivo de resultado.

## Configuración de experimentos

Los cuatro escenarios se derivan de la configuración verificada en la fase 1:

1. **Referencia:** modelo identificado y ganancias finales del artículo, con los eventos didácticos de la fase 1. No reproduce Figura 14.
2. **Balance físico:** geometría real y SIMC recalculado para su ganancia; no traslada silenciosamente los Kc experimentales a otra escala.
3. **Perturbación:** alimentación +10 L/min a 120 s y retorno a 420 s, conservando las consignas iniciales.
4. **Equilibrio:** sin eventos, entrada y descargas inicialmente iguales.

Puedes editar alimentación inicial, duración (1-7200 s), consignas y todos los eventos. En “Eventos y perturbaciones”, el generador de escalón usa un instante, incremento ΔQ y retorno opcional. **Aplicar escalón a los eventos** sustituye sólo los eventos de alimentación; conserva los de consigna. Después pulsa **Aplicar y calcular** para recalcular la trayectoria.

La lista permite añadir eventos, elegir alimentación o consigna de C1/C2/C3, editar tiempo y valor absoluto y eliminar eventos. Los eventos de alimentación no llevan límite de bomba P4 porque esa bomba se idealiza como fuente externa. Si el caudal supera la capacidad de descarga, puede haber rebose. En tiempos simultáneos para la misma señal prevalece el último evento de la lista, conforme al núcleo.

Las consignas de la parte superior son las iniciales; los eventos posteriores las reemplazan en su instante programado. Acortar el horizonte sin eliminar eventos que queden fuera produce un error explícito: no se eliminan silenciosamente.

Al editar, la reproducción se pausa, aparece “Cambios pendientes” y se bloquea Iniciar hasta aplicar. Los resultados previos se conservan y están identificados; exportar escenario o resultados exporta el experimento **aplicado**, no los campos pendientes. Elegir un escenario o restablecer el artículo carga y calcula sus parámetros. El selector de estrategias se respeta; el botón **Comparación de controladores** selecciona ambas y recalcula.

En “Parámetros avanzados” puedes cambiar condiciones iniciales, Kff y ganancias explícitas Kc/τi. SIMC calcula Kc/τi desde la planta elegida y los deshabilita como campos editables. Para editarlos, selecciona “Ganancias explícitas”. La tabla SIMC muestra los valores realmente aplicados y marca “Editado por usuario” cuando difieren de los finales de referencia. Los rangos de edición previenen signos inválidos y números no finitos; no garantizan estabilidad de cualquier sintonía.

## Comparar controladores

Selecciona “Comparar ambas estrategias” y aplica. Ambas comparten condiciones iniciales, eventos externos, horizonte y planta. El banco muestra la estrategia elegida en **Visualizar**. Los caudales de C2/C3 pueden diferir entre estrategias porque provienen del control de las celdas anteriores.

La tabla calcula la reducción `100(IAE_PI−IAE_PI+FF)/IAE_PI`: positiva significa mejora de FF; negativa, deterioro. Si IAE_PI=0 se muestra “—”, evitando división por cero. El ganador se decide con los IAE calculados, sin favorecer FF. En t=0 los dos IAE son cero y se muestran iguales.

FF literal usa la diferencia entre muestras de las Ecs. (7)-(8). FF acumulado está etiquetado **“Variante experimental de implementación propia”**. No confundir los dos ni presentar sus resultados como ensayos del artículo.

## Consultar las gráficas

Hay seis paneles: nivel/consigna, entrada/descarga, orden de bomba, error, IAE acumulado y niveles de las tres celdas. Los primeros cinco siguen el selector C1/C2/C3. El sexto muestra el banco completo de la estrategia activa en “Visualizar”. En comparación, los cinco primeros superponen ambas estrategias: continua PI y discontinua PI+FF; las consignas usan puntos.

Ejes en s, cm, L/min o cm·s según la variable. El horizonte horizontal es fijo; sólo se dibujan muestras hasta el tiempo reproducido. Los ejes verticales se preparan con la trayectoria completa para mantener escala estable. Las líneas conectan muestras; el tooltip devuelve un segundo real, no valores interpolados.

Usa cursor, toque o las flechas con foco en la gráfica. Home/End consultan primera muestra y tiempo actual. Canvas evita miles de nodos DOM; en horizontes largos se conservan extremos por columna para dibujar, sin reducir ni alterar datos exportados o IAE. Las gráficas fuera de pantalla se actualizan al entrar en vista.

## Python y archivos

En “Escenarios y resultados portátiles” puedes exportar el escenario aplicado y resultados completos. También se importan escenarios, resultados directos 1.0.0 y sobres con una o ambas estrategias. Se validan esquema, unidades, versión y consistencia de cada serie. El límite de importación es 40 MB y 7200 s para proteger la interfaz; el núcleo original mantiene su propio límite de 86400 s.

Un archivo con origen Python se visualiza como **Python · archivo (declarado)**. Esto no requiere un servidor conectado y no se confunde con Python · API local. Importar un escenario lo recalcula con el motor seleccionado; importar un resultado presenta las series del archivo. No se mezclan resultados de escenarios distintos para compararlos.

Para la conexión real consulta [GUIA_CONEXION_PYTHON.md](GUIA_CONEXION_PYTHON.md) y el [contrato API](API_PYTHON.md). La fase 3 incorpora servidor FastAPI/Uvicorn y paquete autónomo, probados con Chrome y Edge desde la web local. El chequeo de salud cada 10 s detecta pérdidas; el fallo de API muestra un error y nunca sustituye silenciosamente el cálculo por JavaScript. HTTPS de Vercel→Python sigue pendiente hasta disponer de la URL pública.

## Guion de demostración, 5-7 minutos

1. Abre la referencia, señala los tres niveles, las bombas y los retardos. Avanza un paso y reproduce ×20; pausa para mostrar que cambia el reloj, no Δt.
2. Ve al resultado final: explica IAE por celda y los deterioros de FF literal en C2/C3. Cambia a C2 y muestra error e IAE en las gráficas.
3. Selecciona el escenario de perturbación. Muestra el instante del escalón y cómo la descarga de C1 se propaga a C2.
4. Prueba FF acumulado, aplica y compara. Identifícalo verbalmente como variante propia.
5. Cambia a modelo físico y explica el factor de escala y la nueva sintonía SIMC. La diferencia de respuesta no implica error numérico.
6. Exporta un escenario, ejecútalo en Python e importa sus resultados con el comando del documento API. Señala “Python · archivo (declarado)”.
7. Finaliza en ecuaciones, tabla SIMC y comparación con el paper: datos publicados separados, inconsistencia de C3 y ausencia de validación experimental propia.

## Despliegue y límites

`npm.cmd run build` crea `dist/` con una lista explícita de archivos públicos. No publica pruebas, dependencias, temporales ni código Python como backend. `vercel.json` define instalación sin dependencias de desarrollo, construcción estática y salida `dist`. La guía de conexión se incorpora en la fase 3; no se ha realizado despliegue público.

Para operar y verificar el paquete consulta el README. No hay autenticación, base de datos, Docker, API remota obligatoria ni secretos. API Python real local: PASS en Chrome y Edge. Vercel HTTPS, Firefox y dispositivos físicos móviles: NOT TESTED. La vista móvil se verificó por emulación en Chrome, no en un teléfono real.
