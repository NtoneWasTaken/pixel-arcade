// ============================================================
// games/tictactoe.js — Logica server + timer + random + abilità + bot
//                      Supporto griglie 3x3 / 4x4 / 5x5 + Ultimate TTT
// ============================================================

// ── WIN_LINES dinamiche (griglie normali) ────────────────────

function getWinLines(gridSize) {
  const winLen = gridSize === 3 ? 3 : 4;
  const lines = [];

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

const ULTIMATE_META_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

// ── initGame ─────────────────────────────────────────────────

function initGame(players, timerSeconds = 0, randomChance = 0, abilitiesEnabled = false, gridSize = 3) {
  if (gridSize === "ultimate") {
    return initUltimateGame(players, timerSeconds, randomChance);
  }

  const total = gridSize * gridSize;
  return {
    mode: "normal",
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

// ── Ultimate TTT init ─────────────────────────────────────────

function initUltimateGame(players, timerSeconds = 0, randomChance = 0) {
  // subBoards: array di 9 sotto-griglie, ognuna con 9 celle
  // metaBoard: chi ha vinto ogni sotto-griglia (null / "X" / "O" / "draw")
  // activeSubBoard: indice della sotto-griglia obbligatoria (null = libera)
  return {
    mode: "ultimate",
    subBoards: Array(9).fill(null).map(() => Array(9).fill(null)),
    metaBoard: Array(9).fill(null),
    activeSubBoard: null, // null = gioca ovunque
    players: [
      { ...players[0], symbol: "X" },
      { ...players[1], symbol: "O" },
    ],
    currentTurn: players[0].id,
    status: "playing",
    winner: null,
    winLine: null,     // linea vincente nella metaBoard
    moveCount: 0,
    timerSeconds,
    turnStartedAt: timerSeconds > 0 ? Date.now() : null,
    randomChance,
    abilitiesEnabled: false, // abilità non supportate in Ultimate
    ghostMove: null,
  };
}

// ── handleMove (dispatcher) ───────────────────────────────────

function handleMove(gameState, playerId, index) {
  if (gameState.mode === "ultimate") {
    return handleUltimateMove(gameState, playerId, index);
  }
  return handleNormalMove(gameState, playerId, index);
}

// ── Mossa normale ─────────────────────────────────────────────

function handleNormalMove(gameState, playerId, index) {
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

// ── Mossa Ultimate ────────────────────────────────────────────
// index è codificato come: subBoardIndex * 9 + cellIndex

function handleUltimateMove(gameState, playerId, index) {
  if (gameState.status !== "playing") return { error: "La partita è già terminata." };
  if (gameState.currentTurn !== playerId) return { error: "Non è il tuo turno." };

  const subBoardIndex = Math.floor(index / 9);
  const cellIndex     = index % 9;

  // Verifica che si giochi nella sotto-griglia corretta
  if (gameState.activeSubBoard !== null && gameState.activeSubBoard !== subBoardIndex) {
    return { error: "Devi giocare nella sotto-griglia evidenziata." };
  }

  // Verifica che la sotto-griglia non sia già conclusa
  if (gameState.metaBoard[subBoardIndex] !== null) {
    return { error: "Questa sotto-griglia è già terminata." };
  }

  // Verifica cella libera
  if (gameState.subBoards[subBoardIndex][cellIndex] !== null) {
    return { error: "Cella già occupata." };
  }

  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) return { error: "Giocatore non trovato." };

  // Deviazione random (cambia solo il cellIndex, stessa sotto-griglia)
  let actualSubBoard = subBoardIndex;
  let actualCell     = cellIndex;
  let deviated = false;

  if (gameState.randomChance > 0 && Math.random() < gameState.randomChance) {
    const freeCells = gameState.subBoards[subBoardIndex]
      .map((c, i) => (c === null && i !== cellIndex ? i : null))
      .filter(i => i !== null);
    if (freeCells.length > 0) {
      actualCell = freeCells[Math.floor(Math.random() * freeCells.length)];
      deviated = true;
    }
  }

  // Esegui la mossa
  gameState.subBoards[actualSubBoard][actualCell] = player.symbol;
  gameState.moveCount++;

  // Controlla se la sotto-griglia è stata vinta
  const subWinLines = getWinLines(3);
  const subWin = checkWin(gameState.subBoards[actualSubBoard], player.symbol, subWinLines);
  if (subWin) {
    gameState.metaBoard[actualSubBoard] = player.symbol;
  } else if (gameState.subBoards[actualSubBoard].every(c => c !== null)) {
    gameState.metaBoard[actualSubBoard] = "draw";
  }

  // Controlla vittoria nella metaBoard
  const metaWin = checkWinMeta(gameState.metaBoard, player.symbol);
  if (metaWin) {
    gameState.status = "finished";
    gameState.winner = playerId;
    gameState.winLine = metaWin; // linea vincente nelle sotto-griglie
    return { deviated, intendedIndex: index, actualIndex: actualSubBoard * 9 + actualCell };
  }

  // Pareggio globale: tutte le sotto-griglie concluse
  if (gameState.metaBoard.every(c => c !== null)) {
    const xWins = gameState.metaBoard.filter(c => c === "X").length;
    const oWins = gameState.metaBoard.filter(c => c === "O").length;
    gameState.status = "finished";
    gameState.winner = "draw";
    return { deviated, intendedIndex: index, actualIndex: actualSubBoard * 9 + actualCell };
  }

  // Determina la prossima sotto-griglia attiva
  // La cella giocata (actualCell) indica la prossima sotto-griglia
  const nextSub = actualCell;
  if (gameState.metaBoard[nextSub] !== null) {
    // Sotto-griglia già conclusa → libera scelta
    gameState.activeSubBoard = null;
  } else {
    gameState.activeSubBoard = nextSub;
  }

  const other = gameState.players.find((p) => p.id !== playerId);
  gameState.currentTurn = other.id;
  if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();

  return { deviated, intendedIndex: index, actualIndex: actualSubBoard * 9 + actualCell };
}

function checkWinMeta(metaBoard, symbol) {
  for (const line of ULTIMATE_META_LINES) {
    if (line.every(i => metaBoard[i] === symbol)) return line;
  }
  return null;
}

// ── ABILITÀ (solo modalità normale) ──────────────────────────

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
  if (gameState.board[index] !== null) return { error: "La cella è già occupata." };
  const player = gameState.players.find((p) => p.id === playerId);
  gameState.ghostMove = { playerId, index, symbol: player.symbol };
  gameState.moveCount++;
  const other = gameState.players.find((p) => p.id !== playerId);
  gameState.currentTurn = other.id;
  if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();
  return {};
}

function handleAbility(gameState, playerId, abilityName, payload) {
  if (gameState.mode === "ultimate") return { error: "Abilità non disponibili in modalità Ultimate." };
  if (!gameState.abilitiesEnabled) return { error: "Abilità disabilitate." };
  if (gameState.status !== "playing") return { error: "La partita è terminata." };
  if (gameState.currentTurn !== playerId) return { error: "Non è il tuo turno." };

  const playerAbilities = gameState.abilities[playerId];
  if (!playerAbilities || playerAbilities[abilityName] <= 0) {
    return { error: "Abilità già usata!" };
  }

  let result = {};
  switch (abilityName) {
    case "scambia": result = useScambia(gameState, playerId, payload.targetIndex); break;
    case "bomba":   result = useBomba(gameState, playerId, payload.targetIndex); break;
    case "fantasma":result = useFantasma(gameState, playerId, payload.index); break;
    default: return { error: "Abilità non riconosciuta." };
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

// ── BOT ──────────────────────────────────────────────────────

function getBotMove(board, difficulty, botSymbol, gridSize = 3, gameState = null) {
  // Ultimate TTT: usa gameState per trovare una mossa valida casuale
  if (gridSize === "ultimate" && gameState) {
    return getBotMoveUltimate(gameState, botSymbol);
  }
  if (difficulty === "easy") return getBotMoveEasy(board);
  return getBotMoveHard(board, botSymbol, gridSize);
}

function getBotMoveEasy(board) {
  const free = board.map((c, i) => c === null ? i : null).filter(i => i !== null);
  if (free.length === 0) return null;
  return free[Math.floor(Math.random() * free.length)];
}

// Bot Ultimate: sceglie una mossa casuale valida (cella libera nella sotto-griglia attiva)
function getBotMoveUltimate(gameState, botSymbol) {
  const { subBoards, metaBoard, activeSubBoard } = gameState;
  const validMoves = [];

  const checkSub = (subIdx) => {
    if (metaBoard[subIdx] !== null) return;
    subBoards[subIdx].forEach((cell, cellIdx) => {
      if (cell === null) validMoves.push(subIdx * 9 + cellIdx);
    });
  };

  if (activeSubBoard !== null) {
    checkSub(activeSubBoard);
  } else {
    for (let i = 0; i < 9; i++) checkSub(i);
  }

  if (validMoves.length === 0) return null;
  return validMoves[Math.floor(Math.random() * validMoves.length)];
}

function getBotMoveHard(board, botSymbol, gridSize) {
  const playerSymbol = botSymbol === "X" ? "O" : "X";
  const winLines = getWinLines(gridSize);
  const maxDepth = gridSize === 3 ? 9 : gridSize === 4 ? 4 : 3;

  let bestScore = -Infinity;
  let bestMove = null;

  for (let i = 0; i < board.length; i++) {
    if (board[i] !== null) continue;
    board[i] = botSymbol;
    const score = minimax(board, 0, false, botSymbol, playerSymbol, winLines, maxDepth);
    board[i] = null;
    if (score > bestScore) { bestScore = score; bestMove = i; }
  }
  return bestMove;
}

function minimax(board, depth, isMaximizing, botSymbol, playerSymbol, winLines, maxDepth) {
  const winBot    = checkWin(board, botSymbol, winLines);
  const winPlayer = checkWin(board, playerSymbol, winLines);
  const free      = board.filter(c => c === null).length;

  if (winBot)    return 10 - depth;
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
