// ============================================================
// games/tictactoe.js — Logica di gioco server-side (AUTORITATIVA)
// ============================================================

// Combinazioni vincenti sulla griglia 3×3
const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // righe
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // colonne
  [0, 4, 8], [2, 4, 6],             // diagonali
];

// Inizializza lo stato del gioco per una nuova partita
function initGame(players) {
  return {
    board: Array(9).fill(null),       // null | "X" | "O"
    players: [
      { ...players[0], symbol: "X" },
      { ...players[1], symbol: "O" },
    ],
    currentTurn: players[0].id,       // id del giocatore di turno
    status: "playing",                // playing | finished
    winner: null,                     // null | playerId | "draw"
    winLine: null,                    // [0,1,2] indici della riga vincente
    moveCount: 0,
  };
}

// Gestisce una mossa ricevuta dal client
// Modifica gameState in place e restituisce { error? }
function handleMove(gameState, playerId, index) {
  // Validazioni
  if (gameState.status !== "playing") {
    return { error: "La partita è già terminata." };
  }
  if (gameState.currentTurn !== playerId) {
    return { error: "Non è il tuo turno." };
  }
  if (index < 0 || index > 8 || gameState.board[index] !== null) {
    return { error: "Mossa non valida." };
  }

  // Trova il simbolo del giocatore
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) return { error: "Giocatore non trovato." };

  // Applica la mossa
  gameState.board[index] = player.symbol;
  gameState.moveCount++;

  // Controlla vittoria
  const winLine = checkWin(gameState.board, player.symbol);
  if (winLine) {
    gameState.status = "finished";
    gameState.winner = playerId;
    gameState.winLine = winLine;
    return {};
  }

  // Controlla pareggio
  if (gameState.moveCount === 9) {
    gameState.status = "finished";
    gameState.winner = "draw";
    return {};
  }

  // Passa il turno all'altro giocatore
  const other = gameState.players.find((p) => p.id !== playerId);
  gameState.currentTurn = other.id;

  return {};
}

// Restituisce gli indici della riga vincente o null
function checkWin(board, symbol) {
  for (const line of WIN_LINES) {
    if (line.every((i) => board[i] === symbol)) return line;
  }
  return null;
}

module.exports = { initGame, handleMove };
