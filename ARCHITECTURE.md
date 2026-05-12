# Arquitectura del Servidor Mochicla

## Descripción General
Este es un servidor de juego trivial en tiempo real basado en **Express** y **Socket.IO**. El código ha sido refactorizado en módulos para mejorar la legibilidad y mantenibilidad.

## Estructura de Archivos

### `index.js` (Punto de entrada)
- **Responsabilidad**: Orquesta la inicialización del servidor
- **Qué hace**: Carga todos los módulos, configura Express, Socket.IO y inicia el listener
- **Líneas**: ~45 (simplificado de ~300+)

### `constants.js` (Constantes y configuración)
- **Enumeraciones**: `RoomStatus`, `SocketEvents`
- **Configuración**: `GameConfig` (duraciones, puntuaciones, etc.)
- **Propósito**: Centralizar valores mágicos evita duplicación y facilita cambios globales

### `roomManager.js` (Gestión de salas)
Funciones para manipular el estado de las salas:
- `generateRoomCode()` - Genera códigos únicos
- `createRoom()` - Crea nueva sala
- `addPlayerToRoom()` - Agrega jugador
- `removePlayerFromRoom()` - Elimina jugador
- `getNonHostPlayers()` - Filtra jugadores no-host
- `sortPlayersByScore()` - Ordena por puntuación
- `cleanupRoom()` - Libera recursos (timers)

### `gameEngine.js` (Lógica del juego)
Funciones de la mecánica de juego:
- `calculateScore()` - Calcula puntos (corrección + velocidad)
- `processPlayerAnswer()` - Procesa respuesta de jugador
- `collectAnswerStats()` - Recolecta estadísticas de respuestas
- `prepareNextQuestionPayload()` - Genera datos para siguiente pregunta
- `allPlayersSubmitted()` - Verifica si todos respondieron
- `prepareGameResults()` - Genera clasificación final
- `hasMoreQuestions()` - Comprueba si hay más preguntas

### `socketHandlers.js` (Manejadores de eventos Socket.IO)
Gestiona toda la comunicación Socket.IO:
- **Evento `create-room`** - Host crea sala
- **Evento `join-room`** - Jugador se une a sala
- **Evento `start-game`** - Host inicia el juego
- **Evento `start-timer`** - Host inicia temporizador
- **Evento `submit-answer`** - Jugador envía respuesta
- **Evento `next-question`** - Host avanza a siguiente pregunta
- **Evento `disconnect`** - Limpieza al desconectar

Funciones internas (privadas):
- `startPlayingTimer()` - Inicia timer automático
- `triggerNextQuestion()` - Avanza a siguiente pregunta
- `triggerShowResults()` - Muestra resultados
- `finishGame()` - Finaliza el juego

### `serverSetup.js` (Configuración del servidor)
Funciones de inicialización:
- `setupExpress()` - Configura aplicación Express
- `setupSocketIO()` - Configura servidor Socket.IO
- `setupApiRoutes()` - Rutas API (/health)
- `setupStaticFiles()` - Sirve archivos estáticos o Vite
- `startListener()` - Inicia el servidor en puerto

## Flujo de un Juego

```
1. Host crea sala (create-room)
   └─ generateCode + createRoom()
   
2. Jugadores se unen (join-room)
   └─ addPlayerToRoom() para cada jugador
   
3. Host inicia juego (start-game)
   └─ triggerNextQuestion() para primera pregunta (PREVIEW)
   
4. Pregunta en PREVIEW (sin timer)
   └─ Host presiona START_TIMER
   └─ Emite TIMER_STARTED para sincronizar cliente
   
5. Timer comienza (20 segundos)
   └─ Status: PLAYING
   
6. Jugadores envían respuestas (submit-answer)
   └─ processPlayerAnswer() + calculateScore()
   └─ Si todos responden → triggerShowResults() inmediatamente
   └─ Si timeout → triggerShowResults() automáticamente
   
7. Mostrar resultados (8 segundos)
   └─ collectAnswerStats() + prepareResultsPayload()
   └─ Auto-avance a siguiente pregunta
   
8. SIGUIENTE PREGUNTA EN PREVIEW (igual que paso 4)
   └─ currentQuestionIndex: incrementado
   └─ Sin timer
   └─ Host presiona START_TIMER nuevamente ✅ CONSISTENTE
   
9. Repetir desde paso 5 hasta terminar preguntas
   
10. Fin del juego
    └─ prepareGameResults() + sortPlayersByScore()
```

**MEJORA**: Todas las preguntas tienen el mismo flujo (PREVIEW + control manual del host).

## Ventajas de la Refactorización

| Aspecto | Antes | Después |
|--------|-------|---------|
| **Líneas en index.js** | ~330 | ~45 |
| **Modularidad** | Monolítico | 6 módulos |
| **Testabilidad** | Difícil | Fácil (funciones puras) |
| **Reusabilidad** | Baja | Alta |
| **Mantenibilidad** | Compleja | Simple |
| **Legibilidad** | Confusa | Clara |

## Cómo Extender

### Agregar nueva funcionalidad de juego
→ Editar `gameEngine.js` y `socketHandlers.js`

### Agregar nueva configuración
→ Agregar a `constants.js`

### Crear nueva sala de juego
→ Usar `roomManager.js::createRoom()`

### Cambiar duración de preguntas
```js
// constants.js
GameConfig.QUESTION_DURATION = 30000; // 30 segundos
```

## Eventos Socket.IO Disponibles

**Cliente → Servidor:**
- `create-room` → Crea nueva sala
- `join-room` → Se une a sala existente
- `start-game` → Inicia juego
- `start-timer` → Inicia timer de pregunta
- `submit-answer` → Envía respuesta
- `next-question` → Salta a siguiente pregunta

**Servidor → Cliente:**
- `room-created` → Sala creada exitosamente
- `player-joined` → Jugador se unió
- `joined-successfully` → Confirmación de unión
- `new-question` → Nueva pregunta disponible
- `timer-started` → Timer iniciado
- `show-results` → Mostrar resultados
- `game-finished` → Juego terminado
- `submission-update` → Progreso de respuestas
- `error` → Error en operación
