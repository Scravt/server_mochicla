import { RoomStatus, SocketEvents, GameConfig } from "./constants.js";
import {
  createRoom,
  addPlayerToRoom,
  removePlayerFromRoom,
  getNonHostPlayers,
  cleanupRoom,
} from "./roomManager.js";
import {
  processPlayerAnswer,
  prepareNextQuestionPayload,
  collectAnswerStats,
  allPlayersSubmitted,
  prepareGameResults,
  prepareResultsPayload,
  hasMoreQuestions,
} from "./gameEngine.js";

/**
 * Manejadores de eventos de Socket.IO
 */
export function setupSocketHandlers(io, rooms) {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // ========== CREAR SALA ==========
    socket.on(SocketEvents.CREATE_ROOM, ({ questions, hostName }) => {
      const { code, data } = createRoom(questions, socket.id, hostName);
      rooms.set(code, data);
      socket.join(code);
      socket.emit(SocketEvents.ROOM_CREATED, data);
      console.log(`Room created: ${code}`);
    });

    // ========== UNIRSE A SALA ==========
    socket.on(SocketEvents.JOIN_ROOM, ({ roomCode, playerName }) => {
      const room = rooms.get(roomCode.toUpperCase());
      
      if (!room) {
        return socket.emit(SocketEvents.ERROR, "Sala no encontrada");
      }
      
      if (room.status !== RoomStatus.LOBBY) {
        return socket.emit(SocketEvents.ERROR, "El juego ya comenzó");
      }

      const newPlayer = addPlayerToRoom(room, socket.id, playerName);
      socket.join(room.code);
      
      io.to(room.code).emit(SocketEvents.PLAYER_JOINED, room.players);
      socket.emit(SocketEvents.JOINED_SUCCESSFULLY, { room, player: newPlayer });
      console.log(`Player ${playerName} joined room ${room.code}`);
    });

    // ========== INICIAR JUEGO ==========
    socket.on(SocketEvents.START_GAME, (roomCode) => {
      const room = rooms.get(roomCode);
      
      const hostPlayer = room?.players.find(p => p.socketId === socket.id && p.isHost);
      if (!room || !hostPlayer) return;
      
      room.currentQuestionIndex = -1;
      triggerNextQuestion(io, rooms, roomCode);
    });

    // ========== INICIAR TEMPORIZADOR ==========
    socket.on(SocketEvents.START_TIMER, (roomCode) => {
      const room = rooms.get(roomCode);
      
      const hostPlayer = room?.players.find(p => p.socketId === socket.id && p.isHost);
      if (room && hostPlayer && room.status === RoomStatus.QUESTION_PREVIEW) {
        startPlayingTimer(io, rooms, room);
      }
    });

    // ========== ENVIAR RESPUESTA ==========
    socket.on(SocketEvents.SUBMIT_ANSWER, ({ roomCode, answerIndex }) => {
      const room = rooms.get(roomCode);
      
      if (!room || room.status !== RoomStatus.PLAYING) return;

      const result = processPlayerAnswer(room, socket.id, answerIndex);
      if (!result) return; // Respuesta inválida o duplicada

      // Notificar progreso al host
      const nonHostPlayers = getNonHostPlayers(room);
      io.to(room.hostId).emit(SocketEvents.SUBMISSION_UPDATE, {
        count: room.submissions.size,
        total: nonHostPlayers.length,
      });

      // Si todos han respondido, mostrar resultados inmediatamente
      if (allPlayersSubmitted(room)) {
        triggerShowResults(io, rooms, roomCode);
      }
    });

    // ========== SIGUIENTE PREGUNTA ==========
    socket.on(SocketEvents.NEXT_QUESTION, (roomCode) => {
      const room = rooms.get(roomCode);
      
      const hostPlayer = room?.players.find(p => p.socketId === socket.id && p.isHost);
      if (room && hostPlayer) {
        triggerNextQuestion(io, rooms, roomCode);
      }
    });

    // ========== RECONECTAR ==========
    socket.on("reconnect-player", ({ roomCode, playerId }) => {
      const room = rooms.get(roomCode?.toUpperCase());
      if (!room) {
        return socket.emit("reconnect-error", "Sala no encontrada");
      }
      
      const player = room.players.find(p => p.id === playerId);
      if (!player) {
        return socket.emit("reconnect-error", "Jugador no encontrado en esta sala");
      }
      
      // Actualizar socket ID y estado de conexión
      player.socketId = socket.id;
      player.isConnected = true;
      socket.join(room.code);
      
      // Emitir éxito y el estado actual de la sala a este usuario
      socket.emit("reconnect-success", { room, player });
      
      // Notificar a los demás que alguien se reconectó (opcional, pero útil)
      io.to(room.code).emit(SocketEvents.PLAYER_JOINED, room.players);
      console.log(`Player ${player.name} reconnected to room ${room.code}`);
      
      // Si la sala está esperando resultados o siguiente pregunta y este era el último que faltaba, 
      // verificamos si podemos avanzar (por si un disconnect previo había trabado algo, aunque lo manejamos en disconnect).
      if (room.status === RoomStatus.PLAYING && allPlayersSubmitted(room)) {
        triggerShowResults(io, rooms, room.code);
      }
    });

    // ========== DESCONEXIÓN ==========
    socket.on(SocketEvents.DISCONNECT, () => {
      console.log("User disconnected:", socket.id);
      
      rooms.forEach((room, code) => {
        const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          player.isConnected = false;
          
          if (player.isHost) {
            // El host se desconectó: por ahora no borramos la sala, esperamos que vuelva.
            // Opcionalmente se podría poner un timeout.
            console.log(`Host ${player.name} disconnected from room ${code}`);
          } else {
            console.log(`Player ${player.name} disconnected from room ${code}`);
            
            // Si el juego está en curso y no ha respondido, enviamos una respuesta errónea por él
            if (room.status === RoomStatus.PLAYING && !room.submissions.has(player.id)) {
              console.log(`Auto-submitting wrong answer for disconnected player ${player.name}`);
              room.submissions.set(player.id, { isCorrect: false, score: 0, timeTaken: room.questionDuration, answerIndex: -1 });
              
              // Notificar progreso al host
              const nonHostPlayers = getNonHostPlayers(room);
              io.to(room.players.find(p => p.isHost)?.socketId).emit(SocketEvents.SUBMISSION_UPDATE, {
                count: room.submissions.size,
                total: nonHostPlayers.length,
              });

              // Si todos los demás ya respondieron, avanzamos
              if (allPlayersSubmitted(room)) {
                triggerShowResults(io, rooms, code);
              }
            }
          }
          
          io.to(code).emit(SocketEvents.PLAYER_JOINED, room.players);
        }
      });
    });
  });
}

/**
 * Inicia el temporizador para la ronda de juego
 * 
 * NOTA: Esta función se llama cada vez que el host presiona START_TIMER
 * Verifica que:
 * 1. La sala esté en estado PREVIEW
 * 2. El que presiona sea el host
 */
function startPlayingTimer(io, rooms, room) {
  // ✓ Limpia timer anterior (por si acaso)
  if (room.timer) {
    clearTimeout(room.timer);
    console.warn(`⚠️  Existing timer cleared for room ${room.code}`);
  }
  
  // ✓ Transición: PREVIEW → PLAYING
  room.status = RoomStatus.PLAYING;
  room.questionStartTime = Date.now();
  
  // ✓ Crear nuevo timer para la pregunta
  room.timer = setTimeout(() => {
    if (rooms.has(room.code)) {
      const currentRoom = rooms.get(room.code);
      if (currentRoom.status === RoomStatus.PLAYING) {
        console.log(`⏱️  Question timer expired for room ${room.code}`);
        triggerShowResults(io, rooms, room.code);
      }
    }
  }, room.questionDuration);

  // ✓ Notificar a todos los clientes que el timer ha iniciado
  io.to(room.code).emit(SocketEvents.TIMER_STARTED, {
    startTime: room.questionStartTime,
    duration: room.questionDuration
  });
  
  console.log(`✓ Timer started for room ${room.code} (${room.questionDuration}ms)`);
}

/**
 * Avanza a la siguiente pregunta
 * 
 * NOTA: Siempre establece QUESTION_PREVIEW.
 * El host debe presionar START_TIMER para cada pregunta.
 * Esto es consistente para todas las preguntas.
 */
function triggerNextQuestion(io, rooms, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.currentQuestionIndex++;
  room.submissions.clear();
  
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;

  if (room.currentQuestionIndex < room.questions.length) {
    // SIEMPRE mostrar en PREVIEW (sin timer)
    // Esto es consistente para TODAS las preguntas
    room.status = RoomStatus.QUESTION_PREVIEW;
    room.questionStartTime = 0;

    const payload = prepareNextQuestionPayload(room, room.currentQuestionIndex);
    io.to(roomCode).emit(SocketEvents.NEW_QUESTION, payload);
    console.log(`New question in room ${roomCode}: index ${room.currentQuestionIndex} (PREVIEW - waiting for START_TIMER)`);
  } else {
    // Juego finalizado
    finishGame(io, rooms, roomCode, room);
  }
}

/**
 * Muestra los resultados de la pregunta actual
 * 
 * Después de mostrar resultados por 8 segundos, auto-avanza a siguiente pregunta
 * (que se mostrará en PREVIEW)
 */
function triggerShowResults(io, rooms, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  // ✓ Limpiar timer de PLAYING
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }

  // ✓ Transición: PLAYING → QUESTION_RESULTS
  room.status = RoomStatus.QUESTION_RESULTS;
  const payload = prepareResultsPayload(room);
  
  io.to(roomCode).emit(SocketEvents.SHOW_RESULTS, payload);
  console.log(`📊 Results shown for room ${roomCode}: Q${room.currentQuestionIndex + 1}`);

  // ✓ Auto-avance a siguiente pregunta después de 8s
  room.timer = setTimeout(() => {
    if (rooms.has(roomCode)) {
      const currentRoom = rooms.get(roomCode);
      if (currentRoom.status === RoomStatus.QUESTION_RESULTS) {
        console.log(`⏭️  Auto-advancing to next question in room ${roomCode}`);
        triggerNextQuestion(io, rooms, roomCode);
      }
    }
  }, GameConfig.RESULTS_DURATION);
}

/**
 * Finaliza el juego
 */
function finishGame(io, rooms, roomCode, room) {
  // ✓ Limpiar recursos
  room.status = RoomStatus.FINISHED;
  cleanupRoom(room);
  
  // ✓ Preparar y enviar resultados finales
  const finalResults = prepareGameResults(room);
  io.to(roomCode).emit(SocketEvents.GAME_FINISHED, finalResults);
  console.log(`🏁 Game finished in room ${roomCode}`);
  console.log(`📈 Final standings:`, finalResults.map((p, i) => `${i + 1}. ${p.name}: ${p.score}pts`).join(', '));
}
