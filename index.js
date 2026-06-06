import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { setupExpress, setupSocketIO, setupApiRoutes, startListener } from "./serverSetup.js";
import { setupSocketHandlers } from "./socketHandlers.js";



/**
 * Inicia el servidor principal
 */
async function startServer() {
  try {
    // Configuración básica
    const isProduction = process.env.NODE_ENV === "production";
    const PORT = process.env.PORT || 8080;
    console.log(`🚀 Starting server (${isProduction ? 'production' : 'development'} mode)`);

    // Configurar Express y Socket.IO
    const app = setupExpress();
    const httpServer = createServer(app);
    const io = setupSocketIO(httpServer);

    // Almacén de salas del juego
    const rooms = new Map();

    // Configurar manejadores de eventos Socket.IO
    setupSocketHandlers(io, rooms);

    // Configurar rutas API
    setupApiRoutes(app);

    // Iniciar servidor
    await startListener(httpServer, PORT);
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();