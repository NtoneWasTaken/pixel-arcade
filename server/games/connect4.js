// ============================================================
// games/connect4.js — Fase 1 (griglie + power-ups) + Fase 2 (Gravity + PopOut)
// ============================================================

const GRID_CONFIGS = {
  "6x5": { rows: 5, cols: 6, winLen: 4 },
  "7x6": { rows: 6, cols: 7, winLen: 4 },
  "8x7": { rows: 7, cols: 8, winLen: 5 },
};

function getConfig(gridSize) {
  return GRID_CONFIGS[gridSize] || GRID_CONFIGS["7x6"];
}

function initGame(players, timerSeconds = 0, randomChance = 0, powerUpsEnabled = false, gridSize = "7x6", gravityEnabled = false, popOutEnabled = false) {
  const { rows, cols, winLen } = getConfig(gridSize);
  return {
    board: Array(rows).fill(null).map(() => Array(cols).fill(null)),
    players: [
      { ...players[0], symbol: "R" },
      { ...players[1], symbol: "Y" },
    ],
    currentTurn: players[Math.floor(Math.random() * 2)].id,
    status: "playing",
    winner: null,
    winCells: null,
    timerSeconds,
    turnStartedAt: timerSeconds > 0 ? Date.now() : null,
    randomChance,
    powerUpsEnabled,
    gravityEnabled,
    popOutEnabled,
    gridSize,
    rows,
    cols,
    winLen,
    // Gravity: direzione attuale e countdown
    gravityDir: "down",        // "down" | "up"
    turnsUntilFlip: 3,         // ogni 3 turni la gravità si inverte
    totalTurns: 0,
    // Power-ups
    powerUps: powerUpsEnabled ? {
      [players[0].id]: { bomba: 1, extra: 1, shuffle: 1 },
      [players[1].id]: { bomba: 1, extra: 1, shuffle: 1 },
    } : {},
  };
}

// ── Gravità ──────────────────────────────────────────────────

// Restituisce la riga disponibile rispettando la direzione della gravità
function getAvailableRow(board, col, rows, gravityDir) {
  const r = rows || board.length;
  const dir = gravityDir || "down";
  if (dir === "down") {
    for (let i = r - 1; i >= 0; i--) {
      if (board[i][col] === null) return i;
    }
  } else {
    // gravità invertita: la pedina "cade" verso l'alto
    for (let i = 0; i < r; i++) {
      if (board[i][col] === null) return i;
    }
  }
  return -1;
}

// Applica la gravità — riposiziona tutte le pedine nella direzione corretta
function applyGravityToBoard(board, gravityDir) {
  const rows = board.length;
  const cols = board[0].length;
  for (let c = 0; c < cols; c++) {
    const pieces = [];
    for (let r = 0; r < rows; r++) {
      if (board[r][c] !== null) pieces.push(board[r][c]);
    }
    for (let r = 0; r < rows; r++) board[r][c] = null;
    if (gravityDir === "down") {
      // pedine in fondo
      for (let i = 0; i < pieces.length; i++) {
        board[rows - 1 - i][c] = pieces[pieces.length - 1 - i];
      }
    } else {
      // pedine in cima
      for (let i = 0; i < pieces.length; i++) {
        board[i][c] = pieces[i];
      }
    }
  }
}

// Aggiorna la gravità dopo ogni mossa — ritorna true se è appena avvenuto un flip
function tickGravity(gameState) {
  if (!gameState.gravityEnabled) return false;
  gameState.totalTurns++;
  gameState.turnsUntilFlip--;
  if (gameState.turnsUntilFlip <= 0) {
    gameState.gravityDir = gameState.gravityDir === "down" ? "up" : "down";
    gameState.turnsUntilFlip = 3;
    applyGravityToBoard(gameState.board, gameState.gravityDir);
    return true;
  }
  return false;
}

// ── Pop Out ──────────────────────────────────────────────────

function handlePopOut(gameState, playerId, col) {
  if (!gameState.popOutEnabled) return { error: "Pop Out disabilitato." };
  if (gameState.status !== "playing") return { error: "La partita è già terminata." };
  if (gameState.currentTurn !== playerId) return { error: "Non è il tuo turno." };

  const { rows, cols } = gameState;
  if (col < 0 || col >= cols) return { error: "Colonna non valida." };

  const player = gameState.players.find(p => p.id === playerId);

  // La pedina da rimuovere è quella in fondo (gravity down) o in cima (gravity up)
  let targetRow;
  if (gameState.gravityDir === "down") {
    targetRow = rows - 1;
    while (targetRow >= 0 && gameState.board[targetRow][col] === null) targetRow--;
  } else {
    targetRow = 0;
    while (targetRow < rows && gameState.board[targetRow][col] === null) targetRow++;
  }

  if (targetRow < 0 || targetRow >= rows || gameState.board[targetRow][col] === null) {
    return { error: "Colonna vuota!" };
  }
  if (gameState.board[targetRow][col] !== player.symbol) {
    return { error: "Puoi rimuovere solo le tue pedine!" };
  }

  // Rimuovi la pedina e applica gravità
  gameState.board[targetRow][col] = null;
  applyGravityToBoard(gameState.board, gameState.gravityDir);

  // Controlla vittoria avversaria dopo pop out (raro ma possibile)
  const win = checkWinFull(gameState.board, gameState.players, gameState.winLen);
  if (win) {
    gameState.status = "finished";
    gameState.winner = win.winner;
    gameState.winCells = win.cells;
    return { type: "popout", col, targetRow };
  }

  // Tick gravity
  const flipped = tickGravity(gameState);

  const other = gameState.players.find(p => p.id !== playerId);
  gameState.currentTurn = other.id;
  if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();

  return { type: "popout", col, targetRow, gravityFlipped: flipped, gravityDir: gameState.gravityDir };
}

// ── Mossa normale ────────────────────────────────────────────

function handleMove(gameState, playerId, col) {
  if (gameState.status !== "playing") return { error: "La partita è già terminata." };
  if (gameState.currentTurn !== playerId) return { error: "Non è il tuo turno." };

  const { cols, rows } = gameState;
  if (col < 0 || col >= cols) return { error: "Colonna non valida." };

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return { error: "Giocatore non trovato." };

  let actualCol = col;
  let deviated = false;

  if (gameState.randomChance > 0 && Math.random() < gameState.randomChance) {
    const candidates = [];
    if (col > 0 && getAvailableRow(gameState.board, col - 1, rows, gameState.gravityDir) >= 0) candidates.push(col - 1);
    if (col < cols - 1 && getAvailableRow(gameState.board, col + 1, rows, gameState.gravityDir) >= 0) candidates.push(col + 1);
    if (candidates.length > 0) {
      actualCol = candidates[Math.floor(Math.random() * candidates.length)];
      deviated = true;
    }
  }

  const row = getAvailableRow(gameState.board, actualCol, rows, gameState.gravityDir);
  if (row === -1) return { error: "Colonna piena!" };

  gameState.board[row][actualCol] = player.symbol;

  const winCells = checkWin(gameState.board, row, actualCol, player.symbol, gameState.winLen);
  if (winCells) {
    gameState.status = "finished";
    gameState.winner = playerId;
    gameState.winCells = winCells;
    return { deviated, intendedCol: col, actualCol, row };
  }

  if (gameState.board[0].every(cell => cell !== null)) {
    gameState.status = "finished";
    gameState.winner = "draw";
    return { deviated, intendedCol: col, actualCol, row };
  }

  // Tick gravity dopo ogni mossa
  const flipped = tickGravity(gameState);

  const other = gameState.players.find(p => p.id !== playerId);
  gameState.currentTurn = other.id;
  if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();

  return { deviated, intendedCol: col, actualCol, row, gravityFlipped: flipped, gravityDir: gameState.gravityDir };
}

function skipTurn(gameState) {
  const other = gameState.players.find(p => p.id !== gameState.currentTurn);
  gameState.currentTurn = other.id;
  if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();
}

// ── POWER-UPS ────────────────────────────────────────────────

function applyGravity(board) {
  // Usa gravità verso il basso di default (per power-ups)
  applyGravityToBoard(board, "down");
}

function useBomba(gameState, playerId, targetRow, targetCol) {
  const opponent = gameState.players.find(p => p.id !== playerId);
  if (gameState.board[targetRow]?.[targetCol] !== opponent.symbol) {
    return { error: "Devi scegliere una pedina avversaria." };
  }
  gameState.board[targetRow][targetCol] = null;
  applyGravityToBoard(gameState.board, gameState.gravityDir);
  const win = checkWinFull(gameState.board, gameState.players, gameState.winLen);
  if (win) { gameState.status = "finished"; gameState.winner = win.winner; gameState.winCells = win.cells; }
  return {};
}

function useExtra(gameState, playerId, col) {
  const player = gameState.players.find(p => p.id === playerId);
  const { cols, rows } = gameState;
  if (col < 0 || col >= cols) return { error: "Colonna non valida." };

  if (gameState.gravityDir === "down") {
    for (let r = rows - 1; r > 0; r--) gameState.board[r][col] = gameState.board[r - 1][col];
    gameState.board[0][col] = player.symbol;
  } else {
    for (let r = 0; r < rows - 1; r++) gameState.board[r][col] = gameState.board[r + 1][col];
    gameState.board[rows - 1][col] = player.symbol;
  }

  const win = checkWinFull(gameState.board, gameState.players, gameState.winLen);
  if (win) { gameState.status = "finished"; gameState.winner = win.winner; gameState.winCells = win.cells; }
  return {};
}

function useShuffle(gameState, playerId) {
  const player   = gameState.players.find(p => p.id === playerId);
  const opponent = gameState.players.find(p => p.id !== playerId);
  const { rows, cols } = gameState;
  const oppCells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (gameState.board[r][c] === opponent.symbol) oppCells.push({ r, c });

  if (oppCells.length === 0) return { error: "Nessuna pedina avversaria da scambiare." };

  const count = Math.min(2, oppCells.length);
  oppCells.sort(() => Math.random() - 0.5).slice(0, count).forEach(({ r, c }) => {
    gameState.board[r][c] = player.symbol;
  });
  applyGravityToBoard(gameState.board, gameState.gravityDir);
  const win = checkWinFull(gameState.board, gameState.players, gameState.winLen);
  if (win) { gameState.status = "finished"; gameState.winner = win.winner; gameState.winCells = win.cells; }
  return {};
}

function handlePowerUp(gameState, playerId, powerUpName, payload) {
  if (!gameState.powerUpsEnabled) return { error: "Power-up disabilitati." };
  if (gameState.status !== "playing") return { error: "La partita è terminata." };
  if (gameState.currentTurn !== playerId) return { error: "Non è il tuo turno." };

  const playerPU = gameState.powerUps?.[playerId];
  if (!playerPU || playerPU[powerUpName] <= 0) return { error: "Power-up già usato!" };

  let result = {};
  switch (powerUpName) {
    case "bomba":   result = useBomba(gameState, playerId, payload.row, payload.col); break;
    case "extra":   result = useExtra(gameState, playerId, payload.col); break;
    case "shuffle": result = useShuffle(gameState, playerId); break;
    default: return { error: "Power-up non riconosciuto." };
  }

  if (result.error) return result;
  playerPU[powerUpName] = 0;

  if (gameState.status === "playing") {
    const other = gameState.players.find(p => p.id !== playerId);
    gameState.currentTurn = other.id;
    if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();
  }
  return {};
}

// ── Controllo vittoria ───────────────────────────────────────

function checkWin(board, row, col, symbol, winLen) {
  const wl = winLen || 4;
  const rows = board.length;
  const cols = board[0].length;
  const directions = [[0,1],[1,0],[1,1],[1,-1]];

  for (const [dr, dc] of directions) {
    const cells = [{ row, col }];
    for (let i = 1; i < wl; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r < 0 || r >= rows || c < 0 || c >= cols || board[r][c] !== symbol) break;
      cells.push({ row: r, col: c });
    }
    for (let i = 1; i < wl; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r < 0 || r >= rows || c < 0 || c >= cols || board[r][c] !== symbol) break;
      cells.push({ row: r, col: c });
    }
    if (cells.length >= wl) return cells.slice(0, wl);
  }
  return null;
}

function checkWinFull(board, players, winLen) {
  const rows = board.length;
  const cols = board[0].length;
  for (const player of players) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c] !== player.symbol) continue;
        const cells = checkWin(board, r, c, player.symbol, winLen);
        if (cells) return { winner: player.id, cells };
      }
    }
  }
  return null;
}

// ── BOT ─────────────────────────────────────────────────────

function getBotMove(board, difficulty, botSymbol, rows, cols, winLen, gravityDir) {
  const r  = rows || board.length;
  const c  = cols || board[0].length;
  const wl = winLen || 4;
  const gd = gravityDir || "down";
  if (difficulty === "easy") return getBotMoveEasy(board, r, c, gd);
  return getBotMoveHard(board, botSymbol, r, c, wl, gd);
}

function getBotMoveEasy(board, rows, cols, gravityDir) {
  const available = [];
  for (let c = 0; c < cols; c++)
    if (getAvailableRow(board, c, rows, gravityDir) >= 0) available.push(c);
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function getBotMoveHard(board, botSymbol, rows, cols, winLen, gravityDir) {
  const playerSymbol = botSymbol === "R" ? "Y" : "R";
  const MAX_DEPTH = winLen === 5 ? 4 : 6;
  let bestScore = -Infinity, bestCol = null;

  for (let c = 0; c < cols; c++) {
    const row = getAvailableRow(board, c, rows, gravityDir);
    if (row === -1) continue;
    board[row][c] = botSymbol;
    const score = minimax(board, MAX_DEPTH - 1, false, botSymbol, playerSymbol, -Infinity, Infinity, rows, cols, winLen, gravityDir);
    board[row][c] = null;
    if (score > bestScore) { bestScore = score; bestCol = c; }
  }
  return bestCol;
}

function minimax(board, depth, isMaximizing, botSymbol, playerSymbol, alpha, beta, rows, cols, winLen, gravityDir) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c] === botSymbol && checkWin(board, r, c, botSymbol, winLen)) return 1000 + depth;
      if (board[r][c] === playerSymbol && checkWin(board, r, c, playerSymbol, winLen)) return -(1000 + depth);
    }
  }

  const isDraw = board[0].every(cell => cell !== null);
  if (isDraw || depth === 0) return evaluate(board, botSymbol, playerSymbol, rows, cols, winLen);

  if (isMaximizing) {
    let best = -Infinity;
    for (let c = 0; c < cols; c++) {
      const row = getAvailableRow(board, c, rows, gravityDir);
      if (row === -1) continue;
      board[row][c] = botSymbol;
      best = Math.max(best, minimax(board, depth - 1, false, botSymbol, playerSymbol, alpha, beta, rows, cols, winLen, gravityDir));
      board[row][c] = null;
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (let c = 0; c < cols; c++) {
      const row = getAvailableRow(board, c, rows, gravityDir);
      if (row === -1) continue;
      board[row][c] = playerSymbol;
      best = Math.min(best, minimax(board, depth - 1, true, botSymbol, playerSymbol, alpha, beta, rows, cols, winLen, gravityDir));
      board[row][c] = null;
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function evaluate(board, botSymbol, playerSymbol, rows, cols, winLen) {
  let score = 0;
  const centerCol = Math.floor(cols / 2);
  for (let r = 0; r < rows; r++)
    if (board[r][centerCol] === botSymbol) score += 3;

  const directions = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of directions) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const window = [];
        for (let i = 0; i < winLen; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) window.push(board[nr][nc]);
        }
        if (window.length === winLen) score += scoreWindow(window, botSymbol, playerSymbol);
      }
    }
  }
  return score;
}

function scoreWindow(window, botSymbol, playerSymbol) {
  const bot    = window.filter(c => c === botSymbol).length;
  const player = window.filter(c => c === playerSymbol).length;
  const empty  = window.filter(c => c === null).length;
  if (bot === window.length) return 100;
  if (bot === window.length - 1 && empty === 1) return 5;
  if (bot === window.length - 2 && empty === 2) return 2;
  if (player === window.length - 1 && empty === 1) return -4;
  return 0;
}

module.exports = { initGame, handleMove, handlePopOut, handlePowerUp, skipTurn, getBotMove, getAvailableRow, GRID_CONFIGS };
