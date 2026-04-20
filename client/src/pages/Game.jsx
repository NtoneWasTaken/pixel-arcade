// ============================================================
// pages/Game.jsx — Con supporto timer Blitz e turno saltato
// ============================================================
import { useState, useEffect } from "react";
import socket from "../socket/socket";
import TicTacToeBoard from "../components/TicTacToeBoard";
import TimerBar from "../components/TimerBar";

export default function Game({ initialGameState, player, onLeave }) {
  const [gameState, setGameState] = useState(initialGameState);
  const [message, setMessage] = useState("");
  const [skippedMsg, setSkippedMsg] = useState("");

  useEffect(() => {
    updateMessage(initialGameState);
  }, []);

  useEffect(() => {
    const handleGameUpdate = ({ gameState: gs }) => {
      setGameState(gs);
      updateMessage(gs);
      setSkippedMsg("");
    };

    const handleTurnSkipped = ({ skippedPlayerId, gameState: gs }) => {
      setGameState(gs);
      updateMessage(gs);
      const skippedName = skippedPlayerId === socket.id
        ? "Hai esaurito il tempo! Turno saltato."
        : "L'avversario ha esaurito il tempo! Tocca a te.";
      setSkippedMsg(skippedName);
      // Nascondi il messaggio dopo 2 secondi
      setTimeout(() => setSkippedMsg(""), 2500);
    };

    const handleGameAborted = ({ message: msg }) => setMessage(msg);

    const handleRematchReady = ({ room }) => onLeave("lobby", room);

    socket.on("game_update", handleGameUpdate);
    socket.on("turn_skipped", handleTurnSkipped);
    socket.on("game_aborted", handleGameAborted);
    socket.on("rematch_ready", handleRematchReady);

    return () => {
      socket.off("game_update", handleGameUpdate);
      socket.off("turn_skipped", handleTurnSkipped);
      socket.off("game_aborted", handleGameAborted);
      socket.off("rematch_ready", handleRematchReady);
    };
  }, [onLeave]);

  function updateMessage(gs) {
    if (gs.status === "finished") {
      if (gs.winner === "draw") setMessage("Pareggio! Nessuno vince.");
      else if (gs.winner === socket.id) setMessage("🎉 Hai vinto!");
      else setMessage("Hai perso. Meglio la prossima volta!");
      return;
    }
    if (gs.currentTurn === socket.id) setMessage("È il tuo turno!");
    else {
      const opp = gs.players.find((p) => p.id !== socket.id);
      setMessage(`Turno di ${opp?.name || "avversario"}…`);
    }
  }

  const handleCellClick = (index) => socket.emit("player_move", { index });
  const handleRematch = () => socket.emit("request_rematch");

  const myPlayer = gameState.players.find((p) => p.id === socket.id);
  const isMyTurn = gameState.currentTurn === socket.id && gameState.status === "playing";
  const isFinished = gameState.status === "finished";
  const iWon = isFinished && gameState.winner === socket.id;
  const isDraw = isFinished && gameState.winner === "draw";

  return (
    <div className="game-page">
      <div className="game-header">
        <button className="btn btn-ghost btn-sm" onClick={() => onLeave("home")}>✕ Abbandona</button>
        <h2 className="game-title">TIC TAC TOE</h2>
        <div className="my-symbol">
          {myPlayer?.symbol === "X"
            ? <span className="symbol-badge x">Sei ✕</span>
            : <span className="symbol-badge o">Sei ◯</span>}
        </div>
      </div>

      <div className="scoreboard">
        {gameState.players.map((p) => (
          <div key={p.id} className={`score-player ${gameState.currentTurn === p.id && !isFinished ? "active-turn" : ""}`}>
            <span className="score-symbol">{p.symbol === "X" ? "✕" : "◯"}</span>
            <span className="score-name">{p.id === socket.id ? "Tu" : p.name}</span>
          </div>
        ))}
      </div>

      {/* Barra timer — visibile solo se timerSeconds > 0 */}
      <TimerBar
        timerSeconds={gameState.timerSeconds}
        turnStartedAt={gameState.turnStartedAt}
        currentTurn={gameState.currentTurn}
        myId={socket.id}
      />

      {/* Messaggio turno saltato */}
      {skippedMsg && (
        <div className="skipped-msg">{skippedMsg}</div>
      )}

      <div className={`status-banner ${
        isFinished
          ? (iWon ? "banner-win" : isDraw ? "banner-draw" : "banner-lose")
          : isMyTurn ? "banner-your-turn" : "banner-wait"
      }`}>
        {message}
      </div>

      <TicTacToeBoard
        board={gameState.board}
        winLine={gameState.winLine}
        onCellClick={handleCellClick}
        disabled={!isMyTurn}
      />

      {isFinished && (
        <div className="game-over-actions">
          <button className="btn btn-primary" onClick={handleRematch}>↺ Rivincita</button>
          <button className="btn btn-ghost" onClick={() => onLeave("home")}>⌂ Home</button>
        </div>
      )}
    </div>
  );
}
