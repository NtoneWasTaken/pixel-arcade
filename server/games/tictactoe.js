// ============================================================
// games/tictactoe.js — Logica server + timer + random + abilità + bot
//                      Supporto griglie 3x3 / 4x4 / 5x5
// ============================================================

// Genera dinamicamente tutte le WIN_LINES per una griglia NxN
// Su 3x3 → vinci con 3; su 4x4 → vinci con 4; su 5x5 → vinci con 4
function getWinLines(gridSize) {
  const winLen = gridSize === 3 ? 3 : 4; // 5x5 vince con 4 in fila
  const lines = [];
  const total = gridSize * gridSize;

  // Righe
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c <= gridSize - winLen; c++) {
      const line = [];
      for (let k = 0; k < winLen; k++) line.push(r * gridSize + c + k);
      lines.push(line);
    }
  }

  // Colonne
  for (let c = 0; c < gridSize; c++) {
    for (let r = 0; r <= gridSize - winLen; r++) {
      const line = [];
      for (let k = 0; k < winLen; k++) line.push((r + k) * gridSize + c);
      lines.push(line);
    }
  }

  // Diagonali ↘
  for (let r = 0; r <= gridSize - winLen; r++) {
    for (let c = 0; c <= gridSize - winLen; c++) {
      const line = [];
      for (let k = 0; k < winLen; k++) line.push((r + k) * gridSize + (c + k));
      lines.push(line);
    }
  }

  // Diagonali ↙
  for (let r = 0; r <= gridSize - winLen; r++) {
    for (let c = winLen - 1; c < gridSize; c++) {
      const line = [];
      for (let k = 0; k < winLen; k++) line.push((r + k) * gridSize + (c - k));
      lines.push(line);
    }
  }

  return lines;
}

function initGame(players, timerSeconds = 0, randomChance = 0, abilitiesEnabled = false, gridSize = 3) {
  const total = gridSize * gridSize;
  return {
    board: Array(total).fill(null),
    gridSize,
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
    randomChance,
    abilitiesEnabled,
    abilities: {
      [players[0].id]: { scambia: 1, bomba: 1, fantasma: 1 },
      [players[1].id]: { scambia: 1, bomba: 1, fantasma: 1 },
    },
    ghostMove: null,
  };
}

function handleMove(gameState, playerId, index) {
  const total = gameState.gridSize * gameState.gridSize;
  if (gameState.status !== "playing") return { error: "La partita è già terminata." };
  if (gameState.currentTurn !== playerId) return { error: "Non è il tuo turno." };
  if (index < 0 || index >= total || gameState.board[index] !== null) return { error: "Mossa non valida." };

  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) return { error: "Giocatore non trovato." };

  let actualIndex = index;
  let deviated = false;

  if (gameState.randomChance > 0 && Math.random() < gameState.randomChance) {
    const freeCells = gameState.board
      .map((cell, i) => (cell === null && i !== index ? i : null))
      .filter((i) => i !== null);
    if (freeCells.length > 0) {
      actualIndex = freeCells[Math.floor(Math.random() * freeCells.length)];
      deviated = true;
    }
  }

  if (gameState.ghostMove) {
    gameState.board[gameState.ghostMove.index] = gameState.ghostMove.symbol;
    gameState.ghostMove = null;
  }

  gameState.board[actualIndex] = player.symbol;
  gameState.moveCount++;

  const winLines = getWinLines(gameState.gridSize);
  const winLine = checkWin(gameState.board, player.symbol, winLines);
  if (winLine) {
    gameState.status = "finished";
    gameState.winner = playerId;
    gameState.winLine = winLine;
    return { deviated, intendedIndex: index, actualIndex };
  }

  if (gameState.moveCount === total) {
    gameState.status = "finished";
    gameState.winner = "draw";
    return { deviated, intendedIndex: index, actualIndex };
  }

  const other = gameState.players.find((p) => p.id !== playerId);
  gameState.currentTurn = other.id;
  if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();

  return { deviated, intendedIndex: index, actualIndex };
}

// ── ABILITÀ ─────────────────────────────────────────────────

function useScambia(gameState, playerId, targetIndex) {
  const player = gameState.players.find((p) => p.id === playerId);
  const opponent = gameState.players.find((p) => p.id !== playerId);

  if (gameState.board[targetIndex] !== opponent.symbol) {
    return { error: "Devi scegliere una cella dell'avversario." };
  }

  gameState.board[targetIndex] = player.symbol;

  const winLines = getWinLines(gameState.gridSize);
  const winLine = checkWin(gameState.board, player.symbol, winLines);
  if (winLine) {
    gameState.status = "finished";
    gameState.winner = playerId;
    gameState.winLine = winLine;
  }

  return {};
}

function useBomba(gameState, playerId, targetIndex) {
  const opponent = gameState.players.find((p) => p.id !== playerId);

  if (gameState.board[targetIndex] !== opponent.symbol) {
    return { error: "Devi scegliere una cella dell'avversario." };
  }

  gameState.board[targetIndex] = null;
  gameState.moveCount = Math.max(0, gameState.moveCount - 1);

  return {};
}

function useFantasma(gameState, playerId, index) {
  if (gameState.board[index] !== null) {
    return { error: "La cella è già occupata." };
  }

  const player = gameState.players.find((p) => p.id === playerId);

  gameState.ghostMove = { playerId, index, symbol: player.symbol };
  gameState.moveCount++;

  const other = gameState.players.find((p) => p.id !== playerId);
  gameState.currentTurn = other.id;
  if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();

  return {};
}

function handleAbility(gameState, playerId, abilityName, payload) {
  if (!gameState.abilitiesEnabled) return { error: "Abilità disabilitate." };
  if (gameState.status !== "playing") return { error: "La partita è terminata." };
  if (gameState.currentTurn !== playerId) return { error: "Non è il tuo turno." };

  const playerAbilities = gameState.abilities[playerId];
  if (!playerAbilities || playerAbilities[abilityName] <= 0) {
    return { error: "Abilità già usata!" };
  }

  let result = {};

  switch (abilityName) {
    case "scambia":
      result = useScambia(gameState, playerId, payload.targetIndex);
      break;
    case "bomba":
      result = useBomba(gameState, playerId, payload.targetIndex);
      break;
    case "fantasma":
      result = useFantasma(gameState, playerId, payload.index);
      break;
    default:
      return { error: "Abilità non riconosciuta." };
  }

  if (result.error) return result;

  playerAbilities[abilityName] = 0;

  if (abilityName === "scambia" || abilityName === "bomba") {
    if (gameState.status === "playing") {
      const other = gameState.players.find((p) => p.id !== playerId);
      gameState.currentTurn = other.id;
      if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();
    }
  }

  return {};
}

function skipTurn(gameState) {
  const other = gameState.players.find((p) => p.id !== gameState.currentTurn);
  gameState.currentTurn = other.id;
  if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();
}

function checkWin(board, symbol, winLines) {
  for (const line of winLines) {
    if (line.every((i) => board[i] === symbol)) return line;
  }
  return null;
}

// ── BOT ─────────────────────────────────────────────────────

function getBotMove(board, difficulty, botSymbol, gridSize = 3) {
  if (difficulty === "easy") {
    return getBotMoveEasy(board);
  } else {
    return getBotMoveHard(board, botSymbol, gridSize);
  }
}

function getBotMoveEasy(board) {
  const free = board.map((c, i) => c === null ? i : null).filter(i => i !== null);
  if (free.length === 0) return null;
  return free[Math.floor(Math.random() * free.length)];
}

// Difficile: minimax con profondità limitata per griglie grandi
function getBotMoveHard(board, botSymbol, gridSize) {
  const playerSymbol = botSymbol === "X" ? "O" : "X";
  const winLines = getWinLines(gridSize);

  // Profondità in base alla dimensione: 3x3→9, 4x4→4, 5x5→3
  const maxDepth = gridSize === 3 ? 9 : gridSize === 4 ? 4 : 3;

  let bestScore = -Infinity;
  let bestMove = null;

  for (let i = 0; i < board.length; i++) {
    if (board[i] !== null) continue;
    board[i] = botSymbol;
    const score = minimax(board, 0, false, botSymbol, playerSymbol, winLines, maxDepth);
    board[i] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = i;
    }
  }

  return bestMove;
}

function minimax(board, depth, isMaximizing, botSymbol, playerSymbol, winLines, maxDepth) {
  const winBot = checkWin(board, botSymbol, winLines);
  const winPlayer = checkWin(board, playerSymbol, winLines);
  const free = board.filter(c => c === null).length;

  if (winBot) return 10 - depth;
  if (winPlayer) return depth - 10;
  if (free === 0 || depth >= maxDepth) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== null) continue;
      board[i] = botSymbol;
      best = Math.max(best, minimax(board, depth + 1, false, botSymbol, playerSymbol, winLines, maxDepth));
      board[i] = null;
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== null) continue;
      board[i] = playerSymbol;
      best = Math.min(best, minimax(board, depth + 1, true, botSymbol, playerSymbol, winLines, maxDepth));
      board[i] = null;
    }
    return best;
  }
}

module.exports = { initGame, handleMove, handleAbility, skipTurn, getBotMove };
