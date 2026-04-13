// ============================================================
// socket/socket.js — Singleton Socket.io client
// ============================================================
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// Connessione singleton: stessa istanza in tutta l'app
const socket = io(BACKEND_URL, {
  autoConnect: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1500,
});

socket.on("connect", () => console.log("[Socket] Connesso:", socket.id));
socket.on("disconnect", (reason) => console.log("[Socket] Disconnesso:", reason));
socket.on("connect_error", (err) => console.error("[Socket] Errore connessione:", err.message));

export default socket;
