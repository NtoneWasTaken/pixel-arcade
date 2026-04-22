// ============================================================
// server.js — Timer + Random + Abilità + Punteggio + Bot + Griglie + Chat
// ============================================================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { createRoom, getRoom, deleteRoom, addPlayerToRoom, removePlayerFromRoom } = require("./rooms/roomManager");
const { handleMove, initGame, skipTurn, handleAbility, getBotMove } = require("./games/tictactoe");

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
    if (r.botId && r.gameState.currentTurn === r.botId && r.gameState.status === "playing") {
      scheduleBotMove(roomCode);
    } else {
      startTurnTimer(roomCode);
    }
  }, ms);
  turnTimers.set(roomCode, timeout);
}

function clearTurnTimer(roomCode) {
  if (turnTimers.has(roomCode)) {
    clearTimeout(turnTimers.get(roomCode));
    turnTimers.delete(roomCode);
  }
}

function buildClientState(gameState, forPlayerId) {
  if (!gameState.ghostMove) return gameState;
  const { index, playerId } = gameState.ghostMove;
  if (forPlayerId === playerId) return gameState;
  const maskedBoard = [...gameState.board];
  maskedBoard[index] = "?";
  return { ...gameState, board: maskedBoard };
}

function updateScore(room) {
  const winner = room.gameState?.winner;
  if (!winner || winner === "draw") return;
  if (!(winner in room.score)) room.score[winner] = 0;
  room.score[winner]++;
}

function injectScore(gameState, room) {
  return { ...gameState, score: room.score };
}

// ── Bot helpers ──────────────────────────────────────────────

function scheduleBotMove(roomCode) {
  setTimeout(() => {
    const room = getRoom(roomCode);
    if (!room || !room.botId || room.gameState?.status !== "playing") return;
    if (room.gameState.currentTurn !== room.botId) return;

    const botPlayer = room.gameState.players.find(p => p.id === room.botId);
    const moveIndex = getBotMove(room.gameState.board, room.botDifficulty, botPlayer.symbol, room.gameState.gridSize);
    if (moveIndex === null) return;

    const result = handleMove(room.gameState, room.botId, moveIndex);
    if (result.error) return;

    clearTurnTimer(roomCode);

    if (room.gameState.status === "finished") {
      updateScore(room);
      room.status = "finished";
    }

    const humanSocket = io.sockets.sockets.get(room.humanId);
    if (humanSocket) {
      humanSocket.emit("game_update", {
        gameState: injectScore(buildClientState(room.gameState, room.humanId), room),
        deviated: result.deviated,
        intendedIndex: result.intendedIndex,
        actualIndex: result.actualIndex,
      });
    }

    if (room.gameState.status !== "finished" && room.gameState.timerSeconds > 0) {
      startTurnTimer(roomCode);
    }
  }, 400);
}

// ============================================================
io.on("connection", (socket) => {
  console.log(`[+] Connesso: ${socket.id}`);

  socket.on("create_room", ({ playerName }) => {
    const player = { id: socket.id, name: playerName || "Guest", isHost: true };
    const room = createRoom(player);
    room.score[socket.id] = 0;
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
    room.score[socket.id] = 0;
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerName = player.name;
    io.to(code).emit("player_joined", { room: getRoom(code) });
  });

  // ── Crea stanza bot ────────────────────────────────────────
  socket.on("create_bot_room", ({ playerName, difficulty = "easy", timerSeconds = 0, randomChance = 0, abilitiesEnabled = false, gridSize = 3 }) => {
    const BOT_ID = `bot_${Date.now()}`;
    const human = { id: socket.id, name: playerName || "Guest", isHost: true };
    const bot   = { id: BOT_ID, name: "🤖 Bot", isHost: false };

    const room = createRoom(human);
    room.score[socket.id] = 0;
    room.score[BOT_ID] = 0;
    room.botId = BOT_ID;
    room.humanId = socket.id;
    room.botDifficulty = difficulty;
    room.isBot = true;

    addPlayerToRoom(room.code, bot);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerName = human.name;

    room.status = "playing";
    room.gameState = initGame([human, bot], timerSeconds, randomChance, abilitiesEnabled, gridSize);

    socket.emit("game_started", {
      gameState: injectScore(room.gameState, room),
      isBot: true,
      botDifficulty: difficulty,
    });

    console.log(`[BOT] Partita vs bot avviata in ${room.code} — difficoltà:${difficulty} griglia:${gridSize}x${gridSize}`);

    if (room.gameState.currentTurn === BOT_ID) {
      scheduleBotMove(room.code);
    } else if (timerSeconds > 0) {
      startTurnTimer(room.code);
    }
  });

  socket.on("start_game", ({ timerSeconds = 0, randomChance = 0, abilitiesEnabled = false, gridSize = 3 } = {}) => {
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
    room.gameState = initGame(room.players, timerSeconds, randomChance, abilitiesEnabled, gridSize);

    room.players.forEach((p) => {
      const clientSocket = io.sockets.sockets.get(p.id);
      if (clientSocket) {
        clientSocket.emit("game_started", {
          gameState: injectScore(buildClientState(room.gameState, p.id), room),
        });
      }
    });

    console.log(`[GAME] Avviata in ${code} — timer:${timerSeconds}s random:${randomChance} griglia:${gridSize}x${gridSize}`);
    if (timerSeconds > 0) startTurnTimer(code);
  });

  socket.on("player_move", ({ index }) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room || room.status !== "playing") return;

    const result = handleMove(room.gameState, socket.id, index);
    if (result.error) { socket.emit("error", { message: result.error }); return; }

    clearTurnTimer(code);

    if (room.gameState.status === "finished") {
      updateScore(room);
      room.status = "finished";
    }

    if (room.isBot) {
      socket.emit("game_update", {
        gameState: injectScore(room.gameState, room),
        deviated: result.deviated,
        intendedIndex: result.intendedIndex,
        actualIndex: result.actualIndex,
      });
    } else {
      room.players.forEach((p) => {
        const clientSocket = io.sockets.sockets.get(p.id);
        if (clientSocket) {
          clientSocket.emit("game_update", {
            gameState: injectScore(buildClientState(room.gameState, p.id), room),
            deviated: result.deviated,
            intendedIndex: result.intendedIndex,
            actualIndex: result.actualIndex,
          });
        }
      });
    }

    if (room.gameState.status === "finished") return;

    if (room.isBot && room.gameState.currentTurn === room.botId) {
      scheduleBotMove(code);
    } else if (room.gameState.timerSeconds > 0) {
      startTurnTimer(code);
    }
  });

  socket.on("use_ability", ({ abilityName, targetIndex, index }) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room || room.status !== "playing") return;

    const payload = { targetIndex, index };
    const result = handleAbility(room.gameState, socket.id, abilityName, payload);

    if (result.error) { socket.emit("error", { message: result.error }); return; }

    clearTurnTimer(code);

    if (room.gameState.status === "finished") {
      updateScore(room);
      room.status = "finished";
    }

    if (room.isBot) {
      socket.emit("ability_used", {
        playerId: socket.id,
        abilityName,
        gameState: injectScore(room.gameState, room),
      });
    } else {
      room.players.forEach((p) => {
        const clientSocket = io.sockets.sockets.get(p.id);
        if (clientSocket) {
          clientSocket.emit("ability_used", {
            playerId: socket.id,
            abilityName,
            gameState: injectScore(buildClientState(room.gameState, p.id), room),
          });
        }
      });
    }

    if (room.gameState.status === "finished") return;

    if (room.isBot && room.gameState.currentTurn === room.botId) {
      scheduleBotMove(code);
    } else if (room.gameState.timerSeconds > 0) {
      startTurnTimer(code);
    }
  });

  // ── Chat ───────────────────────────────────────────────────
  socket.on("send_message", ({ text }) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room || room.isBot) return; // niente chat vs bot

    const trimmed = text?.trim();
    if (!trimmed || trimmed.length > 200) return;

    io.to(code).emit("new_message", {
      playerId:   socket.id,
      playerName: socket.data.playerName || "Guest",
      text:       trimmed,
      timestamp:  Date.now(),
    });
  });

  socket.on("request_rematch", () => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room) return;
    clearTurnTimer(code);

    if (room.isBot) {
      const human  = room.players.find(p => p.id === room.humanId);
      const bot    = room.players.find(p => p.id === room.botId);
      const prevGs = room.gameState;
      room.status = "playing";
      room.gameState = initGame([human, bot], prevGs.timerSeconds, prevGs.randomChance, prevGs.abilitiesEnabled, prevGs.gridSize);

      socket.emit("game_started", {
        gameState: injectScore(room.gameState, room),
        isBot: true,
        botDifficulty: room.botDifficulty,
      });

      if (room.gameState.currentTurn === room.botId) {
        scheduleBotMove(code);
      } else if (room.gameState.timerSeconds > 0) {
        startTurnTimer(code);
      }
    } else {
      room.status = "waiting";
      room.gameState = null;
      io.to(code).emit("rematch_ready", { room });
    }
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
