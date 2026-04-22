// ============================================================
// pages/Home.jsx — Nome (step 1) oppure Azioni gioco (step 3)
// ============================================================
import { useState, useEffect } from "react";
import socket from "../socket/socket";

const TIMER_OPTIONS = [
  { label: "Nessun timer", value: 0  },
  { label: "10 secondi",   value: 10 },
  { label: "5 secondi",    value: 5  },
];

const RANDOM_OPTIONS = [
  { label: "Disattivato", value: 0   },
  { label: "Leggero",     value: 0.2 },
  { label: "Caotico",     value: 0.4 },
  { label: "Anarchia",    value: 0.6 },
];

const GRID_OPTIONS = [
  { label: "3×3", value: 3, desc: "Classico"   },
  { label: "4×4", value: 4, desc: "Strategico" },
  { label: "5×5", value: 5, desc: "Epico"      },
];

export default function Home({ onNameConfirmed, onRoomJoined, onBotGame, onBack, playerName: initialName, selectedGame }) {
  // Step 1: solo nome
  const isNameStep = !!onNameConfirmed;

  const [playerName,       setPlayerName]       = useState(initialName || "");
  const [joinCode,         setJoinCode]         = useState("");
  const [mode,             setMode]             = useState(null);
  const [error,            setError]            = useState("");
  const [loading,          setLoading]          = useState(false);

  // Bot settings
  const [botDifficulty,    setBotDifficulty]    = useState("easy");
  const [botTimer,         setBotTimer]         = useState(0);
  const [botRandom,        setBotRandom]        = useState(0);
  const [botAbilities,     setBotAbilities]     = useState(false);
  const [botGridSize,      setBotGridSize]      = useState(3);

  useEffect(() => {
    if (isNameStep) return; // step 1: nessun listener socket

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

    socket.on("room_created",  handleRoomCreated);
    socket.on("player_joined", handlePlayerJoined);
    socket.on("game_started",  handleGameStarted);
    socket.on("error",         handleError);

    return () => {
      socket.off("room_created",  handleRoomCreated);
      socket.off("player_joined", handlePlayerJoined);
      socket.off("game_started",  handleGameStarted);
      socket.off("error",         handleError);
    };
  }, [isNameStep, onRoomJoined, onBotGame]);

  // ── Step 1: conferma nome ──────────────────────────────────
  const handleConfirmName = () => {
    if (!playerName.trim()) { setError("Inserisci il tuo nome!"); return; }
    onNameConfirmed(playerName.trim());
  };

  // ── Step 3: azioni stanza ─────────────────────────────────
  const handleCreate = () => {
    setError(""); setLoading(true);
    socket.emit("create_room", { playerName });
  };

  const handleJoin = () => {
    if (!joinCode.trim()) { setError("Inserisci il codice stanza!"); return; }
    setError(""); setLoading(true);
    socket.emit("join_room", { roomCode: joinCode.trim().toUpperCase(), playerName });
  };

  const handleBotStart = () => {
    setError(""); setLoading(true);
    socket.emit("create_bot_room", {
      playerName,
      difficulty:       botDifficulty,
      timerSeconds:     botTimer,
      randomChance:     botRandom,
      abilitiesEnabled: botAbilities,
      gridSize:         botGridSize,
    });
  };

  // ── Render Step 1 ─────────────────────────────────────────
  if (isNameStep) {
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
              onKeyDown={(e) => e.key === "Enter" && handleConfirmName()}
              autoFocus
            />
          </div>
          {error && <div className="error-msg">⚠ {error}</div>}
          <button className="btn btn-primary" onClick={handleConfirmName}>
            Continua →
          </button>
        </div>
      </div>
    );
  }

  // ── Render Step 3 (game_actions) ──────────────────────────
  return (
    <div className="home-page">
      <div className="home-hero">
        <button className="btn btn-ghost btn-sm back-btn" onClick={onBack}>← Giochi</button>
        <p className="game-actions-title">
          {selectedGame === "ttt" ? "TIC TAC TOE" : "CONNECT 4"}
        </p>
        <p className="hero-sub">Ciao, <strong>{playerName}</strong>!</p>
      </div>

      <div className="home-card">
        {!mode && (
          <div className="action-buttons">
            <button className="btn btn-primary"   onClick={() => setMode("create")}>✦ Crea Stanza</button>
            <button className="btn btn-secondary" onClick={() => setMode("join")}>⟶ Entra con codice</button>
            <button className="btn btn-bot"       onClick={() => setMode("bot")}>🤖 Gioca vs Bot</button>
          </div>
        )}

        {mode === "create" && (
          <div className="mode-section">
            <p className="mode-hint">Verrà generato un codice da condividere con l&apos;amico.</p>
            <div className="action-buttons">
              <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
                {loading ? "Creando…" : "✦ Crea la stanza"}
              </button>
              <button className="btn btn-ghost" onClick={() => { setMode(null); setError(""); }}>← Indietro</button>
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
              <button className="btn btn-ghost" onClick={() => { setMode(null); setError(""); }}>← Indietro</button>
            </div>
          </div>
        )}

        {mode === "bot" && (
          <div className="mode-section">
            <div className="bot-option-group">
              <p className="bot-option-label">🤖 Difficoltà</p>
              <div className="bot-difficulty-btns">
                <button className={`btn ${botDifficulty === "easy" ? "btn-primary" : "btn-ghost"}`} onClick={() => setBotDifficulty("easy")}>😊 Facile</button>
                <button className={`btn ${botDifficulty === "hard" ? "btn-primary" : "btn-ghost"}`} onClick={() => setBotDifficulty("hard")}>💀 Difficile</button>
              </div>
              {botDifficulty === "hard" && (
                <p className="bot-hard-warning">⚠️ Il bot gioca in modo ottimale — non si può battere!</p>
              )}
            </div>

            {selectedGame === "ttt" && (
              <div className="bot-option-group">
                <p className="bot-option-label">🔲 Griglia</p>
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
            )}

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

            {selectedGame === "ttt" && (
              <div className="bot-option-group">
                <button
                  className={`ability-toggle ${botAbilities ? "enabled" : ""}`}
                  onClick={() => setBotAbilities(!botAbilities)}
                >
                  {botAbilities ? "✓ Abilità ATTIVE" : "⚡ Attiva Abilità Speciali"}
                </button>
              </div>
            )}

            <div className="action-buttons">
              <button className="btn btn-bot" onClick={handleBotStart} disabled={loading}>
                {loading ? "Avviando…" : "🤖 Inizia vs Bot"}
              </button>
              <button className="btn btn-ghost" onClick={() => { setMode(null); setError(""); }}>← Indietro</button>
            </div>
          </div>
        )}

        {error && <div className="error-msg">⚠ {error}</div>}
      </div>
    </div>
  );
}
