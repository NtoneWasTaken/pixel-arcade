// ============================================================
// pages/Home.jsx — Schermata iniziale: crea, entra, o gioca vs bot
// ============================================================
import { useState, useEffect } from "react";
import socket from "../socket/socket";

const TIMER_OPTIONS = [
  { label: "Nessun timer", value: 0 },
  { label: "10 secondi",   value: 10 },
  { label: "5 secondi",    value: 5 },
];

const RANDOM_OPTIONS = [
  { label: "Disattivato", value: 0 },
  { label: "Leggero",     value: 0.2 },
  { label: "Caotico",     value: 0.4 },
  { label: "Anarchia",    value: 0.6 },
];

const GRID_OPTIONS = [
  { label: "3×3", value: 3, desc: "Classico" },
  { label: "4×4", value: 4, desc: "4 in fila" },
  { label: "5×5", value: 5, desc: "4 in fila" },
];

export default function Home({ onRoomJoined, onBotGame }) {
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode]     = useState("");
  const [mode, setMode]             = useState(null); // "create" | "join" | "bot"
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  // Bot settings
  const [botDifficulty,    setBotDifficulty]    = useState("easy");
  const [botTimer,         setBotTimer]         = useState(0);
  const [botRandom,        setBotRandom]        = useState(0);
  const [botAbilities,     setBotAbilities]     = useState(false);
  const [botGridSize,      setBotGridSize]      = useState(3);

  useEffect(() => {
    const handleRoomCreated = ({ roomCode, player }) => {
      setLoading(false);
      onRoomJoined({ roomCode, player, isHost: true });
    };

    const handlePlayerJoined = ({ room }) => {
      setLoading(false);
      const me = room.players[room.players.length - 1];
      onRoomJoined({ roomCode: room.code, player: { ...me, isHost: false }, isHost: false, room });
    };

    const handleGameStarted = ({ gameState, isBot, botDifficulty: diff }) => {
      if (isBot) {
        setLoading(false);
        onBotGame({ gameState, botDifficulty: diff });
      }
    };

    const handleError = ({ message }) => {
      setLoading(false);
      setError(message);
    };

    socket.on("room_created",   handleRoomCreated);
    socket.on("player_joined",  handlePlayerJoined);
    socket.on("game_started",   handleGameStarted);
    socket.on("error",          handleError);

    return () => {
      socket.off("room_created",  handleRoomCreated);
      socket.off("player_joined", handlePlayerJoined);
      socket.off("game_started",  handleGameStarted);
      socket.off("error",         handleError);
    };
  }, [onRoomJoined, onBotGame]);

  const handleCreate = () => {
    if (!playerName.trim()) { setError("Inserisci il tuo nome!"); return; }
    setError(""); setLoading(true);
    socket.emit("create_room", { playerName: playerName.trim() });
  };

  const handleJoin = () => {
    if (!playerName.trim()) { setError("Inserisci il tuo nome!"); return; }
    if (!joinCode.trim())   { setError("Inserisci il codice stanza!"); return; }
    setError(""); setLoading(true);
    socket.emit("join_room", { roomCode: joinCode.trim().toUpperCase(), playerName: playerName.trim() });
  };

  const handleBotStart = () => {
    if (!playerName.trim()) { setError("Inserisci il tuo nome!"); return; }
    setError(""); setLoading(true);
    socket.emit("create_bot_room", {
      playerName:       playerName.trim(),
      difficulty:       botDifficulty,
      timerSeconds:     botTimer,
      randomChance:     botRandom,
      abilitiesEnabled: botAbilities,
      gridSize:         botGridSize,
    });
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

        {/* Pulsanti principali */}
        {!mode && (
          <div className="action-buttons">
            <button className="btn btn-primary" onClick={() => setMode("create")}>
              ✦ Crea Stanza
            </button>
            <button className="btn btn-secondary" onClick={() => setMode("join")}>
              ⟶ Entra con codice
            </button>
            <button className="btn btn-bot" onClick={() => setMode("bot")}>
              🤖 Gioca vs Bot
            </button>
          </div>
        )}

        {/* Crea stanza */}
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

        {/* Entra con codice */}
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

        {/* Gioca vs Bot */}
        {mode === "bot" && (
          <div className="mode-section">

            {/* Difficoltà */}
            <div className="bot-option-group">
              <p className="bot-option-label">🤖 Difficoltà</p>
              <div className="bot-difficulty-btns">
                <button
                  className={`btn ${botDifficulty === "easy" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setBotDifficulty("easy")}
                >
                  😊 Facile
                </button>
                <button
                  className={`btn ${botDifficulty === "hard" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setBotDifficulty("hard")}
                >
                  💀 Difficile
                </button>
              </div>
              {botDifficulty === "hard" && botGridSize === 3 && (
                <p className="bot-hard-warning">⚠️ Il bot gioca in modo ottimale — non si può battere!</p>
              )}
              {botDifficulty === "hard" && botGridSize > 3 && (
                <p className="bot-hard-warning">⚠️ Il bot usa strategia avanzata su griglia {botGridSize}×{botGridSize}.</p>
              )}
            </div>

            {/* Dimensione griglia */}
            <div className="bot-option-group">
              <p className="bot-option-label">⊞ Dimensione Griglia</p>
              <div className="timer-options">
                {GRID_OPTIONS.map(opt => (
                  <button key={opt.value}
                    className={`timer-option ${botGridSize === opt.value ? "selected" : ""}`}
                    onClick={() => setBotGridSize(opt.value)}>
                    <span className="timer-icon">{opt.label}</span>
                    <span className="timer-label">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Timer */}
            <div className="bot-option-group">
              <p className="bot-option-label">⏱ Timer</p>
              <div className="timer-options">
                {TIMER_OPTIONS.map(opt => (
                  <button key={opt.value}
                    className={`timer-option ${botTimer === opt.value ? "selected" : ""}`}
                    onClick={() => setBotTimer(opt.value)}>
                    <span className="timer-label">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Random */}
            <div className="bot-option-group">
              <p className="bot-option-label">🎲 Random</p>
              <div className="timer-options">
                {RANDOM_OPTIONS.map(opt => (
                  <button key={opt.value}
                    className={`timer-option ${botRandom === opt.value ? "selected" : ""}`}
                    onClick={() => setBotRandom(opt.value)}>
                    <span className="timer-label">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Abilità */}
            <div className="bot-option-group">
              <button
                className={`ability-toggle ${botAbilities ? "enabled" : ""}`}
                onClick={() => setBotAbilities(!botAbilities)}
              >
                {botAbilities ? "✓ Abilità ATTIVE" : "⚡ Attiva Abilità Speciali"}
              </button>
            </div>

            <div className="action-buttons">
              <button className="btn btn-bot" onClick={handleBotStart} disabled={loading}>
                {loading ? "Avviando…" : "🤖 Inizia vs Bot"}
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
