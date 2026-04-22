// ============================================================
// components/Connect4Board.jsx — Griglia 7x6 con animazione caduta
// ============================================================
import { useState, useEffect } from "react";
import socket from "../socket/socket";

const ROWS = 6;
const COLS = 7;

export default function Connect4Board({ board, winCells, onColClick, disabled, deviationAnim, mySymbol }) {
  const [droppingCell, setDroppingCell] = useState(null); // { row, col }
  const [hoveredCol,   setHoveredCol]   = useState(null);

  // Quando arriva una nuova pedina, animala
  useEffect(() => {
    if (deviationAnim?.row !== undefined) {
      setDroppingCell({ row: deviationAnim.row, col: deviationAnim.actualCol });
      setTimeout(() => setDroppingCell(null), 500);
    }
  }, [deviationAnim]);

  const isWinCell = (r, c) => winCells?.some(cell => cell.row === r && cell.col === c);
  const isDeviated = deviationAnim?.deviated;
  const intendedCol = deviationAnim?.intendedCol;
  const actualCol   = deviationAnim?.actualCol;

  return (
    <div className="c4-board-wrapper">
      {/* Indicatori colonna (frecce hover) */}
      <div className="c4-col-indicators">
        {Array(COLS).fill(null).map((_, c) => (
          <button
            key={c}
            className={`c4-col-btn ${hoveredCol === c ? "hovered" : ""} ${disabled ? "disabled" : ""} ${isDeviated && intendedCol === c ? "c4-intended" : ""} ${isDeviated && actualCol === c ? "c4-actual" : ""}`}
            onClick={() => !disabled && onColClick(c)}
            onMouseEnter={() => !disabled && setHoveredCol(c)}
            onMouseLeave={() => setHoveredCol(null)}
            disabled={disabled}
            aria-label={`Colonna ${c + 1}`}
          >
            {!disabled && hoveredCol === c && (
              <span className={`c4-drop-indicator ${mySymbol === "R" ? "indicator-r" : "indicator-y"}`}>▼</span>
            )}
          </button>
        ))}
      </div>

      {/* Griglia */}
      <div className="c4-board">
        {Array(ROWS).fill(null).map((_, r) => (
          Array(COLS).fill(null).map((_, c) => {
            const cell = board[r]?.[c] ?? null;
            const win  = isWinCell(r, c);
            const isDrop = droppingCell?.row === r && droppingCell?.col === c;
            const isHoverCol = hoveredCol === c && !disabled;

            return (
              <div
                key={`${r}-${c}`}
                className={`c4-cell
                  ${cell === "R" ? "c4-cell-r" : ""}
                  ${cell === "Y" ? "c4-cell-y" : ""}
                  ${win ? "c4-cell-win" : ""}
                  ${isDrop ? "c4-cell-drop" : ""}
                  ${isHoverCol && !cell ? "c4-cell-hover-col" : ""}
                `}
              >
                {cell && (
                  <div className={`c4-piece ${cell === "R" ? "piece-r" : "piece-y"} ${isDrop ? "piece-drop" : ""} ${win ? "piece-win" : ""}`} />
                )}
              </div>
            );
          })
        ))}
      </div>

      {/* Numerazione colonne */}
      <div className="c4-col-numbers">
        {Array(COLS).fill(null).map((_, c) => (
          <span key={c} className="c4-col-num">{c + 1}</span>
        ))}
      </div>
    </div>
  );
}
