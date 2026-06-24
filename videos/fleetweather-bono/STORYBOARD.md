---
project: fleetweather-bono
title: "FleetWeather — Bono dinámico por lluvia para Rappiteneros"
arc: "PAS (problema conocido) con secuencia de demo del flujo end-to-end"
language: es
audience: "Panel de entrevista técnica/producto — evaluadores del proyecto"
canvas: { w: 1920, h: 1080, fps: 30 }
audio: { narration: false, music: false }
style:
  font: "Poppins (display/numerales/chrome) + Inter (cuerpo)"
  palette: ["#FFFFFF", "#F6F6F7", "#FF441F", "#1A1A1A", "#5A5A60"]
  data_palette: { sin: "#0FA968", bajo: "#F2A900", alto: "#FF8A3D", critico: "#E5402A", lluvia: "#3B82F6" }
transitions_used: ["crossfade", "push-slide LEFT", "zoom-through"]
avoid: ["slideshow genérico", "texto hero diminuto", "fondo oscuro", "segundo color de acento que no sea naranja Rappi", "inventar cifras fuera de las del SPEC", "PowerPoint enter-then-freeze", "screensaver flotante"]
total_estimate_s: 84
---

## Video direction

- **palette system** — de `frame.md`: lienzo `#FFFFFF`/`#F6F6F7`; texto `#1A1A1A` (títulos) y `#5A5A60` (cuerpo); única voltage de acento naranja Rappi `#FF441F` (eyebrows, numerales, fills, step-circles, líneas-acento). Para datos: lluvia azul `#3B82F6`; niveles de bono sin/bajo/alto/crítico = `#0FA968`/`#F2A900`/`#FF8A3D`/`#E5402A` SOLO en chips/puntos de datos, nunca como segundo acento de marca. Tarjetas tinte naranja 4% / borde 20%, sin sombras.
- **motion defaults + shot model** — cada frame es un plano dirigido: `entrada → desarrollo → asentamiento`. Eases por defecto `power3.out` (entradas), `power2.inOut` (desarrollo), `sine` (idle). El desarrollo (un reveal, un reordenamiento, un count-up, un golpe de énfasis) corre en mitad del plano; debajo, una micro-cámara (push lento ~1.03x o deriva sine) sostiene todo el plano. Nada de exits salvo el frame final.
- **idle-life budget** — durante el asentamiento solo sigue la micro-cámara y micro-loops sutiles (sine breathe del logo, dash-flow de líneas). Sin elementos flotando independientes.
- **negative list** — nada de fondo oscuro, segundo acento de marca, texto narrativo largo en pantalla, sombras duras, esquinas cuadradas (salvo la barra de progreso), slideshow (entrar y congelar) ni screensaver (todo flotando).
- **stillness allocation** — solo **Frame 4 (solución)** y **Frame 9 (ejemplo)** sostienen como clímax/respiro tras su reveal; todos los demás desarrollan en mitad del plano.

## Frame 1 — hook

- scene: Pantalla blanca limpia. Logo Rappi (naranja) arriba. Una gota/lluvia sutil cae y el titular grande aparece. On-screen: "Cuando llueve, el delivery se rompe." Eyebrow pequeño: "FLEETWEATHER".
- on_screen: "Cuando llueve, el delivery se rompe." / eyebrow "FLEETWEATHER · BONO DINÁMICO POR LLUVIA"
- voiceover: ""
- duration: 6s
- transition_in: cut
- status: outline
- src: compositions/frames/01-hook.html
- type: hook
- persuasion: Pain validation
- beat: tension
- effects: discrete-text-sequence, svg-icon-enrichment, sine-wave-loop
- focal: assets/rappi-logo.svg
- roles: rappi-logo = supporting (marca, arriba-izquierda, ~64px alto)
- asset_candidates: assets/rappi-logo.svg — logo Rappi naranja para identidad de marca

Entrada: logo Rappi entra arriba-izquierda bajo una línea-acento naranja; el eyebrow aparece. Desarrollo: el titular "Cuando llueve, el delivery se rompe." se ensambla palabra a palabra (discrete-text-sequence) mientras finas líneas de lluvia diagonales caen detrás (svg-icon-enrichment, dash-flow azul muy tenue). Asentamiento: la lluvia mantiene un loop sutil (sine-wave-loop) y un push lento sostiene el plano.
narrativeRole: Abre con la tensión central del negocio en una frase, anclada a la marca Rappi.
keyMessage: La lluvia desbalancea el delivery — ese es el problema a resolver.

## Frame 2 — pain-double

- scene: El insight clave en dos flechas opuestas. Columna izquierda "DEMANDA ↑", columna derecha "OFERTA ↓"; en el centro una brecha que se abre.
- on_screen: "La demanda SUBE" · "los usuarios piden más" // "La oferta BAJA" · "menos Rappiteneros conectados" // centro: "BRECHA"
- voiceover: ""
- duration: 8s
- transition_in: crossfade
- status: outline
- src: compositions/frames/02-pain-double.html
- type: pain_point
- persuasion: Negative contrast
- beat: frustration
- effects: split-tilt-cards, counting-dynamic-scale, svg-icon-enrichment
- blueprint: comparison-split-cards
- focal:
- roles:
- asset_candidates:

Base: comparison-split-cards · Keep: las dos tarjetas en espejo que entran desde lados opuestos al centro · Depart: en vez de comparar dos productos, izquierda "DEMANDA ↑" (flecha sube, número de pedidos count-up) y derecha "OFERTA ↓" (flecha baja, Rappiteneros count-down); añado en el centro, como desarrollo, una franja "BRECHA" que se ensancha entre ambas.
Entrada: las dos tarjetas entran desde los bordes (split). Desarrollo: la flecha izquierda sube y su contador crece, la derecha baja y el suyo decrece (counting-dynamic-scale + svg-icon-enrichment en las flechas); la franja central "BRECHA" se ensancha. Asentamiento: micro-pulso en "BRECHA" y push lento.
narrativeRole: Explica por qué la lluvia es doblemente dañina: sube demanda y baja oferta a la vez.
keyMessage: Llueve → demanda sube y oferta baja → se abre una brecha.

## Frame 3 — pain-today

- scene: Cómo se resuelve hoy. Tres etiquetas grises en secuencia: "Manual", "Reactivo", "Sin modelo por zona".
- on_screen: "Hoy se decide…" → "Manual · Reactivo · Sin modelo por zona"
- voiceover: ""
- duration: 6s
- transition_in: crossfade
- status: outline
- src: compositions/frames/03-pain-today.html
- type: pain_point
- persuasion: Pain agitation
- beat: overwhelm
- effects: discrete-text-sequence, kinetic-beat-slam, press-release-spring
- blueprint: messaging-multi-phrase
- focal:
- roles:
- asset_candidates:

Base: messaging-multi-phrase · Keep: la cadencia de frases que entran una tras otra en el mismo eje · Depart: 3 etiquetas-defecto ("Manual", "Reactivo", "Sin modelo por zona") en gris apagado, cada una con un pequeño icono tachado; el eyebrow "HOY SE DECIDE" arriba.
Entrada: eyebrow + primera etiqueta entran. Desarrollo: las tres etiquetas se suceden con un golpe rítmico (kinetic-beat-slam) acumulándose en pila/fila; cada una en gris para señalar fricción. Asentamiento: leve press-release-spring de cierre y push lento.
narrativeRole: Agita el dolor mostrando que la decisión actual del incentivo es artesanal.
keyMessage: La decisión del bono hoy es manual y sin un modelo unificado por zona.

## Frame 4 — solution

- scene: Reveal del producto. Logo + nombre "FleetWeather". Subtítulo: recomienda un bono concreto en COP por entrega, por zona, antes de que llueva.
- on_screen: "FleetWeather" / "Recomienda el bono por entrega — en COP, por zona, antes de que llueva."
- voiceover: ""
- duration: 7s
- transition_in: zoom-through
- status: outline
- src: compositions/frames/04-solution.html
- type: product_intro
- persuasion: Simplification
- beat: relief + clarity
- effects: discrete-text-sequence, coordinate-target-zoom, sine-wave-loop
- blueprint: brand-reveal-assemble-zoom
- focal: assets/rappi-logo.svg
- roles: rappi-logo = cutout (héroe junto al nombre del producto)
- asset_candidates: assets/rappi-logo.svg — logo Rappi para el reveal del producto

Base: brand-reveal-assemble-zoom · Keep: el texto-compañero se ensambla junto al héroe y la cámara hace zoom al lockup · Depart: el héroe es el lockup "logo Rappi + FleetWeather"; el compañero es el subtítulo de propuesta de valor.
Entrada: "FleetWeather" se ensambla (discrete-text-sequence) junto al logo Rappi. Desarrollo: la cámara hace un zoom suave hacia el lockup (coordinate-target-zoom) y el subtítulo aparece debajo. Asentamiento (HOLD/clímax): el logo respira (sine-wave-loop) y el plano se sostiene.
narrativeRole: Presenta la solución como la palanca accionable que cierra la brecha.
keyMessage: FleetWeather automatiza el cálculo del bono óptimo por zona.

## Frame 5 — flow-overview

- scene: El pipeline end-to-end en 4 pasos conectados horizontalmente con step-circles naranjas: 1 Ingesta → 2 Forecast → 3 Cálculo del bono → 4 Dashboard.
- on_screen: "El flujo end-to-end" / 1 Ingesta · 2 Forecast de lluvia · 3 Cálculo del bono · 4 Dashboard
- voiceover: ""
- duration: 7s
- transition_in: crossfade
- status: outline
- src: compositions/frames/05-flow-overview.html
- type: feature_showcase
- persuasion: Rule of three (cuatro pasos)
- beat: curiosity
- effects: center-outward-expansion, svg-path-draw, press-release-spring
- focal:
- roles:
- asset_candidates:

Entrada: el eyebrow + título "El flujo end-to-end" entra; los 4 step-circles parten agrupados del centro. Desarrollo: los 4 círculos se expanden a sus posiciones en fila (center-outward-expansion) y la línea conectora naranja se dibuja entre ellos paso a paso (svg-path-draw), con cada etiqueta apareciendo con un pequeño spring (press-release-spring). Asentamiento: el último conector llega a "Dashboard" y un push lento sostiene; las flechas mantienen dash-flow sutil.
narrativeRole: Da el mapa mental del sistema completo antes de entrar en cada etapa.
keyMessage: Cuatro etapas: ingesta → forecast → bono → dashboard.

## Frame 6 — step1-ingesta

- scene: Paso 1. Dos fuentes que entran: "Clima (APIs externas)" con chips OpenWeather · Open-Meteo · NOAA, y "Datos internos Rappi" con chips Oferta · Demanda. Convergen a un nodo "Ingesta". Nota "cada 15 min · por zona".
- on_screen: "1 · Ingesta de datos" / "Clima: OpenWeather · Open-Meteo · NOAA" / "Rappi: Oferta · Demanda" / "cada 15 min, por zona"
- voiceover: ""
- duration: 7s
- transition_in: push-slide LEFT
- status: outline
- src: compositions/frames/06-step1-ingesta.html
- type: feature_showcase
- persuasion: Demonstration of capability
- beat: confidence
- effects: center-outward-expansion, svg-path-draw, svg-icon-enrichment
- focal:
- roles:
- asset_candidates:

Entrada: header "1 · Ingesta de datos" + dos tarjetas-fuente (Clima arriba, Rappi abajo) entran por la izquierda. Desarrollo: los chips de cada fuente aparecen escalonados (center-outward-expansion) y líneas naranjas se dibujan desde ambas fuentes hacia un nodo central "Ingesta" (svg-path-draw); las líneas mantienen un dash-flow que sugiere datos fluyendo (svg-icon-enrichment). Asentamiento: el nodo central pulsa una vez y el plano se sostiene con dash-flow continuo.
narrativeRole: Muestra que el sistema combina clima externo + datos internos de oferta/demanda.
keyMessage: Ingesta combinada de clima y de oferta/demanda interna, por zona.

## Frame 7 — step2-forecast

- scene: Paso 2. Mini-gráfico de forecast de lluvia 72h por zona: barras de intensidad (none/light/moderate/heavy) con un pico, eje de tiempo, y un chip de confianza "82%". Color lluvia azul.
- on_screen: "2 · Forecast de lluvia por zona" / "72 h · intensidad none→heavy" / "Confianza 82%"
- voiceover: ""
- duration: 7s
- transition_in: push-slide LEFT
- status: outline
- src: compositions/frames/07-step2-forecast.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: clarity
- effects: stat-bars-and-fills, counting-dynamic-scale, svg-icon-enrichment
- focal:
- roles:
- asset_candidates:

Entrada: header "2 · Forecast de lluvia por zona" + el marco del gráfico (eje de tiempo 72h) entra por la izquierda. Desarrollo: las barras de intensidad de lluvia crecen escalonadas formando una curva con un pico (stat-bars-and-fills, en azul lluvia), y el chip de confianza cuenta hasta "82%" (counting-dynamic-scale); una pequeña nube/gota anima sobre el pico (svg-icon-enrichment). Asentamiento: el pico se resalta y un push lento sostiene.
narrativeRole: Demuestra el motor que predice lluvia por zona con nivel de confianza.
keyMessage: Forecast de intensidad de lluvia 72h por zona, con confianza.

## Frame 8 — step3-bono

- scene: Paso 3, el corazón. Ecuación visual: "Brecha de oferta × multiplicador de demanda → COP por entrega". Tres reglas en chips: "+$500", "tope $3.000", "30 min antes".
- on_screen: "3 · Cálculo del bono" / "Brecha de oferta × demanda → COP/entrega" / chips: "incrementos +$500" · "tope $3.000" · "30 min antes"
- voiceover: ""
- duration: 8s
- transition_in: push-slide LEFT
- status: outline
- src: compositions/frames/08-step3-bono.html
- type: feature_showcase
- persuasion: Feature-to-benefit translation
- beat: confidence
- effects: discrete-text-sequence, counting-dynamic-scale, kinetic-beat-slam
- focal:
- roles:
- asset_candidates:

Entrada: header "3 · Cálculo del bono" + los términos de la ecuación entran de izquierda a derecha (discrete-text-sequence): "Brecha de oferta" + "× demanda". Desarrollo: aparece la flecha "→" y el resultado "COP/entrega" se materializa con un count-up del monto (counting-dynamic-scale); luego los tres chips de reglas entran con golpe rítmico uno a uno (kinetic-beat-slam). Asentamiento: el resultado COP queda resaltado en naranja y push lento.
narrativeRole: Explica cómo se traduce el déficit de Rappiteneros a un monto concreto en COP, con reglas de negocio.
keyMessage: El bono se dimensiona para cerrar la brecha, redondeado y con tope, fijado antes de la lluvia.

## Frame 9 — example

- scene: La salida del sistema como notificación/tarjeta. Número grande naranja "+$1.200 COP / entrega". Debajo: "Chapinero — lluvia fuerte pronosticada en 45 min".
- on_screen: "+$1.200 COP / entrega" / "Chapinero — lluvia fuerte en 45 min"
- voiceover: ""
- duration: 6s
- transition_in: zoom-through
- status: outline
- src: compositions/frames/09-example.html
- type: benefit_highlight
- persuasion: Show-don't-tell proof
- beat: aha + confidence
- effects: counting-dynamic-scale, kinetic-beat-slam, sine-wave-loop
- blueprint: hook-counter-burst
- focal:
- roles:
- asset_candidates:

Base: hook-counter-burst · Keep: el número héroe que estalla al centro con burst de énfasis · Depart: el número es "+$1.200 COP / entrega"; debajo, en una tarjeta-notificación, "Chapinero — lluvia fuerte en 45 min".
Entrada: la tarjeta-notificación entra al centro. Desarrollo: el monto cuenta hasta "+$1.200" con un burst (counting-dynamic-scale + kinetic-beat-slam) y la línea de zona/ETA aparece debajo. Asentamiento (HOLD/clímax): el número respira sutil (sine-wave-loop) y el plano se sostiene como remate.
narrativeRole: Aterriza todo el pipeline en una recomendación concreta y accionable.
keyMessage: La salida es un bono concreto por zona, anticipado a la lluvia.

## Frame 10 — step4-dashboard

- scene: Paso 4. Mockup del dashboard de Ops estilo app Rappi (claro): mini-mapa de Bogotá con zonas coloreadas por nivel de bono + tabla resumen (Zona / Lluvia / Bono / Estado) + KPIs. Chip "en vivo · WebSocket".
- on_screen: "4 · Dashboard de operaciones" / "Mapa de zonas · bono por zona · tiempo real" / chip "en vivo"
- voiceover: ""
- duration: 8s
- transition_in: push-slide LEFT
- status: outline
- src: compositions/frames/10-step4-dashboard.html
- type: feature_showcase
- persuasion: Demonstration of capability
- beat: control
- effects: stat-bars-and-fills, counting-dynamic-scale, cursor-click-ripple
- blueprint: demo-page-scroll-spotlight
- focal:
- roles:
- asset_candidates:

Base: demo-page-scroll-spotlight · Keep: la maqueta de página con un spotlight que guía la mirada por las zonas de UI · Depart: la página es el dashboard de Ops claro (KPIs arriba, mini-mapa de zonas a la izquierda, tabla a la derecha), no una web genérica.
Entrada: el chrome del dashboard entra por la izquierda (header + chip "en vivo"). Desarrollo: los KPIs cuentan (counting-dynamic-scale), los puntos del mapa se colorean por nivel de bono y las filas de la tabla aparecen escalonadas; un cursor recorre con spotlight una zona crítica y hace click-ripple (cursor-click-ripple) resaltando su bono. Asentamiento: el spotlight reposa sobre la zona crítica y push lento.
narrativeRole: Muestra el producto terminado que Ops usa para supervisar, aprobar y ajustar bonos.
keyMessage: Ops ve y controla los bonos por zona en tiempo real.

## Frame 11 — why

- scene: El "por qué" de dos decisiones de diseño, en dos columnas: "Por zona, no por ciudad" y "En COP, no categorías".
- on_screen: "Por zona, no por ciudad" / "En COP, no categorías de riesgo"
- voiceover: ""
- duration: 6s
- transition_in: crossfade
- status: outline
- src: compositions/frames/11-why.html
- type: benefit_highlight
- persuasion: Empowerment and control
- beat: trust
- effects: split-tilt-cards, discrete-text-sequence, press-release-spring
- focal:
- roles:
- asset_candidates:

Entrada: el eyebrow "POR QUÉ ASÍ" + dos tarjetas entran con leve tilt desde lados opuestos (split-tilt-cards). Desarrollo: el texto de cada tarjeta se ensambla (discrete-text-sequence) — izquierda "Por zona, no por ciudad" (mini-mapa de zonas), derecha "En COP, no categorías" (un chip $ vs una etiqueta abstracta tachada); cada tarjeta cierra con un pequeño spring. Asentamiento: las dos tarjetas se nivelan y push lento.
narrativeRole: Justifica las decisiones de diseño clave que diferencian la solución.
keyMessage: Optimiza el gasto de incentivo calculando por zona y entregando COP accionables.

## Frame 12 — closing

- scene: Cierre. Logo Rappi centrado + "FleetWeather". Línea de stack en chips: "Node.js · Fastify · PostgreSQL+TimescaleDB · Redis · BullMQ · Next.js · WebSocket". Anillos concéntricos sutiles.
- on_screen: "FleetWeather" / "Bono dinámico por lluvia, end-to-end" / stack chips
- voiceover: ""
- duration: 8s
- transition_in: crossfade
- status: outline
- src: compositions/frames/12-closing.html
- type: branding
- beat: inevitability
- persuasion: Authority by association
- effects: discrete-text-sequence, center-outward-expansion, sine-wave-loop
- focal: assets/rappi-logo.svg
- roles: rappi-logo = cutout (héroe central del cierre)
- asset_candidates: assets/rappi-logo.svg — logo Rappi para el cierre de marca

Entrada: anillos concéntricos suaves se dibujan y el logo Rappi + "FleetWeather" se ensambla al centro (discrete-text-sequence). Desarrollo: la línea "Bono dinámico por lluvia, end-to-end" aparece y los chips del stack se despliegan en abanico desde el centro hacia abajo (center-outward-expansion). Asentamiento (frame final): el logo respira (sine-wave-loop); permitido un fundido suave de cierre.
narrativeRole: Cierra con marca, síntesis y la credibilidad del stack técnico.
keyMessage: Un sistema completo y técnico, listo, construido sobre un stack sólido.
