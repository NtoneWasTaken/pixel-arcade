// ============================================================
// components/Connect4Board.jsx — Griglia dinamica + power-ups
// ============================================================
import { useState, useEffect } from "react";
import socket from "../socket/socket";

export default function Connect4Board({ board, winCells, onColClick, onCellClick, disabled, deviationAnim, mySymbol, selectingPowerUp }) {
  const [droppingCell, setDroppingCell] = useState(null);
  const [hoveredCol,   setHoveredCol]   = useState(null);

  const rows = board.length;
  const cols = board[0]?.length || 7;

  useEffect(() => {
    if (deviationAnim?.row !== undefined) {
      setDroppingCell({ row: deviationAnim.row, col: deviationAnim.actualCol });
      setTimeout(() => setDroppingCell(null), 500);
    }
  }, [deviationAnim]);

  const isWinCell  = (r, c) => winCells?.some(cell => cell.row === r && cell.col === c);
  const isDeviated  = deviationAnim?.deviated;
  const intendedCol = deviationAnim?.intendedCol;
  const actualCol   = deviationAnim?.actualCol;

  // Simbolo avversario (per highlight bomba)
  const oppSymbol = mySymbol === "R" ? "Y" : "R";

  return (
    <div className="c4-board-wrapper">
      {/* Indicatori colonna */}
      <div className="c4-col-indicators" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array(cols).fill(null).map((_, c) => (
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
            {!disabled && !selectingPowerUp && hoveredCol === c && (
              <span className={`c4-drop-indicator ${mySymbol === "R" ? "indicator-r" : "indicator-y"}`}>▼</span>
            )}
            {selectingPowerUp === "extra" && hoveredCol === c && (
              <span className="indicator-extra">➕</span>
            )}
          </button>
        ))}
      </div>

      {/* Griglia */}
      <div className="c4-board" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        {Array(rows).fill(null).map((_, r) =>
          Array(cols).fill(null).map((_, c) => {
            const cell = board[r]?.[c] ?? null;
            const win  = isWinCell(r, c);
            const isDrop = droppingCell?.row === r && droppingCell?.col === c;
            const isHoverCol = hoveredCol === c && !disabled && !selectingPowerUp;

            // Highlight per bomba: celle avversarie
            const isBombaTarget  = selectingPowerUp === "bomba"  && cell === oppSymbol;

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
                  if (selectingPowerUp === "bomba" && cell === oppSymbol) {
                    onCellClick?.(r, c);
                  }
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

      {/* Numerazione colonne */}
      <div className="c4-col-numbers" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array(cols).fill(null).map((_, c) => (
          <span key={c} className="c4-col-num">{c + 1}</span>
        ))}
      </div>
    </div>
  );
}
