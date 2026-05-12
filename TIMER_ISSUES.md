# Problemas Encontrados - Flujo de Preguntas y Timers

## 🔴 PROBLEMA 1: Inconsistencia en el flujo entre preguntas

**Situación actual:**
- **Primera pregunta**: 
  - Estado: `QUESTION_PREVIEW` (sin timer)
  - El host debe presionar `START_TIMER` manualmente
  
- **Segunda pregunta en adelante**: 
  - Estado: `PLAYING` con timer iniciado **automáticamente**
  - El host NO tiene control manual
  - No hay fase de preview

**Impacto**: El host no tiene consistencia: la primera pregunta requiere acción manual, pero las siguientes se disparan automáticamente.

---

## 🔴 PROBLEMA 2: Falta de preview en siguientes preguntas

**Situación actual:**
- Primera pregunta: Host ve pregunta → presiona START_TIMER → comienza juego
- Siguientes: Auto-avanzan directamente a PLAYING sin mostrar preview

**Impacto**: Los jugadores NO ven la pregunta antes de que comience el timer (excepto en la primera).

---

## 🔴 PROBLEMA 3: Timer no se reinicia correctamente en el cliente

**En `triggerNextQuestion` cuando es pregunta 2+:**
```javascript
// Se emite solo NEW_QUESTION
io.to(roomCode).emit(SocketEvents.NEW_QUESTION, payload);

// ❌ NO se emite TIMER_STARTED
// El cliente NO sabe que debe reiniciar su cronómetro visual
```

**Impacto**: El cliente puede no sincronizar el cronómetro visual correctamente cuando auto-avanza.

---

## 📊 Flujo Actual (con problemas)

```
START_GAME
   ↓
Pregunta #1: PREVIEW (sin timer) ← Host presiona START_TIMER
   ↓
Resultado mostrado por 8s
   ↓
Pregunta #2: PLAYING (timer ya corriendo) ⚠️ Automático
   ├─ Sin preview
   ├─ Sin control del host
   └─ Sin TIMER_STARTED
   ↓
Resultado mostrado por 8s
   ↓
Pregunta #3: PLAYING (igual problema)
```

---

## ✅ Flujo Recomendado (Solución)

```
START_GAME
   ↓
Pregunta #1: PREVIEW (sin timer)
   ├─ Host presiona START_TIMER
   ├─ Emite TIMER_STARTED ✓
   └─ Juego comienza
   ↓
Resultado mostrado por 8s
   ↓
Pregunta #2: PREVIEW (sin timer) ← Consistente
   ├─ Host presiona START_TIMER
   ├─ Emite TIMER_STARTED ✓
   └─ Juego comienza
   ↓
Resultado mostrado por 8s
   ↓
[Repetir para siguiente pregunta...]
```

---

## 🔧 Cambios Necesarios

### En `triggerNextQuestion`:
- Siempre establecer `QUESTION_PREVIEW` (no solo primera pregunta)
- NO iniciar timer automáticamente
- Permitir que el host controle el timer manualmente

### En `startPlayingTimer`:
- Asegurar que se emita `TIMER_STARTED` cada vez

### En `triggerShowResults`:
- Auto-avance a siguiente pregunta pero en estado `PREVIEW`
- NO auto-iniciar el timer

---

## 🎯 Beneficios de la solución

✅ **Consistencia**: El flujo es igual para todas las preguntas  
✅ **Control**: El host tiene control manual del juego  
✅ **Visibilidad**: Los jugadores ven cada pregunta antes de jugar  
✅ **Sincronización**: Timer se reinicia correctamente en cliente  
✅ **Claridad**: Flujo predecible y entendible
