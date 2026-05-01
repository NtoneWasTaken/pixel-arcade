// ============================================================
// games/battleship.js — Logica Battleship completa
// ============================================================

const GRID_CONFIGS = {
  "8x8":  { size: 8,  ships: [
    { id: "corazzata",        name: "Corazzata",        size: 4 },
    { id: "incrociatore",     name: "Incrociatore",     size: 3 },
    { id: "sottomarino",      name: "Sottomarino",      size: 3 },
    { id: "cacciatorpediniere", name: "Cacciatorpediniere", size: 2 },
  ]},
  "10x10": { size: 10, ships: [
    { id: "portaerei",        name: "Portaerei",        size: 5 },
    { id: "corazzata",        name: "Corazzata",        size: 4 },
    { id: "incrociatore",     name: "Incrociatore",     size: 3 },
    { id: "sottomarino",      name: "Sottomarino",      size: 3 },
    { id: "cacciatorpediniere", name: "Cacciatorpediniere", size: 2 },
  ]},
  "12x12": { size: 12, ships: [
    { id: "supercorazzata",   name: "Supercorazzata",   size: 6 },
    { id: "portaerei",        name: "Portaerei",        size: 5 },
    { id: "corazzata",        name: "Corazzata",        size: 4 },
    { id: "incrociatore",     name: "Incrociatore",     size: 3 },
    { id: "sottomarino",      name: "Sottomarino",      size: 3 },
    { id: "cacciatorpediniere", name: "Cacciatorpediniere", size: 2 },
  ]},
};

function getConfig(gridSize) {
  return GRID_CONFIGS[gridSize] || GRID_CONFIGS["10x10"];
}

// Crea una griglia vuota di dimensione size×size
function makeGrid(size) {
  return Array(size).fill(null).map(() => Array(size).fill(null));
}

function initGame(players, timerSeconds = 0, powerUpsEnabled = false, fogOfWarEnabled = false, gridSize = "10x10") {
  const { size, ships } = getConfig(gridSize);
  return {
    players: [
      { ...players[0] },
      { ...players[1] },
    ],
    phase: "placement",   // "placement" | "playing" | "finished"
    status: "playing",
    winner: null,
    currentTurn: null,    // impostato quando entrambi hanno piazzato le navi
    timerSeconds,
    turnStartedAt: null,
    powerUpsEnabled,
    fogOfWarEnabled,
    gridSize,
    size,
    shipConfig: ships,
    // Stato per ogni giocatore
    boards: {
      [players[0].id]: {
        ships:   [],          // array di navi piazzate
        attacks: makeGrid(size), // null | "miss" | "hit" — colpi ricevuti
        ready:   false,
      },
      [players[1].id]: {
        ships:   [],
        attacks: makeGrid(size),
        ready:   false,
      },
    },
    // Power-up per ogni giocatore
    powerUps: powerUpsEnabled ? {
      [players[0].id]: { bomba2x2: 1, radar: 1, siluro: 1 },
      [players[1].id]: { bomba2x2: 1, radar: 1, siluro: 1 },
    } : {},
  };
}

// ── Validazione posizionamento navi ──────────────────────────

function validateShips(ships, size, shipConfig) {
  if (ships.length !== shipConfig.length) return "Numero di navi non corretto.";

  const occupied = new Set();

  for (const ship of ships) {
    const config = shipConfig.find(s => s.id === ship.id);
    if (!config) return `Nave non riconosciuta: ${ship.id}`;
    if (ship.cells.length !== config.size) return `Dimensione nave ${ship.id} non corretta.`;

    // Controlla che le celle siano adiacenti e in linea retta
    const rows = ship.cells.map(c => c.row);
    const cols = ship.cells.map(c => c.col);
    const allSameRow = rows.every(r => r === rows[0]);
    const allSameCol = cols.every(c => c === cols[0]);

    if (!allSameRow && !allSameCol) return `La nave ${ship.id} non è in linea retta.`;

    // Controlla bounds
    for (const cell of ship.cells) {
      if (cell.row < 0 || cell.row >= size || cell.col < 0 || cell.col >= size) {
        return `La nave ${ship.id} è fuori dalla griglia.`;
      }
      const key = `${cell.row}-${cell.col}`;
      if (occupied.has(key)) return `Sovrapposizione nella nave ${ship.id}.`;
      occupied.add(key);
    }
  }

  return null; // ok
}

function placeShips(gameState, playerId, ships) {
  const board = gameState.boards[playerId];
  if (!board) return { error: "Giocatore non trovato." };
  if (board.ready) return { error: "Hai già piazzato le navi." };

  const err = validateShips(ships, gameState.size, gameState.shipConfig);
  if (err) return { error: err };

  // Inizializza ogni nave con hits=[]
  board.ships = ships.map(s => ({ ...s, hits: [] }));
  board.ready = true;

  // Se entrambi pronti, inizia la partita
  const allReady = Object.values(gameState.boards).every(b => b.ready);
  if (allReady) {
    gameState.phase = "playing";
    gameState.currentTurn = gameState.players[Math.floor(Math.random() * 2)].id;
    if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();
  }

  return { allReady };
}

// ── Attacco ──────────────────────────────────────────────────

function handleAttack(gameState, attackerId, row, col) {
  if (gameState.phase !== "playing") return { error: "La partita non è in corso." };
  if (gameState.currentTurn !== attackerId) return { error: "Non è il tuo turno." };

  const defenderId = gameState.players.find(p => p.id !== attackerId).id;
  const defBoard   = gameState.boards[defenderId];

  if (row < 0 || row >= gameState.size || col < 0 || col >= gameState.size) {
    return { error: "Cella non valida." };
  }
  if (defBoard.attacks[row][col] !== null) return { error: "Cella già colpita." };

  // Controlla se c'è una nave in quella cella
  let hitShip = null;
  for (const ship of defBoard.ships) {
    const cellHit = ship.cells.find(c => c.row === row && c.col === col);
    if (cellHit) { hitShip = ship; break; }
  }

  const isHit = !!hitShip;
  defBoard.attacks[row][col] = isHit ? "hit" : "miss";

  let sunk = false;
  if (hitShip) {
    hitShip.hits.push({ row, col });
    sunk = hitShip.hits.length === hitShip.cells.length;
    if (sunk) hitShip.sunk = true;
  }

  // Controlla vittoria — tutte le navi affondate
  const allSunk = defBoard.ships.every(s => s.sunk);
  if (allSunk) {
    gameState.phase = "finished";
    gameState.status = "finished";
    gameState.winner = attackerId;
    return { row, col, hit: isHit, sunk, shipId: hitShip?.id };
  }

  // Passa il turno solo se mancato (chi colpisce gioca ancora)
  if (!isHit) {
    gameState.currentTurn = defenderId;
    if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();
  }

  return { row, col, hit: isHit, sunk, shipId: hitShip?.id };
}

function skipTurn(gameState) {
  const other = gameState.players.find(p => p.id !== gameState.currentTurn);
  gameState.currentTurn = other.id;
  if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();
}

// ── POWER-UPS ────────────────────────────────────────────────

// 💥 Bomba 2×2 — colpisce area 2×2 a partire dalla cella top-left
function useBomba2x2(gameState, attackerId, row, col) {
  const defenderId = gameState.players.find(p => p.id !== attackerId).id;
  const defBoard   = gameState.boards[defenderId];
  const results    = [];

  for (let dr = 0; dr < 2; dr++) {
    for (let dc = 0; dc < 2; dc++) {
      const r = row + dr, c = col + dc;
      if (r < 0 || r >= gameState.size || c < 0 || c >= gameState.size) continue;
      if (defBoard.attacks[r][c] !== null) continue;

      let hitShip = null;
      for (const ship of defBoard.ships) {
        if (ship.cells.find(cell => cell.row === r && cell.col === c)) { hitShip = ship; break; }
      }

      const isHit = !!hitShip;
      defBoard.attacks[r][c] = isHit ? "hit" : "miss";

      if (hitShip) {
        hitShip.hits.push({ row: r, col: c });
        if (hitShip.hits.length === hitShip.cells.length) hitShip.sunk = true;
      }

      results.push({ row: r, col: c, hit: isHit, shipId: hitShip?.id, sunk: hitShip?.sunk });
    }
  }

  const allSunk = defBoard.ships.every(s => s.sunk);
  if (allSunk) { gameState.phase = "finished"; gameState.status = "finished"; gameState.winner = attackerId; }

  return { results };
}

// 📡 Radar — rivela se c'è almeno una nave in un'area 3×3
function useRadar(gameState, attackerId, row, col) {
  const defenderId = gameState.players.find(p => p.id !== attackerId).id;
  const defBoard   = gameState.boards[defenderId];
  const revealedCells = [];
  let hasShip = false;

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr, c = col + dc;
      if (r < 0 || r >= gameState.size || c < 0 || c >= gameState.size) continue;
      revealedCells.push({ row: r, col: c });
      const shipInCell = defBoard.ships.some(ship =>
        ship.cells.some(cell => cell.row === r && cell.col === c) && !ship.sunk
      );
      if (shipInCell) hasShip = true;
    }
  }

  return { revealedCells, hasShip };
}

// 🎯 Siluro — colpisce tutta una riga o colonna
function useSiluro(gameState, attackerId, isRow, index) {
  const defenderId = gameState.players.find(p => p.id !== attackerId).id;
  const defBoard   = gameState.boards[defenderId];
  const results    = [];

  for (let i = 0; i < gameState.size; i++) {
    const r = isRow ? index : i;
    const c = isRow ? i : index;

    if (defBoard.attacks[r][c] !== null) continue;

    let hitShip = null;
    for (const ship of defBoard.ships) {
      if (ship.cells.find(cell => cell.row === r && cell.col === c)) { hitShip = ship; break; }
    }

    const isHit = !!hitShip;
    defBoard.attacks[r][c] = isHit ? "hit" : "miss";

    if (hitShip) {
      hitShip.hits.push({ row: r, col: c });
      if (hitShip.hits.length === hitShip.cells.length) hitShip.sunk = true;
    }

    results.push({ row: r, col: c, hit: isHit, shipId: hitShip?.id, sunk: hitShip?.sunk });
  }

  const allSunk = defBoard.ships.every(s => s.sunk);
  if (allSunk) { gameState.phase = "finished"; gameState.status = "finished"; gameState.winner = attackerId; }

  return { results, isRow, index };
}

function handlePowerUp(gameState, attackerId, powerUpName, payload) {
  if (!gameState.powerUpsEnabled) return { error: "Power-up disabilitati." };
  if (gameState.phase !== "playing") return { error: "La partita non è in corso." };
  if (gameState.currentTurn !== attackerId) return { error: "Non è il tuo turno." };

  const playerPU = gameState.powerUps?.[attackerId];
  if (!playerPU || playerPU[powerUpName] <= 0) return { error: "Power-up già usato!" };

  let result = {};
  switch (powerUpName) {
    case "bomba2x2": result = useBomba2x2(gameState, attackerId, payload.row, payload.col); break;
    case "radar":    result = useRadar(gameState, attackerId, payload.row, payload.col); break;
    case "siluro":   result = useSiluro(gameState, attackerId, payload.isRow, payload.index); break;
    default: return { error: "Power-up non riconosciuto." };
  }

  if (result.error) return result;
  playerPU[powerUpName] = 0;

  // Passa il turno dopo il power-up (eccetto radar)
  if (powerUpName !== "radar" && gameState.phase === "playing") {
    const other = gameState.players.find(p => p.id !== attackerId);
    gameState.currentTurn = other.id;
    if (gameState.timerSeconds > 0) gameState.turnStartedAt = Date.now();
  }

  return result;
}

// ── BOT ─────────────────────────────────────────────────────

// Genera un layout casuale di navi valido per il bot
function generateRandomShips(size, shipConfig) {
  const occupied = new Set();
  const ships = [];

  for (const config of shipConfig) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 200) {
      attempts++;
      const horizontal = Math.random() > 0.5;
      const row = Math.floor(Math.random() * (horizontal ? size : size - config.size + 1));
      const col = Math.floor(Math.random() * (horizontal ? size - config.size + 1 : size));

      const cells = [];
      let valid = true;

      for (let i = 0; i < config.size; i++) {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        const key = `${r}-${c}`;
        if (occupied.has(key)) { valid = false; break; }
        cells.push({ row: r, col: c });
      }

      if (valid) {
        cells.forEach(c => occupied.add(`${c.row}-${c.col}`));
        ships.push({ id: config.id, cells, hits: [] });
        placed = true;
      }
    }
  }

  return ships;
}

// Bot facile — attacca casualmente
function getBotMoveEasy(attacks, size) {
  const available = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (attacks[r][c] === null) available.push({ row: r, col: c });
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

// Bot difficile — hunt/target algorithm
function getBotMoveHard(attacks, defBoard, size) {
  // Prima controlla se ci sono hit non affondate (target mode)
  const activeHits = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (attacks[r][c] === "hit") {
        // Controlla se la nave è già affondata
        const ship = defBoard.ships.find(s => s.hits.some(h => h.row === r && h.col === c));
        if (ship && !ship.sunk) activeHits.push({ row: r, col: c });
      }

  if (activeHits.length > 0) {
    // Target mode: attacca adiacente agli hit attivi
    const candidates = new Set();
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const hit of activeHits) {
      for (const [dr, dc] of dirs) {
        const r = hit.row + dr, c = hit.col + dc;
        if (r >= 0 && r < size && c >= 0 && c < size && attacks[r][c] === null) {
          candidates.add(`${r}-${c}`);
        }
      }
    }
    if (candidates.size > 0) {
      const arr = [...candidates].map(k => { const [r, c] = k.split("-"); return { row: +r, col: +c }; });
      return arr[Math.floor(Math.random() * arr.length)];
    }
  }

  // Hunt mode: preferisce pattern a scacchiera per coprire più area
  const checkerboard = [];
  const fallback = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (attacks[r][c] === null) {
        if ((r + c) % 2 === 0) checkerboard.push({ row: r, col: c });
        else fallback.push({ row: r, col: c });
      }

  const pool = checkerboard.length > 0 ? checkerboard : fallback;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getBotMove(attacks, defBoard, difficulty, size) {
  if (difficulty === "easy") return getBotMoveEasy(attacks, size);
  return getBotMoveHard(attacks, defBoard, size);
}

// ── Stato visibile al client ─────────────────────────────────

// Costruisce la board da mostrare al cliente
// Il giocatore vede: la propria board completa + la board avversaria senza le navi non affondate
function buildClientBoards(gameState, forPlayerId, fogOfWar) {
  const myId  = forPlayerId;
  const oppId = gameState.players.find(p => p.id !== forPlayerId)?.id;

  if (!oppId || !gameState.boards[myId] || !gameState.boards[oppId]) return gameState.boards;

  const myBoard  = gameState.boards[myId];
  const oppBoard = gameState.boards[oppId];

  // Board avversaria: mostra solo attacchi ricevuti + navi affondate
  const oppShipsVisible = oppBoard.ships
    .filter(s => s.sunk || (!fogOfWar))
    .map(s => ({ ...s }));

  // Se fog of war, mostra solo le navi affondate avversarie
  const oppShipsFiltered = fogOfWar
    ? oppBoard.ships.filter(s => s.sunk)
    : oppBoard.ships;

  return {
    [myId]:  myBoard,
    [oppId]: { ...oppBoard, ships: oppShipsFiltered },
  };
}

module.exports = {
  initGame, placeShips, handleAttack, handlePowerUp, skipTurn,
  getBotMove, generateRandomShips, buildClientBoards, getConfig, GRID_CONFIGS,
};
