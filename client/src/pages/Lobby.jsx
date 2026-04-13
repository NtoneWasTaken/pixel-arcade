// ============================================================
// pages/Lobby.jsx — Schermata di attesa prima della partita
// ============================================================
export default function Lobby({ roomCode, player, initialRoom, onGameStart, onLeave }) {
  console.log("LOBBY MONTATA - player:", player);
  
import { useState, useEffect } from "react";
import socket from "../socket/socket";

export default function Lobby({ roomCode, player, initialRoom, onGameStart, onLeave }) {
  const [room, setRoom] = useState(initialRoom || { players: [player], code: roomCode });
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handlePlayerJoined = ({ room: updatedRoom }) => {
      setRoom(updatedRoom);
    };

    const handleGameStarted = ({ gameState }) => {
      onGameStart(gameState);
    };

    const handlePlayerLeft = ({ room: updatedRoom, message }) => {
      setRoom(updatedRoom);
      setError(message);
    };

    const handleError = ({ message }) => setError(message);

    socket.on("player_joined", handlePlayerJoined);
    socket.on("game_started", handleGameStarted);
    socket.on("player_left", handlePlayerLeft);
    socket.on("error", handleError);

    return () => {
      socket.off("player_joined", handlePlayerJoined);
      socket.off("game_started", handleGameStarted);
      socket.off("player_left", handlePlayerLeft);
      socket.off("error", handleError);
    };
  }, [onGameStart]);

  const handleStart = () => {
    setError("");
    socket.emit("start_game");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHost = player?.isHost;
  console.log("DEBUG player:", player);
  console.log("DEBUG isHost:", isHost);
  const canStart = room.players.length === 2;

  return (
    <div className="lobby-page">
      <div className="lobby-header">
        <button className="btn btn-ghost btn-sm" onClick={onLeave}>← Esci</button>
        <h2 className="lobby-title">LOBBY</h2>
        <div />
      </div>

      <div className="room-code-block">
        <p className="code-label">Codice stanza</p>
        <div className="code-display">
          <span className="code-text">{roomCode}</span>
          <button className="btn btn-ghost btn-sm copy-btn" onClick={copyCode}>
            {copied ? "✓ Copiato!" : "Copia"}
          </button>
        </div>
        <p className="code-hint">Condividi questo codice con il tuo avversario</p>
      </div>

      <div className="players-section">
        <h3 className="section-title">Giocatori ({room.players.length}/2)</h3>
        <div className="players-list">
          {room.players.map((p, i) => (
            <div key={p.id} className={`player-slot filled ${p.id === socket.id ? "me" : ""}`}>
              <span className="player-symbol">{i === 0 ? "✕" : "◯"}</span>
              <span className="player-name">{p.name}</span>
              <span className="player-badges">
                {p.isHost && <span className="badge">Host</span>}
                {p.id === socket.id && <span className="badge badge-me">Tu</span>}
              </span>
            </div>
          ))}
          {room.players.length < 2 && (
            <div className="player-slot empty">
              <span className="player-waiting">In attesa di un giocatore…</span>
              <span className="waiting-dot" />
            </div>
          )}
        </div>
      </div>

      {error && <div className="error-msg">⚠ {error}</div>}

      <div className="lobby-actions">
        {isHost ? (
          <button
            className={`btn btn-primary btn-lg ${!canStart ? "btn-disabled" : ""}`}
            onClick={handleStart}
            disabled={!canStart}
          >
            {canStart ? "▶ Inizia Partita" : "In attesa dell'avversario…"}
          </button>
        ) : (
          <p className="waiting-msg">In attesa che l&apos;host avvii la partita…</p>
        )}
      </div>
    </div>
  );
}
