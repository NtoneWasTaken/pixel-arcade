// ============================================================
// server.js — Tris + Connect 4 + Battleship
// ============================================================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { createRoom, getRoom, deleteRoom, addPlayerToRoom, removePlayerFromRoom } = require("./rooms/roomManager");
const { handleMove: tttMove, initGame: tttInit, skipTurn: tttSkip, handleAbility, getBotMove: tttBot } = require("./games/tictactoe");
const { handleMove: c4Move, initGame: c4Init, skipTurn: c4Skip, getBotMove: c4Bot, handlePowerUp: c4PowerUp, handlePopOut: c4PopOut } = require("./games/connect4");
const { initGame: bsInit, placeShips: bsPlace, handleAttack: bsAttack, handlePowerUp: bsPowerUp, skipTurn: bsSkip, getBotMove: bsBotMove, generateRandomShips: bsRandomShips, buildClientBoards, getConfig: bsConfig } = require("./games/battleship");

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

// ── Timer ────────────────────────────────────────────────────

function startTurnTimer(roomCode) {
  clearTurnTimer(roomCode);
  const room = getRoom(roomCode);
  if (!room || !room.gameState || room.gameState.timerSeconds === 0) return;
  // Per Battleship, il timer parte solo nella fase playing
  if (room.gameType === "bs" && room.gameState.phase === "placement") return;
  const ms = room.gameState.timerSeconds * 1000;
  const timeout = setTimeout(() => {
    const r = getRoom(roomCode);
    if (!r || r.gameState?.phase !== "playing") return;
    const skippedPlayerId = r.gameState.currentTurn;
    if (r.gameType === "bs") {
      bsSkip(r.gameState);
      io.to(roomCode).emit("turn_skipped", { skippedPlayerId, gameState: buildBsClientState(r, skippedPlayerId) });
      if (r.botId && r.gameState.currentTurn === r.botId) scheduleBotMove(roomCode);
      else startTurnTimer(roomCode);
    } else {
      const skipFn = r.gameType === "c4" ? c4Skip : tttSkip;
      skipFn(r.gameState);
      io.to(roomCode).emit("turn_skipped", { skippedPlayerId, gameState: r.gameState });
      if (r.botId && r.gameState.currentTurn === r.botId) scheduleBotMove(roomCode);
      else startTurnTimer(roomCode);
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

// ── State helpers ────────────────────────────────────────────

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

function emitC4Update(room, result, eventName = "game_update") {
  if (room.isBot) {
    const humanSocket = io.sockets.sockets.get(room.humanId);
    if (humanSocket) humanSocket.emit(eventName, { gameState: injectScore(room.gameState, room), ...result });
  } else {
    room.players.forEach(p => {
      const s = io.sockets.sockets.get(p.id);
      if (s) s.emit(eventName, { gameState: injectScore(room.gameState, room), ...result });
    });
  }
}

// Battleship: ogni giocatore riceve una view personalizzata della board
function buildBsClientState(room, forPlayerId) {
  const gs = room.gameState;
  const boards = buildClientBoards(gs, forPlayerId, gs.fogOfWarEnabled);
  return injectScore({ ...gs, boards }, room);
}

function emitBsUpdate(room, result, eventName = "attack_result") {
  if (room.isBot) {
    const humanSocket = io.sockets.sockets.get(room.humanId);
    if (humanSocket) humanSocket.emit(eventName, { ...result, gameState: buildBsClientState(room, room.humanId) });
  } else {
    room.players.forEach(p => {
      const s = io.sockets.sockets.get(p.id);
      if (s) s.emit(eventName, { ...result, gameState: buildBsClientState(room, p.id) });
    });
  }
}

// ── Bot ──────────────────────────────────────────────────────

function scheduleBotMove(roomCode) {
  setTimeout(() => {
    const room = getRoom(roomCode);
    if (!room || !room.botId) return;

    if (room.gameType === "bs") {
      scheduleBsBotMove(roomCode);
      return;
    }

    if (room.gameState?.phase !== "playing" && room.gameState?.status !== "playing") return;
    if (room.gameState.currentTurn !== room.botId) return;

    const botPlayer = room.gameState.players.find(p => p.id === room.botId);
    let result;

    if (room.gameType === "c4") {
      const gs = room.gameState;
      const col = c4Bot(gs.board, room.botDifficulty, botPlayer.symbol, gs.rows, gs.cols, gs.winLen, gs.gravityDir);
      if (col === null) return;
      result = c4Move(gs, room.botId, col);
    } else {
      const idx = tttBot(room.gameState.board, room.botDifficulty, botPlayer.symbol, room.gameState.gridSize);
      if (idx === null) return;
      result = tttMove(room.gameState, room.botId, idx);
    }

    if (result.error) return;
    clearTurnTimer(roomCode);
    if (room.gameState.status === "finished") { updateScore(room); room.status = "finished"; }

    const humanSocket = io.sockets.sockets.get(room.humanId);
    if (humanSocket) humanSocket.emit("game_update", { gameState: injectScore(room.gameState, room), ...result });

    if (room.gameState.status !== "finished" && room.gameState.timerSeconds > 0) startTurnTimer(roomCode);
  }, 400);
}

function scheduleBsBotMove(roomCode) {
  setTimeout(() => {
    const room = getRoom(roomCode);
    if (!room || !room.botId || room.gameState?.phase !== "playing") return;
    if (room.gameState.currentTurn !== room.botId) return;

    const humanId = room.humanId;
    const humanBoard = room.gameState.boards[humanId];
    const move = bsBotMove(humanBoard.attacks, humanBoard, room.botDifficulty, room.gameState.size);
    if (!move) return;

    const result = bsAttack(room.gameState, room.botId, move.row, move.col);
    if (result.error) return;

    clearTurnTimer(roomCode);
    if (room.gameState.phase === "finished") { updateScore(room); room.status = "finished"; }

    emitBsUpdate(room, result);

    if (room.gameState.phase !== "finished" && room.gameState.timerSeconds > 0) startTurnTimer(roomCode);
    // Se il bot ha colpito, gioca di nuovo
    else if (room.gameState.phase === "playing" && room.gameState.currentTurn === room.botId) {
      scheduleBsBotMove(roomCode);
    }
  }, 600);
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

  // ── Avvia Tris ─────────────────────────────────────────────
  socket.on("start_game", ({ timerSeconds = 0, randomChance = 0, abilitiesEnabled = false, gridSize = 3 } = {}) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room) return;
    if (room.players[0].id !== socket.id) { socket.emit("error", { message: "Solo l'host può avviare la partita." }); return; }
    if (room.players.length < 2) { socket.emit("error", { message: "Servono 2 giocatori." }); return; }

    room.status = "playing";
    room.gameType = "ttt";
    room.gameState = tttInit(room.players, timerSeconds, randomChance, abilitiesEnabled, gridSize);

    room.players.forEach(p => {
      const s = io.sockets.sockets.get(p.id);
      if (s) s.emit("game_started", { gameState: injectScore(buildClientState(room.gameState, p.id), room), gameType: "ttt" });
    });

    if (timerSeconds > 0) startTurnTimer(code);
  });

  // ── Avvia Connect 4 ────────────────────────────────────────
  socket.on("start_game_c4", ({ timerSeconds = 0, randomChance = 0, powerUpsEnabled = false, gridSize = "7x6", gravityEnabled = false, popOutEnabled = false } = {}) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room) return;
    if (room.players[0].id !== socket.id) { socket.emit("error", { message: "Solo l'host può avviare la partita." }); return; }
    if (room.players.length < 2) { socket.emit("error", { message: "Servono 2 giocatori." }); return; }

    room.status = "playing";
    room.gameType = "c4";
    room.gameState = c4Init(room.players, timerSeconds, randomChance, powerUpsEnabled, gridSize, gravityEnabled, popOutEnabled);

    room.players.forEach(p => {
      const s = io.sockets.sockets.get(p.id);
      if (s) s.emit("game_started", { gameState: injectScore(room.gameState, room), gameType: "c4" });
    });

    if (timerSeconds > 0) startTurnTimer(code);
  });

  // ── Avvia Battleship ───────────────────────────────────────
  socket.on("start_game_bs", ({ timerSeconds = 0, powerUpsEnabled = false, fogOfWarEnabled = false, gridSize = "10x10" } = {}) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room) return;
    if (room.players[0].id !== socket.id) { socket.emit("error", { message: "Solo l'host può avviare la partita." }); return; }
    if (room.players.length < 2) { socket.emit("error", { message: "Servono 2 giocatori." }); return; }

    room.status = "playing";
    room.gameType = "bs";
    room.gameState = bsInit(room.players, timerSeconds, powerUpsEnabled, fogOfWarEnabled, gridSize);

    // Nella fase di placement ogni giocatore vede solo la propria board
    room.players.forEach(p => {
      const s = io.sockets.sockets.get(p.id);
      if (s) s.emit("game_started", {
        gameState: injectScore({ ...room.gameState, boards: { [p.id]: room.gameState.boards[p.id] } }, room),
        gameType: "bs",
        shipConfig: room.gameState.shipConfig,
        gridSize,
      });
    });

    console.log(`[BS] Avviata — griglia:${gridSize} powerUps:${powerUpsEnabled} fog:${fogOfWarEnabled}`);
  });

  // ── Bot Tris ───────────────────────────────────────────────
  socket.on("create_bot_room", ({ playerName, difficulty = "easy", timerSeconds = 0, randomChance = 0, abilitiesEnabled = false, gridSize = 3 }) => {
    const BOT_ID = `bot_${Date.now()}`;
    const human = { id: socket.id, name: playerName || "Guest", isHost: true };
    const bot   = { id: BOT_ID, name: "🤖 Bot", isHost: false };

    const room = createRoom(human);
    room.score[socket.id] = 0; room.score[BOT_ID] = 0;
    room.botId = BOT_ID; room.humanId = socket.id;
    room.botDifficulty = difficulty; room.isBot = true; room.gameType = "ttt";

    addPlayerToRoom(room.code, bot);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerName = human.name;

    room.status = "playing";
    room.gameState = tttInit([human, bot], timerSeconds, randomChance, abilitiesEnabled, gridSize);

    socket.emit("game_started", { gameState: injectScore(room.gameState, room), isBot: true, botDifficulty: difficulty, gameType: "ttt" });

    if (room.gameState.currentTurn === BOT_ID) scheduleBotMove(room.code);
    else if (timerSeconds > 0) startTurnTimer(room.code);
  });

  // ── Bot Connect 4 ──────────────────────────────────────────
  socket.on("create_bot_room_c4", ({ playerName, difficulty = "easy", timerSeconds = 0, randomChance = 0, powerUpsEnabled = false, gridSize = "7x6", gravityEnabled = false, popOutEnabled = false }) => {
    const BOT_ID = `bot_${Date.now()}`;
    const human = { id: socket.id, name: playerName || "Guest", isHost: true };
    const bot   = { id: BOT_ID, name: "🤖 Bot", isHost: false };

    const room = createRoom(human);
    room.score[socket.id] = 0; room.score[BOT_ID] = 0;
    room.botId = BOT_ID; room.humanId = socket.id;
    room.botDifficulty = difficulty; room.isBot = true; room.gameType = "c4";

    addPlayerToRoom(room.code, bot);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerName = human.name;

    room.status = "playing";
    room.gameState = c4Init([human, bot], timerSeconds, randomChance, powerUpsEnabled, gridSize, gravityEnabled, popOutEnabled);

    socket.emit("game_started", { gameState: injectScore(room.gameState, room), isBot: true, botDifficulty: difficulty, gameType: "c4" });

    if (room.gameState.currentTurn === BOT_ID) scheduleBotMove(room.code);
    else if (timerSeconds > 0) startTurnTimer(room.code);
  });

  // ── Bot Battleship ─────────────────────────────────────────
  socket.on("create_bot_room_bs", ({ playerName, difficulty = "easy", timerSeconds = 0, powerUpsEnabled = false, fogOfWarEnabled = false, gridSize = "10x10" }) => {
    const BOT_ID = `bot_${Date.now()}`;
    const human = { id: socket.id, name: playerName || "Guest", isHost: true };
    const bot   = { id: BOT_ID, name: "🤖 Bot", isHost: false };

    const room = createRoom(human);
    room.score[socket.id] = 0; room.score[BOT_ID] = 0;
    room.botId = BOT_ID; room.humanId = socket.id;
    room.botDifficulty = difficulty; room.isBot = true; room.gameType = "bs";

    addPlayerToRoom(room.code, bot);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerName = human.name;

    room.status = "playing";
    room.gameState = bsInit([human, bot], timerSeconds, powerUpsEnabled, fogOfWarEnabled, gridSize);

    // Piazza le navi del bot casualmente
    const { ships: shipConfig } = bsConfig(gridSize);
    const botShips = bsRandomShips(room.gameState.size, shipConfig);
    bsPlace(room.gameState, BOT_ID, botShips);

    // Invia al giocatore umano la fase di placement
    socket.emit("game_started", {
      gameState: injectScore({ ...room.gameState, boards: { [socket.id]: room.gameState.boards[socket.id] } }, room),
      isBot: true,
      botDifficulty: difficulty,
      gameType: "bs",
      shipConfig: room.gameState.shipConfig,
      gridSize,
    });

    console.log(`[BS-BOT] Partita vs bot — difficoltà:${difficulty} griglia:${gridSize}`);
  });

  // ── Piazza navi Battleship ─────────────────────────────────
  socket.on("place_ships_bs", ({ ships }) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room || room.gameType !== "bs") return;
    if (room.gameState.phase !== "placement") { socket.emit("error", { message: "Fase di posizionamento terminata." }); return; }

    const result = bsPlace(room.gameState, socket.id, ships);
    if (result.error) { socket.emit("error", { message: result.error }); return; }

    socket.emit("ships_placed", { ready: true });

    if (result.allReady) {
      // Entrambi pronti — inizia la partita
      if (room.isBot) {
        const humanSocket = io.sockets.sockets.get(room.humanId);
        if (humanSocket) humanSocket.emit("battle_start", { gameState: buildBsClientState(room, room.humanId) });
        // Se tocca al bot per primo
        if (room.gameState.currentTurn === room.botId) scheduleBsBotMove(code);
        else if (room.gameState.timerSeconds > 0) startTurnTimer(code);
      } else {
        room.players.forEach(p => {
          const s = io.sockets.sockets.get(p.id);
          if (s) s.emit("battle_start", { gameState: buildBsClientState(room, p.id) });
        });
        if (room.gameState.timerSeconds > 0) startTurnTimer(code);
      }
    } else {
      // Notifica l'avversario che l'altro è pronto
      if (!room.isBot) {
        room.players.forEach(p => {
          if (p.id !== socket.id) {
            const s = io.sockets.sockets.get(p.id);
            if (s) s.emit("opponent_ready", {});
          }
        });
      }
    }
  });

  // ── Attacco Battleship ─────────────────────────────────────
  socket.on("attack_bs", ({ row, col }) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room || room.gameType !== "bs" || room.gameState.phase !== "playing") return;

    const result = bsAttack(room.gameState, socket.id, row, col);
    if (result.error) { socket.emit("error", { message: result.error }); return; }

    clearTurnTimer(code);
    if (room.gameState.phase === "finished") { updateScore(room); room.status = "finished"; }

    emitBsUpdate(room, result);

    if (room.gameState.phase === "finished") return;

    // Se ha colpito, continua a giocare
    if (result.hit) {
      if (room.isBot || room.gameState.timerSeconds > 0) startTurnTimer(code);
    } else {
      if (room.isBot && room.gameState.currentTurn === room.botId) scheduleBsBotMove(code);
      else if (room.gameState.timerSeconds > 0) startTurnTimer(code);
    }
  });

  // ── Power-up Battleship ────────────────────────────────────
  socket.on("use_powerup_bs", ({ powerUpName, row, col, isRow, index }) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room || room.gameType !== "bs" || room.gameState.phase !== "playing") return;

    const result = bsPowerUp(room.gameState, socket.id, powerUpName, { row, col, isRow, index });
    if (result.error) { socket.emit("error", { message: result.error }); return; }

    clearTurnTimer(code);
    if (room.gameState.phase === "finished") { updateScore(room); room.status = "finished"; }

    if (room.isBot) {
      const humanSocket = io.sockets.sockets.get(room.humanId);
      if (humanSocket) humanSocket.emit("powerup_used_bs", { powerUpName, ...result, gameState: buildBsClientState(room, room.humanId) });
    } else {
      room.players.forEach(p => {
        const s = io.sockets.sockets.get(p.id);
        if (s) s.emit("powerup_used_bs", { powerUpName, ...result, gameState: buildBsClientState(room, p.id) });
      });
    }

    if (room.gameState.phase === "finished") return;
    if (room.isBot && room.gameState.currentTurn === room.botId) scheduleBsBotMove(code);
    else if (room.gameState.timerSeconds > 0) startTurnTimer(code);
  });

  // ── Mossa Tris ─────────────────────────────────────────────
  socket.on("player_move", ({ index }) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room || room.status !== "playing") return;

    const result = tttMove(room.gameState, socket.id, index);
    if (result.error) { socket.emit("error", { message: result.error }); return; }
    clearTurnTimer(code);

    if (room.gameState.status === "finished") { updateScore(room); room.status = "finished"; }

    if (room.isBot) {
      socket.emit("game_update", { gameState: injectScore(room.gameState, room), ...result });
    } else {
      room.players.forEach(p => {
        const s = io.sockets.sockets.get(p.id);
        if (s) s.emit("game_update", { gameState: injectScore(buildClientState(room.gameState, p.id), room), ...result });
      });
    }

    if (room.gameState.status === "finished") return;
    if (room.isBot && room.gameState.currentTurn === room.botId) scheduleBotMove(code);
    else if (room.gameState.timerSeconds > 0) startTurnTimer(code);
  });

  // ── Mossa Connect 4 ────────────────────────────────────────
  socket.on("player_move_c4", ({ col }) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room || room.status !== "playing") return;

    const result = c4Move(room.gameState, socket.id, col);
    if (result.error) { socket.emit("error", { message: result.error }); return; }
    clearTurnTimer(code);

    if (room.gameState.status === "finished") { updateScore(room); room.status = "finished"; }
    if (result.gravityFlipped) io.to(code).emit("gravity_flip", { gravityDir: result.gravityDir });

    emitC4Update(room, result);

    if (room.gameState.status === "finished") return;
    if (room.isBot && room.gameState.currentTurn === room.botId) scheduleBotMove(code);
    else if (room.gameState.timerSeconds > 0) startTurnTimer(code);
  });

  // ── Pop Out Connect 4 ──────────────────────────────────────
  socket.on("player_popout_c4", ({ col }) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room || room.status !== "playing") return;

    const result = c4PopOut(room.gameState, socket.id, col);
    if (result.error) { socket.emit("error", { message: result.error }); return; }
    clearTurnTimer(code);

    if (room.gameState.status === "finished") { updateScore(room); room.status = "finished"; }
    if (result.gravityFlipped) io.to(code).emit("gravity_flip", { gravityDir: result.gravityDir });

    emitC4Update(room, { ...result, isPopOut: true });

    if (room.gameState.status === "finished") return;
    if (room.isBot && room.gameState.currentTurn === room.botId) scheduleBotMove(code);
    else if (room.gameState.timerSeconds > 0) startTurnTimer(code);
  });

  // ── Power-up Connect 4 ─────────────────────────────────────
  socket.on("use_powerup_c4", ({ powerUpName, row, col }) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room || room.status !== "playing") return;

    const result = c4PowerUp(room.gameState, socket.id, powerUpName, { row, col });
    if (result.error) { socket.emit("error", { message: result.error }); return; }
    clearTurnTimer(code);

    if (room.gameState.status === "finished") { updateScore(room); room.status = "finished"; }

    if (room.isBot) {
      socket.emit("powerup_used", { playerId: socket.id, powerUpName, gameState: injectScore(room.gameState, room) });
    } else {
      room.players.forEach(p => {
        const s = io.sockets.sockets.get(p.id);
        if (s) s.emit("powerup_used", { playerId: socket.id, powerUpName, gameState: injectScore(room.gameState, room) });
      });
    }

    if (room.gameState.status === "finished") return;
    if (room.isBot && room.gameState.currentTurn === room.botId) scheduleBotMove(code);
    else if (room.gameState.timerSeconds > 0) startTurnTimer(code);
  });

  // ── Abilità Tris ───────────────────────────────────────────
  socket.on("use_ability", ({ abilityName, targetIndex, index }) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room || room.status !== "playing") return;

    const result = handleAbility(room.gameState, socket.id, abilityName, { targetIndex, index });
    if (result.error) { socket.emit("error", { message: result.error }); return; }
    clearTurnTimer(code);

    if (room.gameState.status === "finished") { updateScore(room); room.status = "finished"; }

    if (room.isBot) {
      socket.emit("ability_used", { playerId: socket.id, abilityName, gameState: injectScore(room.gameState, room) });
    } else {
      room.players.forEach(p => {
        const s = io.sockets.sockets.get(p.id);
        if (s) s.emit("ability_used", { playerId: socket.id, abilityName, gameState: injectScore(buildClientState(room.gameState, p.id), room) });
      });
    }

    if (room.gameState.status === "finished") return;
    if (room.isBot && room.gameState.currentTurn === room.botId) scheduleBotMove(code);
    else if (room.gameState.timerSeconds > 0) startTurnTimer(code);
  });

  // ── Chat ───────────────────────────────────────────────────
  socket.on("send_message", ({ text }) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = getRoom(code);
    if (!room || room.isBot) return;
    const trimmed = text?.trim();
    if (!trimmed || trimmed.length > 200) return;
    io.to(code).emit("new_message", {
      playerId: socket.id,
      playerName: socket.data.playerName || "Guest",
      text: trimmed,
      timestamp: Date.now(),
    });
  });

  // ── Rivincita ──────────────────────────────────────────────
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

      if (room.gameType === "c4") {
        room.gameState = c4Init([human, bot], prevGs.timerSeconds, prevGs.randomChance, prevGs.powerUpsEnabled, prevGs.gridSize, prevGs.gravityEnabled, prevGs.popOutEnabled);
        socket.emit("game_started", { gameState: injectScore(room.gameState, room), isBot: true, botDifficulty: room.botDifficulty, gameType: "c4" });
      } else if (room.gameType === "bs") {
        room.gameState = bsInit([human, bot], prevGs.timerSeconds, prevGs.powerUpsEnabled, prevGs.fogOfWarEnabled, prevGs.gridSize);
        const { ships: shipConfig } = bsConfig(prevGs.gridSize);
        const botShips = bsRandomShips(room.gameState.size, shipConfig);
        bsPlace(room.gameState, room.botId, botShips);
        socket.emit("game_started", {
          gameState: injectScore({ ...room.gameState, boards: { [socket.id]: room.gameState.boards[socket.id] } }, room),
          isBot: true, botDifficulty: room.botDifficulty, gameType: "bs",
          shipConfig: room.gameState.shipConfig, gridSize: prevGs.gridSize,
        });
      } else {
        room.gameState = tttInit([human, bot], prevGs.timerSeconds, prevGs.randomChance, prevGs.abilitiesEnabled, prevGs.gridSize);
        socket.emit("game_started", { gameState: injectScore(room.gameState, room), isBot: true, botDifficulty: room.botDifficulty, gameType: "ttt" });
      }

      if (room.gameType !== "bs") {
        if (room.gameState.currentTurn === room.botId) scheduleBotMove(code);
        else if (room.gameState.timerSeconds > 0) startTurnTimer(code);
      }
    } else {
      room.status = "waiting";
      room.gameState = null;
      io.to(code).emit("rematch_ready", { room });
    }
  });

  // ── Disconnect ─────────────────────────────────────────────
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
        io.to(code).emit("player_left", { room: updated, message: `${socket.data.playerName} ha lasciato la stanza.` });
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
