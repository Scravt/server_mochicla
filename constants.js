/**
 * Estados posibles de una sala de juego
 */
export const RoomStatus = {
  LOBBY: "LOBBY",
  QUESTION_PREVIEW: "QUESTION_PREVIEW",
  PLAYING: "PLAYING",
  QUESTION_RESULTS: "QUESTION_RESULTS",
  FINISHED: "FINISHED"
};

/**
 * Configuración del juego
 */
export const GameConfig = {
  QUESTION_DURATION: 20000, // 20 segundos
  RESULTS_DURATION: 8000, // 8 segundos
  BASE_SCORE: 1000,
  SPEED_BONUS_MULTIPLIER: 1000,
  MAX_OPTIONS: 4,
  DEFAULT_HOST_NAME: "Secretaría"
};

/**
 * Eventos de Socket.IO
 */
export const SocketEvents = {
  // Emitidos por cliente
  CREATE_ROOM: "create-room",
  JOIN_ROOM: "join-room",
  START_GAME: "start-game",
  START_TIMER: "start-timer",
  SUBMIT_ANSWER: "submit-answer",
  NEXT_QUESTION: "next-question",
  DISCONNECT: "disconnect",
  
  // Emitidos por servidor
  ROOM_CREATED: "room-created",
  PLAYER_JOINED: "player-joined",
  JOINED_SUCCESSFULLY: "joined-successfully",
  NEW_QUESTION: "new-question",
  TIMER_STARTED: "timer-started",
  SHOW_RESULTS: "show-results",
  GAME_FINISHED: "game-finished",
  SUBMISSION_UPDATE: "submission-update",
  ERROR: "error"
};
