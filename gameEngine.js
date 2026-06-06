import { RoomStatus, GameConfig, SocketEvents } from "./constants.js";
import { getNonHostPlayers, sortPlayersByScore, cleanupRoom } from "./roomManager.js";

/**
 * Calcula la puntuación del jugador basándose en velocidad y corrección
 */
export function calculateScore(isCorrect, timeTaken, maxTime) {
  if (!isCorrect) return 0;
  
  // Puntuación base + bonus por rapidez
  const speedBonus = Math.max(0, maxTime - timeTaken);
  return Math.floor(GameConfig.BASE_SCORE + (speedBonus / maxTime) * GameConfig.SPEED_BONUS_MULTIPLIER);
}

/**
 * Procesa la respuesta enviada por un jugador
 */
export function processPlayerAnswer(room, socketId, answerIndex) {
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || player.isHost) return null;
  
  // Evitar respuestas duplicadas
  if (room.submissions.has(player.id)) return null;
  
  const now = Date.now();
  const timeTaken = now - room.questionStartTime;
  const question = room.questions[room.currentQuestionIndex];
  const isCorrect = answerIndex === question.correctAnswer;
  
  const score = calculateScore(isCorrect, timeTaken, room.questionDuration);
  
  if (isCorrect) {
    player.score += score;
    player.totalCorrect += 1;
  }
  
  room.submissions.set(player.id, { isCorrect, score, timeTaken, answerIndex });
  
  return { isCorrect, score, timeTaken, answerIndex };
}

/**
 * Recolecta estadísticas de respuestas
 */
export function collectAnswerStats(room) {
  const question = room.questions[room.currentQuestionIndex];
  
  const stats = {
    correctAnswer: question.correctAnswer,
    distribution: new Array(GameConfig.MAX_OPTIONS).fill(0),
  };
  
  room.submissions.forEach((sub) => {
    if (sub.answerIndex >= 0 && sub.answerIndex < GameConfig.MAX_OPTIONS) {
      stats.distribution[sub.answerIndex]++;
    }
  });
  
  return stats;
}

/**
 * Genera el payload para la siguiente pregunta
 * 
 * NOTA: Ahora siempre estamos en PREVIEW, así que startTime siempre es 0
 */
export function prepareNextQuestionPayload(room, questionIndex) {
  return {
    question: room.questions[questionIndex],
    index: questionIndex,
    total: room.questions.length,
    startTime: 0, // Siempre 0 en PREVIEW (sin timer iniciado aún)
    duration: room.questionDuration,
  };
}

/**
 * Verifica si todos los jugadores (no-host) han respondido
 */
export function allPlayersSubmitted(room) {
  const nonHostPlayers = getNonHostPlayers(room);
  const connectedPlayers = nonHostPlayers.filter(p => p.isConnected);
  
  // Contamos cuantas de las submissions son de jugadores conectados
  let connectedSubmissions = 0;
  connectedPlayers.forEach(p => {
    if (room.submissions.has(p.id)) connectedSubmissions++;
  });
  
  return connectedSubmissions === connectedPlayers.length && connectedPlayers.length > 0;
}

/**
 * Genera datos finales del juego
 */
export function prepareGameResults(room) {
  return sortPlayersByScore(room.players);
}

/**
 * Genera payload de resultados de pregunta
 */
export function prepareResultsPayload(room) {
  const stats = collectAnswerStats(room);
  
  return {
    players: room.players,
    correctAnswer: room.questions[room.currentQuestionIndex].correctAnswer,
    stats,
    startTime: Date.now(),
    duration: GameConfig.RESULTS_DURATION
  };
}

/**
 * Comprueba si hay más preguntas disponibles
 */
export function hasMoreQuestions(room) {
  return room.currentQuestionIndex + 1 < room.questions.length;
}
