// ============================================================
// games/connect4.js — Logica Connect 4 + bot
// ============================================================

const ROWS = 6;
const COLS = 7;

function initGame(players, timerSeconds = 0, randomChance = 0) {
  // Board: array di 6 righe x 7 colonne, null = vuoto
  return {
    board: Array(ROWS).fill(null).map(() => Array(COLS).fill(null)),
    players: [
      { ...players[0], symbol: "R" }, // rosso
      { ...players[1], symbol: "Y" }, // giallo
    ],
    currentTurn: players[Math.floor(Math.random() * 2)].id,
    status: "playing",
    winner: null,
    winCells: null,   // array di {row,col} delle 4 celle vincenti
    timerSeconds,
    turnStartedAt: timerSeconds > 0 ? Date.now() : null,
    randomChance,
    rows: ROWS,
    cols: COLS,
  };
}

// Restituisce la riga disponibile in una colonna (-1 se piena)
function getAvailableRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === null) return r;
  }
  return -1;
}

function handleMove(gameState, playerId, col) {
  if (gameState.status !== "playing") return { error: "La partita è già terminata." };
  if (gameState.currentTurn !== playerId) return { error: "Non è il tuo turno." };
  if (col < 0 || col >= COLS) return { error: "Colonna non valida." };

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return { error: "Giocatore non trovato." };

  let actualCol = col;
  let deviated = false;

  // Modalità random — devia su colonna adiacente valida
  if (gameState.randomChance > 0 && Math.random() < gameState.randomChance) {
    const candidates = [];
    if (col > 0 && getAvailableRow(gameState.board, col - 1) >= 0) candidates.push(col - 1);
    if (col < COLS - 1 && getAvailableRow(gameState.board, col + 1) >= 0) candidates.push(col + 1);
    if (candidates.length > 0) {
      actualCol = candidates[Math.floor(Math.random() * candidates.length)];
      deviated = true;
    }
  }

  const row = getAvailableRow(gameState.board, actualCol);
  if (row === -1) return { error: "Colonna piena!" };

  gameState.board[row][actualCol] = player.symbol;

  const winCells = checkWin(gameState.board, row, actualCol, player.symbol);
  if (winCells) {
    gameState.status = "finished";
    gameState.winner = playerId;
    gameState.winCells = winCells;
    return { deviated, intendedCol: col, actualCol, row };
  }

  // Pareggio — tutte le celle piene
  if (gameState.board[0].every(cell => cell !== null)) {
    gameState.status = "finished";
    gameState.winner = "draw";
    return { deviated, intendedCol: col, actualCol, row };
  }

  const other = gameState.players.find(p => p.id !== playerId);
  gameState.currentTurn = other.id;
  if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();

  return { deviated, intendedCol: col, actualCol, row };
}

function skipTurn(gameState) {
  const other = gameState.players.find(p => p.id !== gameState.currentTurn);
  gameState.currentTurn = other.id;
  if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();
}

// Controlla vittoria a partire dalla cella appena piazzata
function checkWin(board, row, col, symbol) {
  const directions = [
    [0, 1],   // orizzontale
    [1, 0],   // verticale
    [1, 1],   // diagonale \
    [1, -1],  // diagonale /
  ];

  for (const [dr, dc] of directions) {
    const cells = [{ row, col }];

    // Avanti
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== symbol) break;
      cells.push({ row: r, col: c });
    }
    // Indietro
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== symbol) break;
      cells.push({ row: r, col: c });
    }

    if (cells.length >= 4) return cells.slice(0, 4);
  }
  return null;
}

// ── BOT ─────────────────────────────────────────────────────

function getBotMove(board, difficulty, botSymbol) {
  if (difficulty === "easy") return getBotMoveEasy(board);
  return getBotMoveHard(board, botSymbol);
}

function getBotMoveEasy(board) {
  const available = [];
  for (let c = 0; c < COLS; c++) {
    if (getAvailableRow(board, c) >= 0) available.push(c);
  }
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function getBotMoveHard(board, botSymbol) {
  const playerSymbol = botSymbol === "R" ? "Y" : "R";
  const MAX_DEPTH = 6;

  let bestScore = -Infinity;
  let bestCol = null;

  for (let c = 0; c < COLS; c++) {
    const row = getAvailableRow(board, c);
    if (row === -1) continue;
    board[row][c] = botSymbol;
    const score = minimax(board, MAX_DEPTH - 1, false, botSymbol, playerSymbol, -Infinity, Infinity);
    board[row][c] = null;
    if (score > bestScore) { bestScore = score; bestCol = c; }
  }

  return bestCol;
}

function minimax(board, depth, isMaximizing, botSymbol, playerSymbol, alpha, beta) {
  // Controlla se qualcuno ha vinto
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === botSymbol && checkWin(board, r, c, botSymbol)) return 1000 + depth;
      if (board[r][c] === playerSymbol && checkWin(board, r, c, playerSymbol)) return -(1000 + depth);
    }
  }

  // Pareggio o profondità massima
  const isDraw = board[0].every(cell => cell !== null);
  if (isDraw || depth === 0) return evaluate(board, botSymbol, playerSymbol);

  if (isMaximizing) {
    let best = -Infinity;
    for (let c = 0; c < COLS; c++) {
      const row = getAvailableRow(board, c);
      if (row === -1) continue;
      board[row][c] = botSymbol;
      best = Math.max(best, minimax(board, depth - 1, false, botSymbol, playerSymbol, alpha, beta));
      board[row][c] = null;
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (let c = 0; c < COLS; c++) {
      const row = getAvailableRow(board, c);
      if (row === -1) continue;
      board[row][c] = playerSymbol;
      best = Math.min(best, minimax(board, depth - 1, true, botSymbol, playerSymbol, alpha, beta));
      board[row][c] = null;
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

// Valutazione euristica della board
function evaluate(board, botSymbol, playerSymbol) {
  let score = 0;

  // Centro preferito
  const centerCol = Math.floor(COLS / 2);
  for (let r = 0; r < ROWS; r++) {
    if (board[r][centerCol] === botSymbol) score += 3;
  }

  // Valuta finestre di 4 in tutte le direzioni
  const directions = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of directions) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const window = [];
        for (let i = 0; i < 4; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) window.push(board[nr][nc]);
        }
        if (window.length === 4) score += scoreWindow(window, botSymbol, playerSymbol);
      }
    }
  }

  return score;
}

function scoreWindow(window, botSymbol, playerSymbol) {
  const bot    = window.filter(c => c === botSymbol).length;
  const player = window.filter(c => c === playerSymbol).length;
  const empty  = window.filter(c => c === null).length;

  if (bot === 4) return 100;
  if (bot === 3 && empty === 1) return 5;
  if (bot === 2 && empty === 2) return 2;
  if (player === 3 && empty === 1) return -4;
  return 0;
}

module.exports = { initGame, handleMove, skipTurn, getBotMove, getAvailableRow, ROWS, COLS };
