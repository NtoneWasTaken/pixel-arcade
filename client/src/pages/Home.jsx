// ============================================================
// pages/Home.jsx — Schermata iniziale: crea o entra in stanza
// ============================================================
import { useState } from "react";
import socket from "../socket/socket";

export default function Home({ onRoomJoined }) {
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState(null); // "create" | "join"
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Ascolta eventi di risposta dal server
  useState(() => {
    const handleRoomCreated = ({ roomCode, player }) => {
      setLoading(false);
      onRoomJoined({ roomCode, player, isHost: true });
    };

    const handlePlayerJoined = ({ room }) => {
      setLoading(false);
      const me = room.players.find((p) => p.id === socket.id);
      onRoomJoined({ roomCode: room.code, player: me, isHost: false, room });
    };

    const handleError = ({ message }) => {
      setLoading(false);
      setError(message);
    };

    socket.on("room_created", handleRoomCreated);
    socket.on("player_joined", handlePlayerJoined);
    socket.on("error", handleError);

    return () => {
      socket.off("room_created", handleRoomCreated);
      socket.off("player_joined", handlePlayerJoined);
      socket.off("error", handleError);
    };
  }, []);

  const handleCreate = () => {
    if (!playerName.trim()) { setError("Inserisci il tuo nome!"); return; }
    setError("");
    setLoading(true);
    socket.emit("create_room", { playerName: playerName.trim() });
  };

  const handleJoin = () => {
    if (!playerName.trim()) { setError("Inserisci il tuo nome!"); return; }
    if (!joinCode.trim()) { setError("Inserisci il codice stanza!"); return; }
    setError("");
    setLoading(true);
    socket.emit("join_room", { roomCode: joinCode.trim().toUpperCase(), playerName: playerName.trim() });
  };

  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="hero-badge">MULTIPLAYER</div>
        <h1 className="hero-title">
          <span className="title-accent">PIXEL</span>
          <span className="title-main">ARCADE</span>
        </h1>
        <p className="hero-sub">Giochi in tempo reale · Nessuna registrazione</p>
      </div>

      <div className="home-card">
        <div className="input-group">
          <label className="input-label">Il tuo nome</label>
          <input
            className="input-field"
            type="text"
            placeholder="es. Player1"
            value={playerName}
            maxLength={16}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && mode === "join" && handleJoin()}
          />
        </div>

        {!mode && (
          <div className="action-buttons">
            <button className="btn btn-primary" onClick={() => setMode("create")}>
              ✦ Crea Stanza
            </button>
            <button className="btn btn-secondary" onClick={() => setMode("join")}>
              ⟶ Entra con codice
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="mode-section">
            <p className="mode-hint">Verrà generato un codice da condividere con l&apos;amico.</p>
            <div className="action-buttons">
              <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
                {loading ? "Creando…" : "✦ Crea la stanza"}
              </button>
              <button className="btn btn-ghost" onClick={() => { setMode(null); setError(""); }}>
                ← Indietro
              </button>
            </div>
          </div>
        )}

        {mode === "join" && (
          <div className="mode-section">
            <div className="input-group">
              <label className="input-label">Codice stanza</label>
              <input
                className="input-field input-code"
                type="text"
                placeholder="es. AB3XY7"
                value={joinCode}
                maxLength={6}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>
            <div className="action-buttons">
              <button className="btn btn-primary" onClick={handleJoin} disabled={loading}>
                {loading ? "Entrando…" : "⟶ Entra"}
              </button>
              <button className="btn btn-ghost" onClick={() => { setMode(null); setError(""); }}>
                ← Indietro
              </button>
            </div>
          </div>
        )}

        {error && <div className="error-msg">⚠ {error}</div>}
      </div>

      <div className="games-preview">
        <div className="game-chip active">Tic Tac Toe</div>
        <div className="game-chip soon">Connect 4 · presto</div>
        <div className="game-chip soon">Battleship · presto</div>
      </div>
    </div>
  );
}
