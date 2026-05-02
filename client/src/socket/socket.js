// ============================================================
// socket/socket.js — Socket.io client con cold start detection
// ============================================================
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "https://pixel-arcade.onrender.com";

const socket = io(SERVER_URL, {
  autoConnect: false,       // connetti manuale così gestiamo il loading
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  timeout: 60000,           // 60s timeout per cold start Render
});

export default socket;
