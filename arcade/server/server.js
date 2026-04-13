// ============================================================
// server.js — Punto di ingresso del backend Socket.io + Express
// ============================================================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { createRoom, getRoom, deleteRoom, addPlayerToRoom, removePlayerFromRoom } = require("./rooms/roomManager");
const { handleMove, initGame } = require("./games/tictactoe");

const app = express();
const server = http.createServer(app);

// Origini consentite (frontend su Cloudflare Pages + localhost)
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  /\.pages\.dev$/,         // qualsiasi sottodominio Cloudflare Pages
];

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

// Health-check per Render
app.get("/", (req, res) => res.json({ status: "ok", message: "Arcade backend running 🎮" }));

// ============================================================
// GESTIONE SOCKET.IO
// ============================================================
io.on("connection", (socket) => {
  console.log(`[+] Client connesso: ${socket.id}`);

  // ----------------------------------------------------------
  // create_room — Crea una nuova stanza
  // Payload: { playerName: string }
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
  // join_room — Entra in una stanza esistente
  // Payload: { roomCode: string, playerName: string }
  // ----------------------------------------------------------
  socket.on("join_room", ({ roomCode, playerName }) => {
    const code = roomCode?.toUpperCase();
    const room = getRoom(code);

    if (!room) {
      socket.emit("error", { message: "Stanza non trovata. Controlla il codice." });
      return;
    }
    if (room.players.length >= 2) {
      socket.emit("error", { message: "Stanza piena!" });
      return;
    }
    if (room.status === "playing") {
      socket.emit("error", { message: "Partita già in corso." });
      return;
    }

    const player = { id: socket.id, name: playerName || "Guest", isHost: false };
    addPlayerToRoom(code, player);

    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerName = player.name;

    // Notifica tutti nella stanza
    io.to(code).emit("player_joined", { room: getRoom(code) });
    console.log(`[ROOM] ${player.name} è entrato in ${code}`);
  });

  // ----------------------------------------------------------
  // start_game — L'host avvia la partita
  // ----------------------------------------------------------
  socket.on("start_game", () => {
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

    // Inizializza stato gioco lato server
    room.status = "playing";
    room.gameState = initGame(room.players);

    io.to(code).emit("game_started", { gameState: room.gameState });
    console.log(`[GAME] Partita avviata in stanza ${code}`);
  });

  // ----------------------------------------------------------
  // player_move — Il client invia una mossa
  // Payload: { index: number }  (0-8 per la griglia 3x3)
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

    // Propaga il nuovo stato a tutti i giocatori
    io.to(code).emit("game_update", { gameState: room.gameState });
    console.log(`[GAME] Mossa ${index} in stanza ${code} — turno: ${room.gameState.currentTurn}`);

    // Fine partita
    if (room.gameState.status === "finished") {
      room.status = "finished";
      console.log(`[GAME] Partita finita in ${code} — vincitore: ${room.gameState.winner}`);
    }
  });

  // ----------------------------------------------------------
  // request_rematch — Richiede rivincita
  // ----------------------------------------------------------
  socket.on("request_rematch", () => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room) return;

    // Reinizializza
    room.status = "waiting";
    room.gameState = null;

    io.to(code).emit("rematch_ready", { room });
  });

  // ----------------------------------------------------------
  // disconnect — Gestione disconnessione
  // ----------------------------------------------------------
  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code) return;

    const room = getRoom(code);
    if (room) {
      removePlayerFromRoom(code, socket.id);
      const updated = getRoom(code);

      if (!updated || updated.players.length === 0) {
        deleteRoom(code);
        console.log(`[ROOM] Stanza ${code} eliminata (vuota)`);
      } else {
        // Notifica gli altri che un giocatore è uscito
        io.to(code).emit("player_left", {
          room: updated,
          message: `${socket.data.playerName} ha lasciato la stanza.`,
        });
        // Se la partita era in corso, la si interrompe
        if (updated.status === "playing") {
          updated.status = "waiting";
          updated.gameState = null;
          io.to(code).emit("game_aborted", { message: "L'avversario ha abbandonato la partita." });
        }
      }
    }

    console.log(`[-] Client disconnesso: ${socket.id}`);
  });
});

// ============================================================
// AVVIO SERVER
// ============================================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎮 Server in ascolto su porta ${PORT}`);
});
