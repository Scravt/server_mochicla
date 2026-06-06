import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

/**
 * Configura la aplicación Express con CORS y middlewares
 */
export function setupExpress() {
  const app = express();

  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"]
  }));

  return app;
}

/**
 * Configura el servidor HTTP con Socket.IO
 */
export function setupSocketIO(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: false
    },
  });

  return io;
}

/**
 * Configura rutas API del servidor
 */
export function setupApiRoutes(app) {
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      mode: process.env.NODE_ENV === "production" ? "production" : "development" 
    });
  });
}



/**
 * Inicia el servidor en el puerto especificado
 */
export function startListener(httpServer, PORT) {
  return new Promise((resolve, reject) => {
    httpServer.listen(PORT, "0.0.0.0", () => {
      const mode = process.env.NODE_ENV === "production" ? "production" : "development";
      console.log(`✓ Server listening on port ${PORT} (${mode} mode)`);
      resolve();
    }).on("error", reject);
  });
}
