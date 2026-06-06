import { RoomStatus, GameConfig } from "./constants.js";
import crypto from "crypto";

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
  
  const hostPlayerId = crypto.randomUUID();
  
  const roomData = {
    code: roomCode,
    hostId: hostPlayerId,
    status: RoomStatus.LOBBY,
    players: [
      {
        id: hostPlayerId,
        socketId: hostId,
        name: hostName || GameConfig.DEFAULT_HOST_NAME,
        score: 0,
        totalCorrect: 0,
        isHost: true,
        isConnected: true,
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
export function addPlayerToRoom(room, socketId, playerName) {
  const playerId = crypto.randomUUID();
  const newPlayer = {
    id: playerId,
    socketId: socketId,
    name: playerName,
    score: 0,
    totalCorrect: 0,
    isHost: false,
    isConnected: true,
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
 * Limpia los datos de una sala (timers, etc.)
 */
export function cleanupRoom(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}
