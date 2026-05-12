/**
 * ANÁLISIS DEL FLUJO DE PREGUNTAS Y TIMERS
 * 
 * OBSERVACIÓN CRÍTICA: Hay un problema de inconsistencia en el flujo
 */

// FLUJO ACTUAL:
// ============

// 1. START_GAME
//    → triggerNextQuestion(roomCode)
//    → currentQuestionIndex: -1 → 0
//    → status: QUESTION_PREVIEW
//    → NO timer iniciado ✓
//    → Emit NEW_QUESTION

// 2. Host presiona START_TIMER (solo en primera pregunta)
//    → startPlayingTimer(room)
//    → status: PLAYING
//    → questionStartTime: Date.now()
//    → Inicia timer 20s ✓
//    → Emit TIMER_STARTED

// 3. Jugadores responden...
//    → Si todos responden antes de 20s: triggerShowResults() inmediatamente
//    → Si timeout 20s: triggerShowResults() automáticamente

// 4. triggerShowResults() se ejecuta
//    → Clear timer de PLAYING ✓
//    → status: QUESTION_RESULTS
//    → Emit SHOW_RESULTS con stats
//    → Inicia timer 8s para auto-avance ✓

// 5. Después de 8 segundos
//    → triggerNextQuestion() se llama automáticamente
//    → currentQuestionIndex: 0 → 1
//    → status: PLAYING ⚠️ PROBLEMA AQUÍ
//    → questionStartTime: Date.now() ⚠️ PROBLEMA AQUÍ
//    → ✗ INICIA TIMER AUTOMÁTICAMENTE 20s ⚠️ PROBLEMA AQUÍ
//    → Emit NEW_QUESTION (sin preview)

// PROBLEMAS IDENTIFICADOS:
// ========================

// PROBLEMA 1: Inconsistencia en el flujo
// - Primera pregunta: PREVIEW → espera START_TIMER del host
// - Segunda pregunta en adelante: Automáticamente PLAYING con timer iniciado
// - Esto es inconsistente: el host no tiene control manual

// PROBLEMA 2: Sin preview para siguientes preguntas
// - Primera pregunta: PREVIEW (host puede ver pregunta antes de timer)
// - Siguientes: Directamente PLAYING (no hay preview)
// - Los jugadores no ven la pregunta antes del timer

// PROBLEMA 3: Timer no reinicia correctamente visualmente
// - El cliente recibe startTime y duration en TIMER_STARTED
// - Pero cuando AUTO-avanzamos desde resultados, no emitimos TIMER_STARTED
// - Solo emitimos NEW_QUESTION
// - El cliente puede no reiniciar el cronómetro visual correctamente

console.log("Ver /ANALYSIS.md para detalles de los problemas");
