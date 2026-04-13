// ============================================================
// components/TicTacToeBoard.jsx — Griglia di gioco
// ============================================================

export default function TicTacToeBoard({ board, winLine, onCellClick, disabled }) {
  return (
    <div className="ttt-board" role="grid" aria-label="Griglia Tic Tac Toe">
      {board.map((cell, i) => {
        const isWin = winLine?.includes(i);
        const isEmpty = cell === null;

        return (
          <button
            key={i}
            className={`ttt-cell
              ${cell === "X" ? "cell-x" : ""}
              ${cell === "O" ? "cell-o" : ""}
              ${isWin ? "cell-win" : ""}
              ${isEmpty && !disabled ? "cell-empty" : ""}
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
