import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Agregado para evitar errores de "RoomStatus is not defined"
const RoomStatus = {
  LOBBY: "LOBBY",
  QUESTION_PREVIEW: "QUESTION_PREVIEW",
  PLAYING: "PLAYING",
  QUESTION_RESULTS: "QUESTION_RESULTS",
  FINISHED: "FINISHED"
};

async function startServer() {
  const app = express();

  // CORS explícito para Express
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"]
  }));

  const httpServer = createServer(app);

  // CORS y métodos explícitos para Socket.IO
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: false
    },
  });

  // El puerto dinámico inyectado por Render o 8080 en local
  const PORT = process.env.PORT || 8080;

  // Games state
  const rooms = new Map();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("create-room", ({ questions, hostName }) => {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const roomData = {
        code: roomCode,
        hostId: socket.id,
        status: RoomStatus.LOBBY,
        players: [
          {
            id: socket.id,
            name: hostName || "Secretaría",
            score: 0,
            totalCorrect: 0,
            isHost: true,
          }
        ],
        questions,
        currentQuestionIndex: -1,
        questionStartTime: 0,
        questionDuration: 20000, // 20 seconds default
        timer: null,
        submissions: new Map(), // Round submissions
      };
      rooms.set(roomCode, roomData);
      socket.join(roomCode);
      socket.emit("room-created", roomData);
    });

    socket.on("join-room", ({ roomCode, playerName }) => {
      const room = rooms.get(roomCode.toUpperCase());
      if (!room) {
        return socket.emit("error", "Sala no encontrada");
      }
      if (room.status !== RoomStatus.LOBBY) {
        return socket.emit("error", "El juego ya comenzó");
      }

      const newPlayer = {
        id: socket.id,
        name: playerName,
        score: 0,
        totalCorrect: 0,
        isHost: false,
      };

      room.players.push(newPlayer);
      socket.join(room.code);
      io.to(room.code).emit("player-joined", room.players);
      socket.emit("joined-successfully", { room, player: newPlayer });
    });

    function triggerNextQuestion(roomCode) {
      const room = rooms.get(roomCode);
      if (!room) return;

      room.currentQuestionIndex++;
      if (room.currentQuestionIndex < room.questions.length) {
        room.submissions.clear();
        if (room.timer) clearTimeout(room.timer);
        room.timer = null;

        const isFirstQuestion = room.currentQuestionIndex === 0;

        if (isFirstQuestion) {
          room.status = RoomStatus.QUESTION_PREVIEW;
          room.questionStartTime = 0;

          io.to(roomCode).emit("new-question", {
            question: room.questions[room.currentQuestionIndex],
            index: room.currentQuestionIndex,
            total: room.questions.length,
            startTime: 0,
            duration: room.questionDuration,
          });
        } else {
          room.status = RoomStatus.PLAYING;
          room.questionStartTime = Date.now();

          room.timer = setTimeout(() => {
            if (rooms.has(roomCode) && rooms.get(roomCode).status === RoomStatus.PLAYING) {
              triggerShowResults(roomCode);
            }
          }, room.questionDuration);

          io.to(roomCode).emit("new-question", {
            question: room.questions[room.currentQuestionIndex],
            index: room.currentQuestionIndex,
            total: room.questions.length,
            startTime: room.questionStartTime,
            duration: room.questionDuration,
          });
        }
      } else {
        room.status = RoomStatus.FINISHED;
        if (room.timer) clearTimeout(room.timer);
        io.to(roomCode).emit("game-finished", room.players.sort((a, b) => b.score - a.score));
      }
    }

    socket.on("start-timer", (roomCode) => {
      const room = rooms.get(roomCode);
      if (room && room.hostId === socket.id && room.status === RoomStatus.QUESTION_PREVIEW) {
        room.status = RoomStatus.PLAYING;
        room.questionStartTime = Date.now();

        if (room.timer) clearTimeout(room.timer);
        room.timer = setTimeout(() => {
          if (rooms.has(roomCode) && rooms.get(roomCode).status === RoomStatus.PLAYING) {
            triggerShowResults(roomCode);
          }
        }, room.questionDuration);

        io.to(roomCode).emit("timer-started", {
          startTime: room.questionStartTime,
          duration: room.questionDuration
        });
      }
    });

    function triggerShowResults(roomCode) {
      const room = rooms.get(roomCode);
      if (!room) return;

      if (room.timer) {
        clearTimeout(room.timer);
        room.timer = null;
      }

      room.status = RoomStatus.QUESTION_RESULTS;
      const question = room.questions[room.currentQuestionIndex];

      const stats = {
        correctAnswer: question.correctAnswer,
        distribution: [0, 0, 0, 0],
      };

      room.submissions.forEach((sub) => {
        if (sub.answerIndex >= 0 && sub.answerIndex < 4) {
          stats.distribution[sub.answerIndex]++;
        }
      });

      const resultsDuration = 8000;
      const resultsStartTime = Date.now();

      io.to(roomCode).emit("show-results", {
        players: room.players,
        correctAnswer: question.correctAnswer,
        stats,
        startTime: resultsStartTime,
        duration: resultsDuration
      });

      // Automatic progression: show results for a few seconds then move to next (as preview)
      room.timer = setTimeout(() => {
        if (rooms.has(roomCode) && rooms.get(roomCode).status === RoomStatus.QUESTION_RESULTS) {
          triggerNextQuestion(roomCode);
        }
      }, resultsDuration);
    }

    socket.on("start-game", (roomCode) => {
      const room = rooms.get(roomCode);
      if (room && room.hostId === socket.id) {
        room.currentQuestionIndex = -1; // Set to -1 so triggerNextQuestion starts at 0
        triggerNextQuestion(roomCode);
      }
    });

    socket.on("submit-answer", ({ roomCode, answerIndex }) => {
      const room = rooms.get(roomCode);
      if (!room || room.status !== RoomStatus.PLAYING) return;

      const player = room.players.find((p) => p.id === socket.id);
      if (!player || player.isHost) return;

      if (room.submissions.has(socket.id)) return;

      const now = Date.now();
      const timeTaken = now - room.questionStartTime;
      const question = room.questions[room.currentQuestionIndex];
      const isCorrect = answerIndex === question.correctAnswer;

      let score = 0;
      if (isCorrect) {
        // Base score 1000, reduced by speed
        const maxTime = room.questionDuration;
        const speedBonus = Math.max(0, maxTime - timeTaken);
        score = Math.floor(1000 + (speedBonus / maxTime) * 1000);
        player.score += score;
        player.totalCorrect += 1;
      }

      room.submissions.set(socket.id, { isCorrect, score, timeTaken, answerIndex });

      // Check if all (non-host) players have submitted
      const nonHostPlayers = room.players.filter(p => !p.isHost);
      if (room.submissions.size === nonHostPlayers.length && nonHostPlayers.length > 0) {
        // All done, trigger results immediately
        triggerShowResults(roomCode);
      } else {
        // Notify host of submission progress
        io.to(room.hostId).emit("submission-update", {
          count: room.submissions.size,
          total: nonHostPlayers.length,
        });
      }
    });

    socket.on("next-question", (roomCode) => {
      const room = rooms.get(roomCode);
      if (room && room.hostId === socket.id) {
        triggerNextQuestion(roomCode);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      // Clean up rooms if host leaves, or notify if player leaves
      rooms.forEach((room, code) => {
        if (room.hostId === socket.id) {
          if (room.timer) clearTimeout(room.timer);
          io.to(code).emit("error", "El host ha abandonado la sala");
          rooms.delete(code);
        } else {
          const index = room.players.findIndex(p => p.id === socket.id);
          if (index !== -1) {
            room.players.splice(index, 1);
            io.to(code).emit("player-joined", room.players);
          }
        }
      });
    });
  });

  const isProduction = process.env.NODE_ENV === "production";
  const distPath = path.resolve(__dirname, "dist");

  console.log(`Server starting: isProduction=${isProduction}, distPath=${distPath}`);

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: isProduction ? "production" : "development" });
  });

  // Vite middleware for development
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static from dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is listening on port ${PORT} in ${isProduction ? 'production' : 'development'} mode`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});