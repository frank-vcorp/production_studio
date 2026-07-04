# Guía de Prompt Engineering

> Cómo escribir intenciones humanas que produzcan spots AIDA efectivos.
> Spec: SPEC-S6-TESTS-CICD §6.5 + transversal a S1-S5.

## Filosofía

La intención humana es tu **visión creativa libre**. Describe QUÉ quieres comunicar, no CÓMO filmarlo. El sistema añade automáticamente:

- Estructura de cámara según el nodo AIDA
- Tono según sector (paleta, mood, pacing)
- Iluminación y grading cinematográfico

## Estructura de un nodo AIDA

Cada nodo recibe 4 componentes de prompt:

| Componente | Origen | Ejemplo |
|---|---|---|
| **Intención humana** | Usuario | "Empezar mostrando el problema" |
| **Estructura de cámara** | Sistema (auto) | "macro probe 120fps, foco en detalle" |
| **Estilo global** | Brief (auto-derivado) | "Cinematográfico moderno, contrastes marcados" |
| **Tono de sector** | Template (auto) | automotriz → "confianza, rapidez, profesionalismo" |

El `promptBuilder` ensambla los 4 en orden: `[INTENCIÓN] [CÁMARA] [ESTILO] [TONO]`.

## Reglas de oro

### 1. Sé concreto sobre QUÉ, vago sobre CÓMO

**Bueno:**
- "Empezar mostrando el filtro viejo con aceite quemado en manos con grasa"
- "Aceite dorado nuevo fluyendo sobre motor limpio"
- "Cerrar con la tarjeta de contacto y el logo"

**Malo:**
- "Steadicam dolly 35mm con aperture f/1.8, 1/60s" → esto lo añade el sistema
- "Luz natural 5600K con bounce card" → redundante con el estilo global

### 2. Piensa en beats, no en segundos

Cada nodo dura 3-7s. La intención debe cubrir ese beat completo:

- **Atención (3-5s)**: gancho visual + texto impactante (si aplica)
- **Interés (5-7s)**: recorrido / comparación / explicación
- **Deseo (5-7s)**: transformación / resultado / métrica
- **Acción (3-5s)**: CTA claro (WhatsApp, Maps, QR)

### 3. Usa verbos activos

"Mostrar", "Recorrer", "Cerrar", "Comparar", "Transicionar".

Evita: "Se ve", "Hay", "Aparece" (pasivo, sin dirección).

## Estructura de cámara por nodo (auto)

| Nodo | Cámara | Razón |
|---|---|---|
| Bumper (3s) | Logo reveal | Identidad de marca |
| Atención | macro probe 120fps | Impacto visual, detalle extremo |
| Interés | steadicam dolly | Recorrido del espacio, contexto |
| Deseo | macro close-up | Transformación, detalle del resultado |
| Acción | static + zoom out | CTA claro, frame estable para texto |
| CTA Final | graphic card | Logo + contacto + Maps |

## Tonos por sector

### Automotriz

- Palabras clave: **confianza, rapidez, profesionalismo, honestidad**
- Pacing: rápido
- Paleta: azul/gris acero
- Evitar: promesas exageradas, texto en pantalla

### Estética

- Palabras clave: **belleza, autocuidado, transformación, bienestar**
- Pacing: balanceado
- Paleta: tonos cálidos pastel
- Evitar: dramatismo excesivo, comparación agresiva

### Comida

- Palabras clave: **apetito, sabor, tradición, satisfacción**
- Pacing: balanceado con beat final lento
- Paleta: tonos cálidos saturados
- Evitar: grotesco, precios visibles

### Salud

- Palabras clave: **cuidado, profesionalismo, confianza, salud**
- Pacing: calmado
- Paleta: blancos/azules clínicos
- Evitar: alarmismo, garantías absolutas

### Inmobiliaria

- Palabras clave: **aspiración, espacio, oportunidad, inversión**
- Pacing: cinematico
- Paleta: tonos neutros luminosos
- Evitar: promesas exageradas, fotos de stock genéricas

## Ejemplos completos por sector

### Automotriz — Cambio de aceite

**Atención:**
> Primer plano de filtro viejo con aceite quemado en manos con grasa. Texto: '¿Cuándo cambiaste el aceite DE VERDAD?'

**Interés:**
> Recorrido por boxes limpios, pared de aceites ordenada con certificación ISO visible.

**Deseo:**
> Aceite dorado nuevo fluyendo por motor limpio. Métrica visible: '15,000 km garantizado'.

**Acción:**
> Tarjeta final con logo + WhatsApp + Maps + fondo del taller real.

### Estética — Corte + color

**Atención:**
> Espejo reflejando cabello dañado, puntas abiertas y color apagado. Texto sutil: '¿Tu cabello pide más?'

**Interés:**
> Recorrido por salón iluminado, productos premium exhibidos, estilista con delantal limpio preparando herramientas.

**Deseo:**
> Manos aplicando tinte con pincel sobre cabello sano, color vibrante brillando bajo luz natural.

**Acción:**
> Reserva tu cita con WhatsApp directo, fondo del salón real con cliente sonriendo.

### Comida — Pizza artesanal

**Atención:**
> Masa fresca siendo estirada a mano, harina cayendo en cámara lenta.

**Interés:**
> Recorrido por cocina con horno de leña encendido,ingredients frescos alineados en tabla de madera.

**Deseo:**
> Pizza saliendo del horno, queso derretido estirándose al primer corte, vapor visible.

**Acción:**
> Logo del restaurante + dirección + Maps + delivery por WhatsApp.

## Anti-patrones

- **"Video genérico de stock"** → el sistema detecta y degrada a fallback
- **"Mujer sonriendo a cámara"** → no funciona, no aporta narrativa
- **"Texto: COMPRA AHORA"** → agresividad reduce engagement
- **"Múltiples productos a la vez"** → confunde, mejor un foco por nodo
- **"Cinemático con drones"** → no aplica a 5-7s de duración, parecerá improvisado

## Iteración

1. Empieza con el template del sector (3 servicios pre-llenados).
2. Ajusta la intención de cada nodo en el Storyboard.
3. Aprueba el prompt y genera el lote.
4. Si el resultado no convence:
   - Edita el prompt y regenera solo ese clip (S4 edición granular).
   - Versiona el cambio (max 5 por nodo).
   - Si la versión anterior gustaba más, vuelve a ella.

## Longitud óptima

- **Mínimo**: 5 palabras (ej: "Mostrar aceite dorado fluyendo").
- **Óptimo**: 10-25 palabras.
- **Máximo útil**: 50 palabras (más allá el modelo resume solo).

El sistema trunca silenciosamente a 80 palabras para mantener el `prompt tokens` dentro del budget de Veo.