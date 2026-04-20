// ============================================================
// components/TicTacToeBoard.jsx — Con animazioni deviazione Random
// ============================================================

export default function TicTacToeBoard({ board, winLine, onCellClick, disabled, deviationAnim }) {
  return (
    <div className="ttt-board" role="grid" aria-label="Griglia Tic Tac Toe">
      {board.map((cell, i) => {
        const isWin = winLine?.includes(i);
        const isEmpty = cell === null;
        const isIntended = deviationAnim?.intended === i;  // cella dove volevi giocare → rosso
        const isActual   = deviationAnim?.actual === i;    // cella dove è finita → giallo

        return (
          <button
            key={i}
            className={`ttt-cell
              ${cell === "X" ? "cell-x" : ""}
              ${cell === "O" ? "cell-o" : ""}
              ${isWin ? "cell-win" : ""}
              ${isEmpty && !disabled ? "cell-empty" : ""}
              ${isIntended ? "cell-deviated-intended" : ""}
              ${isActual   ? "cell-deviated-actual"   : ""}
            `}
            onClick={() => isEmpty && !disabled && onCellClick(i)}
            disabled={!isEmpty || disabled}
            aria-label={`Cella ${i + 1}: ${cell || "vuota"}`}
          >
            {cell === "X" && <span className="symbol-x">✕</span>}
            {cell === "O" && <span className="symbol-o">◯</span>}
          </button>
        );
      })}
    </div>
  );
}
