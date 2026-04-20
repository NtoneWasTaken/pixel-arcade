// ============================================================
// components/TicTacToeBoard.jsx — Con deviazione + abilità
// ============================================================

export default function TicTacToeBoard({ board, winLine, onCellClick, disabled, deviationAnim, selectingAbility, gameState, myId }) {
  const opponent = gameState?.players.find(p => p.id !== myId);
  const oppSymbol = opponent?.symbol;

  return (
    <div className="ttt-board" role="grid">
      {board.map((cell, i) => {
        const isWin      = winLine?.includes(i);
        const isEmpty    = cell === null || cell === "?";
        const isIntended = deviationAnim?.intended === i;
        const isActual   = deviationAnim?.actual === i;
        const isGhost    = cell === "?";

        // Evidenzia celle selezionabili per l'abilità
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
            `}
            onClick={() => onCellClick(i)}
            disabled={disabled && !selectingAbility}
            aria-label={`Cella ${i + 1}`}
          >
            {cell === "X" && <span className="symbol-x">✕</span>}
            {cell === "O" && <span className="symbol-o">◯</span>}
            {cell === "?" && <span className="symbol-ghost">?</span>}
          </button>
        );
      })}
    </div>
  );
}
