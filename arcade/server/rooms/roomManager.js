// ============================================================
// rooms/roomManager.js — Gestione stanze in memoria
// ============================================================

// Map in-memory: codice → oggetto stanza
const rooms = new Map();

// Genera un codice stanza casuale di 6 caratteri
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // niente O, 0, I, 1
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

// Crea una nuova stanza e ci aggiunge il primo giocatore (host)
function createRoom(player) {
  const code = generateCode();
  const room = {
    code,
    status: "waiting",   // waiting | playing | finished
    players: [player],
    gameState: null,
    createdAt: Date.now(),
  };
  rooms.set(code, room);

  // Auto-pulizia stanze vecchie dopo 2 ore
  setTimeout(() => {
    if (rooms.has(code)) {
      rooms.delete(code);
      console.log(`[ROOM] Auto-pulizia stanza ${code}`);
    }
  }, 2 * 60 * 60 * 1000);

  return room;
}

function getRoom(code) {
  return rooms.get(code) || null;
}

function deleteRoom(code) {
  rooms.delete(code);
}

function addPlayerToRoom(code, player) {
  const room = rooms.get(code);
  if (room) room.players.push(player);
}

function removePlayerFromRoom(code, playerId) {
  const room = rooms.get(code);
  if (!room) return;
  room.players = room.players.filter((p) => p.id !== playerId);
  // Se rimane un giocatore, diventa host
  if (room.players.length === 1) {
    room.players[0].isHost = true;
  }
}

module.exports = { createRoom, getRoom, deleteRoom, addPlayerToRoom, removePlayerFromRoom };
