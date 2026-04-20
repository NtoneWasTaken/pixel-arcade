// ============================================================
// server.js — Backend Socket.io + Express con supporto timer
// ============================================================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { createRoom, getRoom, deleteRoom, addPlayerToRoom, removePlayerFromRoom } = require("./rooms/roomManager");
const { handleMove, initGame, skipTurn } = require("./games/tictactoe");

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  /\.pages\.dev$/,
];

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] },
});

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());
app.get("/", (req, res) => res.json({ status: "ok", message: "Arcade backend running 🎮" }));

// Map per tenere traccia dei timeout attivi per stanza
const turnTimers = new Map();

// Avvia il timer per il turno corrente
function startTurnTimer(roomCode) {
  // Cancella eventuale timer precedente
  clearTurnTimer(roomCode);

  const room = getRoom(roomCode);
  if (!room || !room.gameState || room.gameState.timerSeconds === 0) return;

  const ms = room.gameState.timerSeconds * 1000;

  const timeout = setTimeout(() => {
    const r = getRoom(roomCode);
    if (!r || r.gameState?.status !== "playing") return;

    const skippedPlayerId = r.gameState.currentTurn;
    skipTurn(r.gameState);

    // Notifica tutti del turno saltato
    io.to(roomCode).emit("turn_skipped", {
      skippedPlayerId,
      gameState: r.gameState,
    });

    console.log(`[TIMER] Turno saltato in stanza ${roomCode} per ${skippedPlayerId}`);

    // Avvia il timer per il prossimo turno
    startTurnTimer(roomCode);
  }, ms);

  turnTimers.set(roomCode, timeout);
}

function clearTurnTimer(roomCode) {
  if (turnTimers.has(roomCode)) {
    clearTimeout(turnTimers.get(roomCode));
    turnTimers.delete(roomCode);
  }
}

// ============================================================
// SOCKET.IO
// ============================================================
io.on("connection", (socket) => {
  console.log(`[+] Client connesso: ${socket.id}`);

  // ----------------------------------------------------------
  // create_room
  // ----------------------------------------------------------
  socket.on("create_room", ({ playerName }) => {
    const player = { id: socket.id, name: playerName || "Guest", isHost: true };
    const room = createRoom(player);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerName = player.name;
    socket.emit("room_created", { roomCode: room.code, player });
    console.log(`[ROOM] Creata stanza ${room.code} da ${player.name}`);
  });

  // ----------------------------------------------------------
  // join_room
  // ----------------------------------------------------------
  socket.on("join_room", ({ roomCode, playerName }) => {
    const code = roomCode?.toUpperCase();
    const room = getRoom(code);

    if (!room) { socket.emit("error", { message: "Stanza non trovata." }); return; }
    if (room.players.length >= 2) { socket.emit("error", { message: "Stanza piena!" }); return; }
    if (room.status === "playing") { socket.emit("error", { message: "Partita già in corso." }); return; }

    const player = { id: socket.id, name: playerName || "Guest", isHost: false };
    addPlayerToRoom(code, player);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerName = player.name;

    io.to(code).emit("player_joined", { room: getRoom(code) });
    console.log(`[ROOM] ${player.name} è entrato in ${code}`);
  });

  // ----------------------------------------------------------
  // start_game — ora riceve anche timerSeconds
  // Payload: { timerSeconds: 0 | 5 | 10 }
  // ----------------------------------------------------------
  socket.on("start_game", ({ timerSeconds = 0 } = {}) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);

    if (!room) return;
    if (room.players[0].id !== socket.id) {
      socket.emit("error", { message: "Solo l'host può avviare la partita." });
      return;
    }
    if (room.players.length < 2) {
      socket.emit("error", { message: "Servono 2 giocatori per iniziare." });
      return;
    }

    room.status = "playing";
    room.gameState = initGame(room.players, timerSeconds);

    io.to(code).emit("game_started", { gameState: room.gameState });
    console.log(`[GAME] Partita avviata in stanza ${code} — timer: ${timerSeconds}s`);

    // Avvia il timer se selezionato
    if (timerSeconds > 0) {
      startTurnTimer(code);
    }
  });

  // ----------------------------------------------------------
  // player_move
  // ----------------------------------------------------------
  socket.on("player_move", ({ index }) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);

    if (!room || room.status !== "playing") return;

    const result = handleMove(room.gameState, socket.id, index);

    if (result.error) {
      socket.emit("error", { message: result.error });
      return;
    }

    // Mossa valida — cancella il timer corrente
    clearTurnTimer(code);

    io.to(code).emit("game_update", { gameState: room.gameState });
    console.log(`[GAME] Mossa ${index} in stanza ${code}`);

    if (room.gameState.status === "finished") {
      room.status = "finished";
      clearTurnTimer(code);
    } else if (room.gameState.timerSeconds > 0) {
      // Avvia timer per il prossimo turno
      startTurnTimer(code);
    }
  });

  // ----------------------------------------------------------
  // request_rematch
  // ----------------------------------------------------------
  socket.on("request_rematch", () => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room) return;

    clearTurnTimer(code);
    room.status = "waiting";
    room.gameState = null;

    io.to(code).emit("rematch_ready", { room });
  });

  // ----------------------------------------------------------
  // disconnect
  // ----------------------------------------------------------
  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code) return;

    const room = getRoom(code);
    if (room) {
      removePlayerFromRoom(code, socket.id);
      const updated = getRoom(code);

      if (!updated || updated.players.length === 0) {
        clearTurnTimer(code);
        deleteRoom(code);
        console.log(`[ROOM] Stanza ${code} eliminata`);
      } else {
        io.to(code).emit("player_left", {
          room: updated,
          message: `${socket.data.playerName} ha lasciato la stanza.`,
        });
        if (updated.status === "playing") {
          clearTurnTimer(code);
          updated.status = "waiting";
          updated.gameState = null;
          io.to(code).emit("game_aborted", { message: "L'avversario ha abbandonato." });
        }
      }
    }

    console.log(`[-] Client disconnesso: ${socket.id}`);
  });
});

// ============================================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🎮 Server in ascolto su porta ${PORT}`));
