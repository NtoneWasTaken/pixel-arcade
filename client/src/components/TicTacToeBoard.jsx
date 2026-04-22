// ============================================================
// components/TicTacToeBoard.jsx — Griglia dinamica 3x3 / 4x4 / 5x5
// ============================================================

export default function TicTacToeBoard({ board, winLine, onCellClick, disabled, deviationAnim, selectingAbility, gameState, myId }) {
  const opponent = gameState?.players.find(p => p.id !== myId);
  const oppSymbol = opponent?.symbol;

  // Dimensione griglia ricavata dalla board (9 → 3, 16 → 4, 25 → 5)
  const gridSize = gameState?.gridSize || Math.round(Math.sqrt(board.length));

  // Dimensioni celle in base alla griglia: più grande = celle più piccole
  const cellSizeMap = { 3: "100px", 4: "74px", 5: "58px" };
  const cellSize = cellSizeMap[gridSize] || "74px";

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${gridSize}, ${cellSize})`,
    gridTemplateRows: `repeat(${gridSize}, ${cellSize})`,
    gap: gridSize === 3 ? "8px" : gridSize === 4 ? "6px" : "5px",
  };

  return (
    <div className="ttt-board" style={gridStyle} role="grid">
      {board.map((cell, i) => {
        const isWin      = winLine?.includes(i);
        const isEmpty    = cell === null || cell === "?";
        const isIntended = deviationAnim?.intended === i;
        const isActual   = deviationAnim?.actual === i;
        const isGhost    = cell === "?";

        let abilityHighlight = "";
        if (selectingAbility === "scambia" && cell === oppSymbol) abilityHighlight = "cell-target-ability";
        if (selectingAbility === "bomba"   && cell === oppSymbol) abilityHighlight = "cell-target-bomb";
        if (selectingAbility === "fantasma" && cell === null)     abilityHighlight = "cell-target-ghost";

        return (
          <button
            key={i}
            className={`ttt-cell
              ${cell === "X" ? "cell-x" : ""}
              ${cell === "O" ? "cell-o" : ""}
              ${isGhost ? "cell-ghost" : ""}
              ${isWin ? "cell-win" : ""}
              ${isEmpty && !disabled ? "cell-empty" : ""}
              ${isIntended ? "cell-deviated-intended" : ""}
              ${isActual   ? "cell-deviated-actual"   : ""}
              ${abilityHighlight}
              ${gridSize === 4 ? "cell-md" : ""}
              ${gridSize === 5 ? "cell-sm" : ""}
            `}
            style={{ width: cellSize, height: cellSize }}
            onClick={() => onCellClick(i)}
            disabled={disabled && !selectingAbility}
            aria-label={`Cella ${i + 1}`}
          >
            {cell === "X" && <span className={gridSize >= 4 ? "symbol-x symbol-x-sm" : "symbol-x"}>✕</span>}
            {cell === "O" && <span className={gridSize >= 4 ? "symbol-o symbol-o-sm" : "symbol-o"}>◯</span>}
            {cell === "?" && <span className="symbol-ghost">?</span>}
          </button>
        );
      })}
    </div>
  );
}
