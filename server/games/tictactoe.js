// ============================================================
// games/tictactoe.js — Logica server-side + timer blitz
// ============================================================

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

// Inizializza stato gioco — ora accetta anche timerSeconds
function initGame(players, timerSeconds = 0) {
  return {
    board: Array(9).fill(null),
    players: [
      { ...players[0], symbol: "X" },
      { ...players[1], symbol: "O" },
    ],
    currentTurn: players[0].id,
    status: "playing",
    winner: null,
    winLine: null,
    moveCount: 0,
    timerSeconds,        // 0 = nessun timer
    turnStartedAt: timerSeconds > 0 ? Date.now() : null,
  };
}

function handleMove(gameState, playerId, index) {
  if (gameState.status !== "playing") return { error: "La partita è già terminata." };
  if (gameState.currentTurn !== playerId) return { error: "Non è il tuo turno." };
  if (index < 0 || index > 8 || gameState.board[index] !== null) return { error: "Mossa non valida." };

  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) return { error: "Giocatore non trovato." };

  gameState.board[index] = player.symbol;
  gameState.moveCount++;

  const winLine = checkWin(gameState.board, player.symbol);
  if (winLine) {
    gameState.status = "finished";
    gameState.winner = playerId;
    gameState.winLine = winLine;
    return {};
  }

  if (gameState.moveCount === 9) {
    gameState.status = "finished";
    gameState.winner = "draw";
    return {};
  }

  // Passa il turno
  const other = gameState.players.find((p) => p.id !== playerId);
  gameState.currentTurn = other.id;

  // Resetta il timestamp del turno se il timer è attivo
  if (gameState.timerSeconds > 0) {
    gameState.turnStartedAt = Date.now();
  }

  return {};
}

// Chiamato dal server quando il timer scade — salta il turno
function skipTurn(gameState) {
  const other = gameState.players.find((p) => p.id !== gameState.currentTurn);
  gameState.currentTurn = other.id;
  if (gameState.timerSeconds > 0) {
    gameState.turnStartedAt = Date.now();
  }
}

function checkWin(board, symbol) {
  for (const line of WIN_LINES) {
    if (line.every((i) => board[i] === symbol)) return line;
  }
  return null;
}

module.exports = { initGame, handleMove, skipTurn };
