// ============================================================
// games/tictactoe.js — Logica server-side + timer + modalità random
// ============================================================

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

// Inizializza stato gioco
function initGame(players, timerSeconds = 0, randomChance = 0) {
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
    timerSeconds,
    turnStartedAt: timerSeconds > 0 ? Date.now() : null,
    randomChance,   // 0 | 0.2 | 0.4 | 0.6
  };
}

// Gestisce una mossa — restituisce { error?, deviated?, intendedIndex, actualIndex }
function handleMove(gameState, playerId, index) {
  if (gameState.status !== "playing") return { error: "La partita è già terminata." };
  if (gameState.currentTurn !== playerId) return { error: "Non è il tuo turno." };
  if (index < 0 || index > 8 || gameState.board[index] !== null) return { error: "Mossa non valida." };

  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) return { error: "Giocatore non trovato." };

  let actualIndex = index;
  let deviated = false;

  // Modalità Random — il server decide se deviare
  if (gameState.randomChance > 0 && Math.random() < gameState.randomChance) {
    const freeCells = gameState.board
      .map((cell, i) => (cell === null && i !== index ? i : null))
      .filter((i) => i !== null);

    if (freeCells.length > 0) {
      actualIndex = freeCells[Math.floor(Math.random() * freeCells.length)];
      deviated = true;
    }
  }

  gameState.board[actualIndex] = player.symbol;
  gameState.moveCount++;

  const winLine = checkWin(gameState.board, player.symbol);
  if (winLine) {
    gameState.status = "finished";
    gameState.winner = playerId;
    gameState.winLine = winLine;
    return { deviated, intendedIndex: index, actualIndex };
  }

  if (gameState.moveCount === 9) {
    gameState.status = "finished";
    gameState.winner = "draw";
    return { deviated, intendedIndex: index, actualIndex };
  }

  const other = gameState.players.find((p) => p.id !== playerId);
  gameState.currentTurn = other.id;

  if (gameState.timerSeconds > 0) {
    gameState.turnStartedAt = Date.now();
  }

  return { deviated, intendedIndex: index, actualIndex };
}

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
