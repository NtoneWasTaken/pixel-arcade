// ============================================================
// components/Connect4Board.jsx — Griglia dinamica + power-ups + gravity + popout
// ============================================================
import { useState, useEffect } from "react";

export default function Connect4Board({
  board, winCells, onColClick, onCellClick, onPopOut,
  disabled, deviationAnim, mySymbol, selectingPowerUp,
  gravityDir, popOutEnabled, gravityFlipAnim
}) {
  const [droppingCell, setDroppingCell] = useState(null);
  const [hoveredCol,   setHoveredCol]   = useState(null);
  const [flipAnim,     setFlipAnim]     = useState(false);

  const rows = board.length;
  const cols = board[0]?.length || 7;
  const oppSymbol = mySymbol === "R" ? "Y" : "R";
  const isGravityUp = gravityDir === "up";

  // Animazione caduta pedina
  useEffect(() => {
    if (deviationAnim?.row !== undefined) {
      setDroppingCell({ row: deviationAnim.row, col: deviationAnim.actualCol });
      setTimeout(() => setDroppingCell(null), 500);
    }
  }, [deviationAnim]);

  // Animazione flip gravità
  useEffect(() => {
    if (gravityFlipAnim) {
      setFlipAnim(true);
      setTimeout(() => setFlipAnim(false), 600);
    }
  }, [gravityFlipAnim]);

  const isWinCell   = (r, c) => winCells?.some(cell => cell.row === r && cell.col === c);
  const isDeviated  = deviationAnim?.deviated;
  const intendedCol = deviationAnim?.intendedCol;
  const actualCol   = deviationAnim?.actualCol;

  // Pop Out: la pedina rimovibile è quella in fondo (gravity down) o in cima (gravity up)
  const getPopOutRow = (col) => {
    if (!popOutEnabled) return -1;
    if (isGravityUp) {
      for (let r = 0; r < rows; r++) {
        if (board[r]?.[col] !== null) return r;
      }
    } else {
      for (let r = rows - 1; r >= 0; r--) {
        if (board[r]?.[col] !== null) return r;
      }
    }
    return -1;
  };

  return (
    <div className={`c4-board-wrapper ${flipAnim ? "gravity-flip-anim" : ""}`}>

      {/* Indicatori colonna top (normali o frecce su se gravity up) */}
      <div className="c4-col-indicators" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array(cols).fill(null).map((_, c) => {
          const isPopOutCol = popOutEnabled && !selectingPowerUp && !disabled && getPopOutRow(c) !== -1 && board[getPopOutRow(c)]?.[c] === mySymbol;
          return (
            <button
              key={c}
              className={`c4-col-btn
                ${hoveredCol === c ? "hovered" : ""}
                ${disabled && !selectingPowerUp ? "disabled" : ""}
                ${isDeviated && intendedCol === c ? "c4-intended" : ""}
                ${isDeviated && actualCol === c ? "c4-actual" : ""}
                ${selectingPowerUp === "extra" ? "c4-col-extra" : ""}
              `}
              onClick={() => {
                if (selectingPowerUp === "extra") { onCellClick?.(-1, c); return; }
                if (!disabled) onColClick(c);
              }}
              onMouseEnter={() => setHoveredCol(c)}
              onMouseLeave={() => setHoveredCol(null)}
              aria-label={`Colonna ${c + 1}`}
            >
              {!disabled && !selectingPowerUp && hoveredCol === c && !isGravityUp && (
                <span className={`c4-drop-indicator ${mySymbol === "R" ? "indicator-r" : "indicator-y"}`}>▼</span>
              )}
              {!disabled && !selectingPowerUp && hoveredCol === c && isGravityUp && (
                <span className={`c4-drop-indicator ${mySymbol === "R" ? "indicator-r" : "indicator-y"}`} style={{ transform: "rotate(180deg)" }}>▼</span>
              )}
              {selectingPowerUp === "extra" && hoveredCol === c && (
                <span className="indicator-extra">➕</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Griglia */}
      <div
        className={`c4-board ${isGravityUp ? "gravity-up" : ""}`}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {Array(rows).fill(null).map((_, r) =>
          Array(cols).fill(null).map((_, c) => {
            const cell     = board[r]?.[c] ?? null;
            const win      = isWinCell(r, c);
            const isDrop   = droppingCell?.row === r && droppingCell?.col === c;
            const isHoverCol = hoveredCol === c && !disabled && !selectingPowerUp;
            const isBombaTarget = selectingPowerUp === "bomba" && cell === oppSymbol;

            return (
              <div
                key={`${r}-${c}`}
                className={`c4-cell
                  ${cell === "R" ? "c4-cell-r" : ""}
                  ${cell === "Y" ? "c4-cell-y" : ""}
                  ${win ? "c4-cell-win" : ""}
                  ${isDrop ? "c4-cell-drop" : ""}
                  ${isHoverCol && !cell ? "c4-cell-hover-col" : ""}
                  ${isBombaTarget ? "c4-cell-bomba-target" : ""}
                `}
                onClick={() => {
                  if (selectingPowerUp === "bomba" && cell === oppSymbol) onCellClick?.(r, c);
                }}
                style={{ cursor: isBombaTarget ? "pointer" : undefined }}
              >
                {cell && (
                  <div className={`c4-piece ${cell === "R" ? "piece-r" : "piece-y"} ${isDrop ? "piece-drop" : ""} ${win ? "piece-win" : ""}`} />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pop Out buttons — sotto la griglia (gravity down) o sopra (gravity up, già gestito sopra) */}
      {popOutEnabled && !disabled && !selectingPowerUp && (
        <div className="c4-popout-row" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array(cols).fill(null).map((_, c) => {
            const popRow = getPopOutRow(c);
            const canPop = popRow !== -1 && board[popRow]?.[c] === mySymbol;
            return (
              <button
                key={c}
                className={`c4-popout-btn ${canPop ? "c4-popout-available" : "c4-popout-disabled"}`}
                onClick={() => canPop && onPopOut?.(c)}
                disabled={!canPop}
                title={canPop ? `Pop Out colonna ${c + 1}` : ""}
              >
                {canPop ? (isGravityUp ? "▼" : "▲") : "·"}
              </button>
            );
          })}
        </div>
      )}

      {/* Numerazione colonne */}
      <div className="c4-col-numbers" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array(cols).fill(null).map((_, c) => (
          <span key={c} className="c4-col-num">{c + 1}</span>
        ))}
      </div>
    </div>
  );
}
