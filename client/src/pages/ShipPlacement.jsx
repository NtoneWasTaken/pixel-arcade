// ============================================================
// pages/ShipPlacement.jsx — Posizionamento navi Battleship
// ============================================================
import { useState, useCallback } from "react";

const SHIP_COLORS = {
  supercorazzata:     "#a78bfa",
  portaerei:          "#60a5fa",
  corazzata:          "#34d399",
  incrociatore:       "#fbbf24",
  sottomarino:        "#f87171",
  cacciatorpediniere: "#94a3b8",
};

export default function ShipPlacement({ gameState, shipConfig, gridSize, onConfirm }) {
  const size = gameState?.size || parseInt(gridSize) || 10;

  const [ships,          setShips]          = useState(() =>
    shipConfig.map(s => ({ ...s, cells: [], placed: false }))
  );
  const [selectedShipId, setSelectedShipId] = useState(shipConfig[0]?.id || null);
  const [orientation,    setOrientation]    = useState("horizontal");
  const [hoverCells,     setHoverCells]     = useState([]);
  const [opponentReady,  setOpponentReady]  = useState(false);

  const selectedShip = ships.find(s => s.id === selectedShipId);
  const allPlaced    = ships.every(s => s.placed);

  // Calcola celle della nave in base a posizione e orientamento
  const calcCells = useCallback((row, col, ship, orient) => {
    if (!ship) return [];
    const cells = [];
    for (let i = 0; i < ship.size; i++) {
      const r = orient === "horizontal" ? row       : row + i;
      const c = orient === "horizontal" ? col + i   : col;
      if (r < 0 || r >= size || c < 0 || c >= size) return null; // fuori griglia
      cells.push({ row: r, col: c });
    }
    return cells;
  }, [size]);

  // Controlla se le celle sono libere
  const isFree = useCallback((cells, excludeId = null) => {
    if (!cells) return false;
    const occupied = new Set();
    ships.forEach(s => {
      if (s.id === excludeId || !s.placed) return;
      s.cells.forEach(c => occupied.add(`${c.row}-${c.col}`));
    });
    return cells.every(c => !occupied.has(`${c.row}-${c.col}`));
  }, [ships]);

  const handleCellClick = (row, col) => {
    if (!selectedShip || selectedShip.placed) return;
    const cells = calcCells(row, col, selectedShip, orientation);
    if (!cells || !isFree(cells)) return;

    setShips(prev => prev.map(s =>
      s.id === selectedShipId ? { ...s, cells, placed: true } : s
    ));

    // Seleziona automaticamente la prossima nave non piazzata
    const next = ships.find(s => s.id !== selectedShipId && !s.placed);
    setSelectedShipId(next?.id || null);
    setHoverCells([]);
  };

  const handleCellHover = (row, col) => {
    if (!selectedShip || selectedShip.placed) { setHoverCells([]); return; }
    const cells = calcCells(row, col, selectedShip, orientation);
    setHoverCells(cells && isFree(cells) ? cells : []);
  };

  const handleRemoveShip = (shipId) => {
    setShips(prev => prev.map(s => s.id === shipId ? { ...s, cells: [], placed: false } : s));
    setSelectedShipId(shipId);
  };

  const handleRandomize = () => {
    const occupied = new Set();
    const newShips = ships.map(ship => {
      let placed = false, attempts = 0, cells = [];
      while (!placed && attempts < 300) {
        attempts++;
        const h = Math.random() > 0.5;
        const row = Math.floor(Math.random() * (h ? size : size - ship.size + 1));
        const col = Math.floor(Math.random() * (h ? size - ship.size + 1 : size));
        cells = [];
        let valid = true;
        for (let i = 0; i < ship.size; i++) {
          const r = h ? row : row + i;
          const c = h ? col + i : col;
          if (occupied.has(`${r}-${c}`)) { valid = false; break; }
          cells.push({ row: r, col: c });
        }
        if (valid) {
          cells.forEach(c => occupied.add(`${c.row}-${c.col}`));
          placed = true;
        }
      }
      return { ...ship, cells, placed };
    });
    setShips(newShips);
    setSelectedShipId(null);
  };

  const handleConfirm = () => {
    if (!allPlaced) return;
    onConfirm(ships.map(s => ({ id: s.id, cells: s.cells })));
  };

  // Costruisce mappa celle → nave
  const cellMap = {};
  ships.forEach(ship => {
    if (!ship.placed) return;
    ship.cells.forEach(c => { cellMap[`${c.row}-${c.col}`] = ship.id; });
  });

  const hoverSet = new Set(hoverCells.map(c => `${c.row}-${c.col}`));
  const isHoverValid = hoverCells.length > 0;

  return (
    <div className="placement-page">
      <div className="placement-header">
        <h2 className="placement-title">🚢 POSIZIONA LE NAVI</h2>
        <p className="placement-subtitle">
          {allPlaced ? "Tutte le navi piazzate! Pronto?" : selectedShip ? `Posiziona: ${selectedShip.name} (${selectedShip.size} celle)` : "Seleziona una nave"}
        </p>
        {opponentReady && <div className="opponent-ready-badge">✓ L'avversario è pronto!</div>}
      </div>

      {/* Controlli */}
      <div className="placement-controls">
        <button
          className={`btn btn-sm ${orientation === "horizontal" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setOrientation("horizontal")}
        >↔ Orizzontale</button>
        <button
          className={`btn btn-sm ${orientation === "vertical" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setOrientation("vertical")}
        >↕ Verticale</button>
        <button className="btn btn-ghost btn-sm" onClick={handleRandomize}>🎲 Casuale</button>
      </div>

      {/* Griglia */}
      <div className="placement-grid-wrapper">
        {/* Header colonne */}
        <div className="bs-grid-header-row" style={{ gridTemplateColumns: `24px repeat(${size}, 1fr)` }}>
          <span />
          {Array(size).fill(null).map((_, c) => (
            <span key={c} className="bs-grid-label">{String.fromCharCode(65 + c)}</span>
          ))}
        </div>

        <div className="placement-grid-body">
          {Array(size).fill(null).map((_, r) => (
            <div key={r} className="bs-grid-row" style={{ gridTemplateColumns: `24px repeat(${size}, 1fr)` }}>
              <span className="bs-grid-label">{r + 1}</span>
              {Array(size).fill(null).map((_, c) => {
                const key    = `${r}-${c}`;
                const shipId = cellMap[key];
                const ship   = shipId ? ships.find(s => s.id === shipId) : null;
                const isHover = hoverSet.has(key);

                return (
                  <div
                    key={c}
                    className={`bs-placement-cell
                      ${shipId ? "bs-cell-ship" : ""}
                      ${isHover ? (isHoverValid ? "bs-cell-hover-valid" : "bs-cell-hover-invalid") : ""}
                    `}
                    style={ship ? { background: `${SHIP_COLORS[shipId]}33`, borderColor: SHIP_COLORS[shipId] } : {}}
                    onClick={() => handleCellClick(r, c)}
                    onMouseEnter={() => handleCellHover(r, c)}
                    onMouseLeave={() => setHoverCells([])}
                  >
                    {ship && <div className="bs-ship-dot" style={{ background: SHIP_COLORS[shipId] }} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Lista navi */}
      <div className="ship-list">
        {ships.map(ship => (
          <div
            key={ship.id}
            className={`ship-item ${ship.placed ? "ship-placed" : ""} ${selectedShipId === ship.id ? "ship-selected" : ""}`}
            onClick={() => !ship.placed && setSelectedShipId(ship.id)}
          >
            <div className="ship-item-info">
              <span className="ship-item-name">{ship.name}</span>
              <div className="ship-item-preview">
                {Array(ship.size).fill(null).map((_, i) => (
                  <div key={i} className="ship-preview-cell" style={{ background: SHIP_COLORS[ship.id] }} />
                ))}
              </div>
            </div>
            {ship.placed ? (
              <button className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); handleRemoveShip(ship.id); }}>✕</button>
            ) : (
              <span className="ship-item-status">Da piazzare</span>
            )}
          </div>
        ))}
      </div>

      <button
        className={`btn btn-primary btn-lg ${!allPlaced ? "btn-disabled" : ""}`}
        onClick={handleConfirm}
        disabled={!allPlaced}
      >
        {allPlaced ? "✓ Conferma posizione" : `Piazza ancora ${ships.filter(s => !s.placed).length} ${ships.filter(s => !s.placed).length === 1 ? "nave" : "navi"}`}
      </button>
    </div>
  );
}
