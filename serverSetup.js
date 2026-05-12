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
export function setupApiRoutes(app, isProduction, distPath) {
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      mode: isProduction ? "production" : "development" 
    });
  });
}

/**
 * Configura middleware para archivos estáticos (producción) o Vite (desarrollo)
 */
export async function setupStaticFiles(app, isProduction, distPath) {
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const path = await import("path");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
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
