// ============================================================
// server.js — Timer + Random + Abilità Speciali
// ============================================================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { createRoom, getRoom, deleteRoom, addPlayerToRoom, removePlayerFromRoom } = require("./rooms/roomManager");
const { handleMove, initGame, skipTurn, handleAbility } = require("./games/tictactoe");

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

const turnTimers = new Map();

function startTurnTimer(roomCode) {
  clearTurnTimer(roomCode);
  const room = getRoom(roomCode);
  if (!room || !room.gameState || room.gameState.timerSeconds === 0) return;
  const ms = room.gameState.timerSeconds * 1000;
  const timeout = setTimeout(() => {
    const r = getRoom(roomCode);
    if (!r || r.gameState?.status !== "playing") return;
    const skippedPlayerId = r.gameState.currentTurn;
    skipTurn(r.gameState);
    io.to(roomCode).emit("turn_skipped", { skippedPlayerId, gameState: r.gameState });
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

// Costruisce la gameState da mandare al client
// Se c'è una ghostMove, la cella appare come "?" per l'avversario
function buildClientState(gameState, forPlayerId) {
  if (!gameState.ghostMove) return gameState;

  const { index, playerId } = gameState.ghostMove;
  // Se sei il proprietario della mossa fantasma, vedi normalmente
  if (forPlayerId === playerId) return gameState;

  // Altrimenti la cella mostra "?"
  const maskedBoard = [...gameState.board];
  maskedBoard[index] = "?";
  return { ...gameState, board: maskedBoard };
}

// ============================================================
io.on("connection", (socket) => {
  console.log(`[+] Connesso: ${socket.id}`);

  socket.on("create_room", ({ playerName }) => {
    const player = { id: socket.id, name: playerName || "Guest", isHost: true };
    const room = createRoom(player);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerName = player.name;
    socket.emit("room_created", { roomCode: room.code, player });
  });

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
  });

  // start_game — timerSeconds + randomChance + abilitiesEnabled
  socket.on("start_game", ({ timerSeconds = 0, randomChance = 0, abilitiesEnabled = false } = {}) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room) return;
    if (room.players[0].id !== socket.id) {
      socket.emit("error", { message: "Solo l'host può avviare la partita." }); return;
    }
    if (room.players.length < 2) {
      socket.emit("error", { message: "Servono 2 giocatori." }); return;
    }

    room.status = "playing";
    room.gameState = initGame(room.players, timerSeconds, randomChance, abilitiesEnabled);

    // Invia a ciascun giocatore la sua versione della gameState
    room.players.forEach((p) => {
      const clientSocket = io.sockets.sockets.get(p.id);
      if (clientSocket) {
        clientSocket.emit("game_started", { gameState: buildClientState(room.gameState, p.id) });
      }
    });

    console.log(`[GAME] Avviata in ${code} — timer:${timerSeconds}s random:${randomChance} abilità:${abilitiesEnabled}`);
    if (timerSeconds > 0) startTurnTimer(code);
  });

  socket.on("player_move", ({ index }) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room || room.status !== "playing") return;

    const result = handleMove(room.gameState, socket.id, index);
    if (result.error) { socket.emit("error", { message: result.error }); return; }

    clearTurnTimer(code);

    // Invia stato personalizzato a ciascun giocatore
    room.players.forEach((p) => {
      const clientSocket = io.sockets.sockets.get(p.id);
      if (clientSocket) {
        clientSocket.emit("game_update", {
          gameState: buildClientState(room.gameState, p.id),
          deviated: result.deviated,
          intendedIndex: result.intendedIndex,
          actualIndex: result.actualIndex,
        });
      }
    });

    if (room.gameState.status === "finished") {
      room.status = "finished";
    } else if (room.gameState.timerSeconds > 0) {
      startTurnTimer(code);
    }
  });

  // ----------------------------------------------------------
  // use_ability — Il client usa un'abilità speciale
  // Payload: { abilityName: "scambia"|"bomba"|"fantasma", targetIndex?, index? }
  // ----------------------------------------------------------
  socket.on("use_ability", ({ abilityName, targetIndex, index }) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room || room.status !== "playing") return;

    const payload = { targetIndex, index };
    const result = handleAbility(room.gameState, socket.id, abilityName, payload);

    if (result.error) { socket.emit("error", { message: result.error }); return; }

    clearTurnTimer(code);

    // Notifica tutti con stato personalizzato
    room.players.forEach((p) => {
      const clientSocket = io.sockets.sockets.get(p.id);
      if (clientSocket) {
        clientSocket.emit("ability_used", {
          playerId: socket.id,
          abilityName,
          gameState: buildClientState(room.gameState, p.id),
        });
      }
    });

    console.log(`[ABILITY] ${socket.id} ha usato ${abilityName} in stanza ${code}`);

    if (room.gameState.status === "finished") {
      room.status = "finished";
    } else if (room.gameState.timerSeconds > 0) {
      startTurnTimer(code);
    }
  });

  socket.on("request_rematch", () => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room) return;
    clearTurnTimer(code);
    room.status = "waiting";
    room.gameState = null;
    io.to(code).emit("rematch_ready", { room });
  });

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
    console.log(`[-] Disconnesso: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🎮 Server su porta ${PORT}`));
