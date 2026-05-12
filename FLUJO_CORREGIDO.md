# Flujo Corregido - Preguntas y Timers

## ✅ Nuevo Flujo (CORREGIDO)

```
┌─────────────────────────────────────────────────────────────┐
│ START_GAME                                                  │
│ → currentQuestionIndex: -1 → 0                              │
│ → triggerNextQuestion()                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Pregunta #1: QUESTION_PREVIEW                              │
│ • SIN timer                                                 │
│ • Emit: NEW_QUESTION (startTime: 0)                         │
│ • Esperando que host presione START_TIMER                  │
│ • Status en cliente: "Vista previa"                         │
└────────────────┬────────────────────────────────────────────┘
                 │
         Host presiona START_TIMER
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Timer Iniciado                                              │
│ • status: QUESTION_PREVIEW → PLAYING                        │
│ • Emit: TIMER_STARTED (startTime, duration: 20000ms)       │
│ • Cronómetro comienza en cliente                            │
│ • questionStartTime = Date.now()                            │
└────────────────┬────────────────────────────────────────────┘
                 │
      Espera 20 segundos O todos responden
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Resultados                                                  │
│ • status: PLAYING → QUESTION_RESULTS                        │
│ • Emit: SHOW_RESULTS (stats, correctAnswer)                │
│ • Mostrando durante 8 segundos                              │
└────────────────┬────────────────────────────────────────────┘
                 │
      Espera 8 segundos (auto-avance)
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Pregunta #2: QUESTION_PREVIEW ✅ CONSISTENTE               │
│ • currentQuestionIndex: 0 → 1                               │
│ • SIN timer                                                 │
│ • Emit: NEW_QUESTION (startTime: 0)                         │
│ • Esperando que host presione START_TIMER                  │
│ • Status en cliente: "Vista previa"                         │
│ ✅ IGUAL QUE PREGUNTA #1                                   │
└────────────────┬────────────────────────────────────────────┘
                 │
         Host presiona START_TIMER
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Timer Iniciado (igual que antes)                            │
│ • Emit: TIMER_STARTED                                       │
│ • Cronómetro se reinicia en cliente ✅                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
      [Repetir hasta última pregunta...]
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ GAME_FINISHED                                               │
│ • Emit: GAME_FINISHED (ranking final)                       │
│ • Mostrar ganadores                                         │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Comparativa

### ANTES (PROBLEMÁTICO)
| Pregunta | Estado | Control | Preview | Timer |
|----------|--------|---------|---------|-------|
| 1ª | PREVIEW | Manual (Host) | ✅ Sí | No |
| 2ª+ | PLAYING | ❌ Auto | ❌ No | Sí (auto) |
| Reinicio Timer | - | ❌ Inconsistente | - | ❌ Sin TIMER_STARTED |

### DESPUÉS (CORREGIDO)
| Pregunta | Estado | Control | Preview | Timer |
|----------|--------|---------|---------|-------|
| 1ª | PREVIEW | ✅ Manual (Host) | ✅ Sí | No |
| 2ª+ | PREVIEW | ✅ Manual (Host) | ✅ Sí | No |
| Reinicio Timer | - | ✅ CONSISTENTE | - | ✅ TIMER_STARTED siempre |

## 🔄 Cambios en el Código

### `triggerNextQuestion()`
```javascript
// ANTES: Si pregunta > 1, automáticamente inicia PLAYING con timer
if (isFirstQuestion) {
  room.status = RoomStatus.QUESTION_PREVIEW;
} else {
  room.status = RoomStatus.PLAYING;  // ❌ AUTOMÁTICO
  room.timer = setTimeout(...);
}

// DESPUÉS: SIEMPRE PREVIEW
room.status = RoomStatus.QUESTION_PREVIEW;
// ✅ NO auto-iniciar timer
// ✅ El host controla con START_TIMER
```

### `startPlayingTimer()`
```javascript
// ANTES: Funciona, pero logging mínimo

// DESPUÉS: 
// ✓ Mejor logging
// ✓ Limpieza de timer anterior
// ✓ Verifica estado PREVIEW
// ✓ Transición clara PREVIEW → PLAYING
```

### `triggerShowResults()`
```javascript
// ANTES: Auto-avance con triggerNextQuestion (que iniciaba timer automático)

// DESPUÉS:
// ✓ Auto-avance con triggerNextQuestion
// ✓ triggerNextQuestion ahora deja en PREVIEW
// ✓ Host debe presionar START_TIMER para siguiente pregunta
```

## ✨ Beneficios

✅ **Consistencia total**: Mismo flujo para todas las preguntas  
✅ **Control manual**: Host controla el ritmo del juego  
✅ **Mejor experiencia**: Jugadores ven preview de cada pregunta  
✅ **Sincronización correcta**: Timer se reinicia con TIMER_STARTED  
✅ **Debugging fácil**: Logging claro y descriptivo  
✅ **Predecible**: Flujo sin sorpresas automáticas

## 🧪 Cómo Probar

1. **Crear sala** con preguntas
2. **Host presiona START_GAME** → Ver QUESTION_PREVIEW
3. **Host presiona START_TIMER** → Timer comienza (Emit TIMER_STARTED)
4. **Esperar a que expire o responder** → Ver resultados
5. **Auto-avance después de 8s** → Nueva pregunta en PREVIEW
6. **Repetir paso 3** → Timer debe reiniciarse correctamente ✓

### Log esperado:
```
✓ Timer started for room ABC123 (20000ms)
📊 Results shown for room ABC123: Q1
⏭️  Auto-advancing to next question in room ABC123
New question in room ABC123: index 1 (PREVIEW - waiting for START_TIMER)
✓ Timer started for room ABC123 (20000ms)
```
