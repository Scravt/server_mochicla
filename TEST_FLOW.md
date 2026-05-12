# Test del Flujo Corregido

## Caso de Prueba: Juego Completo con 2 Preguntas

### Setup
```javascript
// Crear conexión y sala con 2 preguntas
const questions = [
  {
    text: "¿Cuál es la capital de Francia?",
    options: ["Londres", "París", "Berlín", "Madrid"],
    correctAnswer: 1
  },
  {
    text: "¿Cuál es 2 + 2?",
    options: ["3", "4", "5", "6"],
    correctAnswer: 1
  }
];

socket.emit('create-room', { questions, hostName: 'Host' });
// → Sala creada con código: ABC123
```

---

## Secuencia Esperada

### 1. Host inicia juego
```
socket.emit('start-game', 'ABC123');

SERVER LOG:
✓ New question in room ABC123: index 0 (PREVIEW - waiting for START_TIMER)

CLIENT RECIBE:
{
  event: "new-question",
  data: {
    question: { text: "¿Cuál es la capital...", options: [...] },
    index: 0,
    total: 2,
    startTime: 0,        ← No hay timer
    duration: 20000
  }
}

ESTADO ESPERADO:
- Pregunta visible
- Sin cronómetro corriendo
- Botón "Comenzar" habilitado
```

### 2. Host presiona START_TIMER
```
socket.emit('start-timer', 'ABC123');

SERVER LOG:
✓ Timer started for room ABC123 (20000ms)

CLIENT RECIBE:
{
  event: "timer-started",
  data: {
    startTime: 1234567890,     ← Timestamp actual
    duration: 20000            ← 20 segundos
  }
}

ESTADO ESPERADO:
- Cronómetro visual inicia contando de 20s → 0
- Botones de respuesta habilitados
- "La pregunta #1 de 2"
```

### 3. Los jugadores responden
```
Player1: socket.emit('submit-answer', { roomCode: 'ABC123', answerIndex: 1 });
Player2: socket.emit('submit-answer', { roomCode: 'ABC123', answerIndex: 1 });

HOST RECIBE (actualización de progreso):
{
  event: "submission-update",
  data: { count: 1, total: 2 }
}
{
  event: "submission-update",
  data: { count: 2, total: 2 }
}

SERVER LOG:
[Player1 responde correctamente]
[Player2 responde correctamente]
[Todas las respuestas recolectadas]

CUANDO TODOS RESPONDEN:
→ Avanza inmediatamente a resultados (no espera 20s)
```

### 4. Mostrar Resultados
```
SERVER LOG:
📊 Results shown for room ABC123: Q1

TODOS RECIBEN:
{
  event: "show-results",
  data: {
    players: [
      { id: "h1", name: "Host", score: 0, totalCorrect: 0, isHost: true },
      { id: "p1", name: "Player1", score: 1900, totalCorrect: 1, isHost: false },
      { id: "p2", name: "Player2", score: 1850, totalCorrect: 1, isHost: false }
    ],
    correctAnswer: 1,
    stats: {
      correctAnswer: 1,
      distribution: [0, 2, 0, 0]   ← 2 personas eligieron opción 1
    },
    startTime: 1234567900,
    duration: 8000                 ← Mostrar por 8 segundos
  }
}

ESTADO ESPERADO:
- "¡Correcto! 2 jugadores acertaron"
- Ranking temporal mostrado
- Cronómetro de 8s para siguiente pregunta
```

### 5. Auto-avance a Pregunta #2
```
DESPUÉS DE 8 SEGUNDOS:

SERVER LOG:
⏭️  Auto-advancing to next question in room ABC123
✓ New question in room ABC123: index 1 (PREVIEW - waiting for START_TIMER)

TODOS RECIBEN:
{
  event: "new-question",
  data: {
    question: { text: "¿Cuál es 2 + 2?", options: [...] },
    index: 1,
    total: 2,
    startTime: 0,        ← ✅ SIN TIMER (PREVIEW)
    duration: 20000
  }
}

ESTADO ESPERADO:
- Nueva pregunta visible
- Sin cronómetro corriendo
- ✅ IGUAL QUE PASO 1 (CONSISTENTE)
```

### 6. Host presiona START_TIMER nuevamente
```
socket.emit('start-timer', 'ABC123');

SERVER LOG:
✓ Timer started for room ABC123 (20000ms)   ← ✅ TIMER REINICIADO

CLIENT RECIBE:
{
  event: "timer-started",
  data: {
    startTime: 1234567920,
    duration: 20000
  }
}

ESTADO ESPERADO:
- ✅ Cronómetro se reinicia (20s → 0)
- ✅ Pregunta #2 de 2
```

### 7-9. Segunda pregunta (repite flujo de pasos 3-5)

### 10. Fin del juego
```
SERVER LOG:
🏁 Game finished in room ABC123
📈 Final standings: 1. Player2: 3750pts, 2. Player1: 3800pts

TODOS RECIBEN:
{
  event: "game-finished",
  data: [
    { id: "p1", name: "Player1", score: 3800, totalCorrect: 2, isHost: false },
    { id: "p2", name: "Player2", score: 3750, totalCorrect: 2, isHost: false },
    { id: "h1", name: "Host", score: 0, totalCorrect: 0, isHost: true }
  ]
}

ESTADO ESPERADO:
- Pantalla de "Juego Finalizado"
- Ranking final con ganador
- Botón para volver al menú
```

---

## ✅ Verificaciones Importantes

### Timer Reset
- [ ] Timer de pregunta 1 expira/se limpia antes de mostrar resultados
- [ ] Timer de resultados (8s) se completa
- [ ] Pregunta 2 inicia en PREVIEW (sin timer)
- [ ] Cuando host presiona START_TIMER, se emite TIMER_STARTED con nuevo timestamp
- [ ] Cronómetro en cliente se reinicia correctamente

### Consistencia
- [ ] Pregunta 1 y Pregunta 2 tienen el mismo flujo (PREVIEW → manual START_TIMER)
- [ ] No hay auto-inicio de timer para pregunta 2
- [ ] Host mantiene control manual en ambas preguntas

### Sincronización
- [ ] `startTime` en TIMER_STARTED coincide con `Date.now()` en servidor
- [ ] Cliente calcula correctamente el tiempo restante
- [ ] Timeout ocurre aproximadamente a los 20s (±100ms)

---

## Cómo Ejecutar una Prueba Manual

1. **Terminal 1**: Iniciar servidor
   ```bash
   npm run dev
   ```

2. **Terminal 2**: Abrir cliente web
   ```
   http://localhost:5173
   ```

3. **Inspeccionar Network Tab**:
   - Ver eventos WebSocket
   - Verificar que TIMER_STARTED se emite después de START_TIMER
   - Confirmar NEW_QUESTION tiene startTime: 0 para PREVIEW

4. **Inspeccionar Console**:
   - Ver logs del servidor
   - Buscar: "✓ Timer started"
   - Buscar: "⏭️  Auto-advancing"
