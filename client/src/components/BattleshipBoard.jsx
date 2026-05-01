// ============================================================
// components/BattleshipBoard.jsx — Griglia Battleship
// ============================================================

const SHIP_COLORS = {
  supercorazzata:     "#a78bfa",
  portaerei:          "#60a5fa",
  corazzata:          "#34d399",
  incrociatore:       "#fbbf24",
  sottomarino:        "#f87171",
  cacciatorpediniere: "#94a3b8",
};

export default function BattleshipBoard({
  board,        // { ships, attacks }
  size,
  isMyBoard,    // true = mostra le tue navi, false = board avversaria
  onCellClick,  // solo sulla board avversaria
  disabled,
  lastHit,      // { row, col } — ultima cella colpita per animazione
  selectingPowerUp,
  onRowColSelect, // per siluro
}) {
  const attacks = board?.attacks || [];
  const ships   = board?.ships   || [];

  // Mappa celle → nave
  const shipCellMap = {};
  ships.forEach(ship => {
    ship.cells?.forEach(c => {
      shipCellMap[`${c.row}-${c.col}`] = { shipId: ship.id, sunk: ship.sunk };
    });
  });

  const getCell = (r, c) => {
    const attack = attacks[r]?.[c];
    const shipInfo = shipCellMap[`${r}-${c}`];
    return { attack, shipInfo };
  };

  return (
    <div className="bs-board-wrapper">
      {/* Header colonne */}
      <div className="bs-grid-header-row" style={{ gridTemplateColumns: `20px repeat(${size}, 1fr)` }}>
        <span />
        {Array(size).fill(null).map((_, c) => (
          <span key={c} className="bs-grid-label">{String.fromCharCode(65 + c)}</span>
        ))}
      </div>

      {/* Righe */}
      {Array(size).fill(null).map((_, r) => (
        <div key={r} className="bs-grid-row" style={{ gridTemplateColumns: `20px repeat(${size}, 1fr)` }}>
          {/* Label riga — cliccabile per siluro */}
          <span
            className={`bs-grid-label ${selectingPowerUp === "siluro" ? "bs-label-siluro" : ""}`}
            onClick={() => selectingPowerUp === "siluro" && onRowColSelect?.(true, r)}
            style={{ cursor: selectingPowerUp === "siluro" ? "pointer" : "default" }}
          >
            {r + 1}
          </span>

          {Array(size).fill(null).map((_, c) => {
            const { attack, shipInfo } = getCell(r, c);
            const isLastHit = lastHit?.row === r && lastHit?.col === c;
            const isMiss    = attack === "miss";
            const isHit     = attack === "hit";
            const isSunk    = shipInfo?.sunk;
            const hasShip   = !!shipInfo;

            return (
              <div
                key={c}
                className={`bs-cell
                  ${isMiss ? "bs-cell-miss" : ""}
                  ${isHit  ? (isSunk ? "bs-cell-sunk" : "bs-cell-hit") : ""}
                  ${!attack && !disabled && !isMyBoard ? "bs-cell-attackable" : ""}
                  ${isLastHit ? "bs-cell-last-hit" : ""}
                  ${hasShip && isMyBoard && !isHit ? "bs-cell-own-ship" : ""}
                `}
                style={
                  hasShip && isMyBoard && !isHit
                    ? { background: `${SHIP_COLORS[shipInfo.shipId]}22`, borderColor: `${SHIP_COLORS[shipInfo.shipId]}66` }
                    : {}
                }
                onClick={() => {
                  if (disabled || isMyBoard) return;
                  if (attack) return; // già colpita
                  onCellClick?.(r, c);
                }}
              >
                {isMiss && <span className="bs-miss-dot">·</span>}
                {isHit  && !isSunk && <span className="bs-hit-icon">💥</span>}
                {isHit  && isSunk  && <span className="bs-sunk-icon">🚢</span>}
                {hasShip && isMyBoard && !isHit && (
                  <div className="bs-ship-dot" style={{ background: SHIP_COLORS[shipInfo.shipId] }} />
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Header colonne bottom — cliccabile per siluro colonna */}
      {selectingPowerUp === "siluro" && (
        <div className="bs-grid-header-row bs-siluro-col-row" style={{ gridTemplateColumns: `20px repeat(${size}, 1fr)` }}>
          <span />
          {Array(size).fill(null).map((_, c) => (
            <span
              key={c}
              className="bs-grid-label bs-label-siluro"
              onClick={() => onRowColSelect?.(false, c)}
            >
              ↑
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
