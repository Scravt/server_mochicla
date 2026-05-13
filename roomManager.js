import { RoomStatus, GameConfig } from "./constants.js";

/**
 * Genera un código de sala único
 */
export function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Crea una nueva sala de juego
 */
export function createRoom(questions, hostId, hostName) {
  const roomCode = generateRoomCode();
  
  const roomData = {
    code: roomCode,
    hostId,
    status: RoomStatus.LOBBY,
    players: [
      {
        id: hostId,
        name: hostName || GameConfig.DEFAULT_HOST_NAME,
        score: 0,
        totalCorrect: 0,
        totalTime: 0,
        isHost: true,
      }
    ],
    questions,
    currentQuestionIndex: -1,
    questionStartTime: 0,
    questionDuration: GameConfig.QUESTION_DURATION,
    timer: null,
    submissions: new Map(), // Respuestas por ronda
  };
  
  return { code: roomCode, data: roomData };
}

/**
 * Añade un jugador a una sala
 */
export function addPlayerToRoom(room, playerId, playerName) {
  const newPlayer = {
    id: playerId,
    name: playerName,
    score: 0,
    totalCorrect: 0,
    totalTime: 0,
    isHost: false,
  };
  
  room.players.push(newPlayer);
  return newPlayer;
}

/**
 * Elimina un jugador de una sala
 */
export function removePlayerFromRoom(room, playerId) {
  const index = room.players.findIndex(p => p.id === playerId);
  if (index !== -1) {
    room.players.splice(index, 1);
  }
}

/**
 * Obtiene los jugadores que no son el host
 */
export function getNonHostPlayers(room) {
  return room.players.filter(p => !p.isHost);
}

/**
 * Ordena jugadores por puntuación (descendente)
 */
export function sortPlayersByScore(players) {
  return [...players].sort((a, b) => b.score - a.score);
}

/**
 * Ordena jugadores por estadísticas de juego
 * Criterios: 1) Mayor cantidad de respuestas correctas, 2) Menor tiempo acumulado
 */
export function sortPlayersByStats(players) {
  return [...players].sort((a, b) => {
    // Primero: mayor cantidad de respuestas correctas
    if (a.totalCorrect !== b.totalCorrect) {
      return b.totalCorrect - a.totalCorrect;
    }
    // Si son iguales: menor tiempo acumulado
    return a.totalTime - b.totalTime;
  });
}

/**
 * Limpia los datos de una sala (timers, etc.)
 */
export function cleanupRoom(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}
