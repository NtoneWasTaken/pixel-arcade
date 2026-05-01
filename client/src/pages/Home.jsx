// ============================================================
// pages/Home.jsx — Nome + selezione gioco + azioni stanza (Tris + C4 + Battleship)
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

const TTT_GRID_OPTIONS = [
  { label: "3×3", value: 3, desc: "Classico"   },
  { label: "4×4", value: 4, desc: "Strategico" },
  { label: "5×5", value: 5, desc: "Epico"      },
];

const C4_GRID_OPTIONS = [
  { label: "6×5", value: "6x5", desc: "Compatta"          },
  { label: "7×6", value: "7x6", desc: "Classica"          },
  { label: "8×7", value: "8x7", desc: "Epica · 5 in fila" },
];

const BS_GRID_OPTIONS = [
  { label: "8×8",   value: "8x8",   desc: "Compatta · 4 navi" },
  { label: "10×10", value: "10x10", desc: "Classica · 5 navi" },
  { label: "12×12", value: "12x12", desc: "Epica · 6 navi"    },
];

export default function Home({ onRoomJoined, onBotGame }) {
  const [playerName,    setPlayerName]    = useState("");
  const [joinCode,      setJoinCode]      = useState("");
  const [step,          setStep]          = useState("name");
  const [selectedGame,  setSelectedGame]  = useState(null);
  const [mode,          setMode]          = useState(null);
  const [error,         setError]         = useState("");
  const [loading,       setLoading]       = useState(false);

  // Bot settings
  const [botDifficulty, setBotDifficulty] = useState("easy");
  const [botTimer,      setBotTimer]      = useState(0);
  const [botRandom,     setBotRandom]     = useState(0);
  const [botAbilities,  setBotAbilities]  = useState(false);
  const [botTttGrid,    setBotTttGrid]    = useState(3);
  const [botC4Grid,     setBotC4Grid]     = useState("7x6");
  const [botBsGrid,     setBotBsGrid]     = useState("10x10");
  const [botPowerUps,   setBotPowerUps]   = useState(false);
  const [botGravity,    setBotGravity]    = useState(false);
  const [botPopOut,     setBotPopOut]     = useState(false);
  const [botFogOfWar,   setBotFogOfWar]   = useState(false);

  const isC4 = selectedGame === "c4";
  const isBS = selectedGame === "bs";

  useEffect(() => {
    if (step !== "actions") return;

    const handleRoomCreated = ({ roomCode, player }) => {
      setLoading(false);
      onRoomJoined({ roomCode, player, isHost: true, game: selectedGame });
    };
    const handlePlayerJoined = ({ room }) => {
      setLoading(false);
      const me = room.players[room.players.length - 1];
      onRoomJoined({ roomCode: room.code, player: { ...me, isHost: false }, isHost: false, room, game: selectedGame });
    };
    const handleGameStarted = ({ gameState, isBot, gameType, shipConfig, gridSize }) => {
      if (isBot) { setLoading(false); onBotGame({ gameState, gameType, shipConfig, gridSize }); }
    };
    const handleError = ({ message }) => { setLoading(false); setError(message); };

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
  }, [step, selectedGame, onRoomJoined, onBotGame]);

  const handleConfirmName = () => {
    if (!playerName.trim()) { setError("Inserisci il tuo nome!"); return; }
    setError(""); setStep("select");
  };

  const handleSelectGame = (game) => {
    setSelectedGame(game); setStep("actions"); setMode(null); setError("");
  };

  const handleCreate = () => { setError(""); setLoading(true); socket.emit("create_room", { playerName: playerName.trim() }); };

  const handleJoin = () => {
    if (!joinCode.trim()) { setError("Inserisci il codice stanza!"); return; }
    setError(""); setLoading(true);
    socket.emit("join_room", { roomCode: joinCode.trim().toUpperCase(), playerName: playerName.trim() });
  };

  const handleBotStart = () => {
    setError(""); setLoading(true);
    if (isBS) {
      socket.emit("create_bot_room_bs", {
        playerName:      playerName.trim(),
        difficulty:      botDifficulty,
        timerSeconds:    botTimer,
        powerUpsEnabled: botPowerUps,
        fogOfWarEnabled: botFogOfWar,
        gridSize:        botBsGrid,
      });
    } else if (isC4) {
      socket.emit("create_bot_room_c4", {
        playerName:      playerName.trim(),
        difficulty:      botDifficulty,
        timerSeconds:    botTimer,
        randomChance:    botRandom,
        powerUpsEnabled: botPowerUps,
        gridSize:        botC4Grid,
        gravityEnabled:  botGravity,
        popOutEnabled:   botPopOut,
      });
    } else {
      socket.emit("create_bot_room", {
        playerName:       playerName.trim(),
        difficulty:       botDifficulty,
        timerSeconds:     botTimer,
        randomChance:     botRandom,
        abilitiesEnabled: botAbilities,
        gridSize:         botTttGrid,
      });
    }
  };

  const hero = (
    <div className="home-hero">
      <div className="hero-badge">MULTIPLAYER</div>
      <h1 className="hero-title">
        <span className="title-accent">PIXEL</span>
        <span className="title-main">ARCADE</span>
      </h1>
      <p className="hero-sub">Giochi in tempo reale · Nessuna registrazione</p>
    </div>
  );

  // ── Step nome ──────────────────────────────────────────────
  if (step === "name") {
    return (
      <div className="home-page">
        {hero}
        <div className="home-card">
          <div className="input-group">
            <label className="input-label">Il tuo nome</label>
            <input className="input-field" type="text" placeholder="es. Player1"
              value={playerName} maxLength={16}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleConfirmName()}
              autoFocus />
          </div>
          {error && <div className="error-msg">⚠ {error}</div>}
          <button className="btn btn-primary" onClick={handleConfirmName}>Continua →</button>
          <div className="game-cards-hint">
            <p className="game-cards-hint-label">Giochi disponibili</p>
            <div className="game-cards-preview-row">
              <div className="game-card-mini game-card-mini-ttt">
                <span className="game-card-mini-title">TIC TAC TOE</span>
                <div className="ttt-preview-grid ttt-preview-mini">
                  {["X","O","X",null,"O",null,null,"X","O"].map((c,i) => (
                    <span key={i} className={`ttt-pre ${c==="X"?"x":c==="O"?"o":"empty"}`}>{c||""}</span>
                  ))}
                </div>
              </div>
              <div className="game-card-mini game-card-mini-c4">
                <span className="game-card-mini-title">CONNECT 4</span>
                <div className="c4-preview-mini">
                  {[null,null,null,null,null,null,null,null,null,null,null,null,null,null,
                    null,null,null,"r",null,null,null,null,null,"r","y",null,null,null,
                    null,"r","y","y","r",null,null,"y","r","y","r","y","r",null,
                  ].map((c,i) => (
                    <span key={i} className={`c4-pre ${c==="r"?"c4-pre-r":c==="y"?"c4-pre-y":"c4-pre-empty"}`} />
                  ))}
                </div>
              </div>
              <div className="game-card-mini game-card-mini-bs">
                <span className="game-card-mini-title">BATTLESHIP</span>
                <div className="bs-preview-mini">
                  {Array(25).fill(null).map((_, i) => (
                    <span key={i} className={`bs-pre-cell ${[2,3,7,12,17,22].includes(i) ? "bs-pre-ship" : [6,11].includes(i) ? "bs-pre-hit" : i === 1 ? "bs-pre-miss" : ""}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step selezione ─────────────────────────────────────────
  if (step === "select") {
    return (
      <div className="home-page">
        {hero}
        <p className="game-select-welcome">Ciao, <span className="player-name-accent">{playerName}</span>! Scegli un gioco.</p>
        <div className="game-select-grid">
          {/* Tris */}
          <button className="game-card game-card-ttt" onClick={() => handleSelectGame("ttt")}>
            <div className="game-card-preview">
              <div className="ttt-preview-grid">
                {["X","O","X",null,"O",null,null,"X","O"].map((c,i) => (
                  <span key={i} className={`ttt-pre ${c==="X"?"x":c==="O"?"o":"empty"}`}>{c||""}</span>
                ))}
              </div>
            </div>
            <div className="game-card-info">
              <h2 className="game-card-title">TIC TAC TOE</h2>
              <p className="game-card-desc">Tris classico con modalità Blitz, Random, Abilità Speciali e Bot</p>
              <div className="game-card-tags">
                <span className="game-tag">⏱ Blitz</span>
                <span className="game-tag">🎲 Random</span>
                <span className="game-tag">⚡ Abilità</span>
                <span className="game-tag">🤖 Bot</span>
                <span className="game-tag">🔲 3 griglie</span>
              </div>
            </div>
            <div className="game-card-cta">GIOCA →</div>
          </button>

          {/* Connect 4 */}
          <button className="game-card game-card-c4" onClick={() => handleSelectGame("c4")}>
            <div className="game-card-preview">
              <div className="c4-preview-grid">
                {[null,null,null,null,null,null,null,null,null,null,null,null,null,null,
                  null,null,null,"r",null,null,null,null,null,"r","y",null,null,null,
                  null,"r","y","y","r",null,null,"y","r","y","r","y","r",null,
                ].map((c,i) => (
                  <span key={i} className={`c4-pre ${c==="r"?"c4-pre-r":c==="y"?"c4-pre-y":"c4-pre-empty"}`} />
                ))}
              </div>
            </div>
            <div className="game-card-info">
              <h2 className="game-card-title">CONNECT 4</h2>
              <p className="game-card-desc">Allinea le pedine con Blitz, Random, Power-up, Gravity, Pop Out e Bot</p>
              <div className="game-card-tags">
                <span className="game-tag">⏱ Blitz</span>
                <span className="game-tag">🎲 Random</span>
                <span className="game-tag">⚡ Power-up</span>
                <span className="game-tag">🌀 Gravity</span>
                <span className="game-tag">🤖 Bot</span>
              </div>
            </div>
            <div className="game-card-cta">GIOCA →</div>
          </button>

          {/* Battleship */}
          <button className="game-card game-card-bs" onClick={() => handleSelectGame("bs")}>
            <div className="game-card-preview">
              <div className="bs-preview-grid">
                {Array(25).fill(null).map((_, i) => (
                  <span key={i} className={`bs-pre-cell ${[2,3,7,12,17,22].includes(i) ? "bs-pre-ship" : [6,11].includes(i) ? "bs-pre-hit" : i === 1 ? "bs-pre-miss" : ""}`} />
                ))}
              </div>
            </div>
            <div className="game-card-info">
              <h2 className="game-card-title">BATTLESHIP</h2>
              <p className="game-card-desc">Affonda la flotta nemica con Power-up, Nebbia di Guerra e Bot</p>
              <div className="game-card-tags">
                <span className="game-tag">⏱ Blitz</span>
                <span className="game-tag">💥 Power-up</span>
                <span className="game-tag">🌫️ Nebbia</span>
                <span className="game-tag">🤖 Bot</span>
                <span className="game-tag">🔲 3 griglie</span>
              </div>
            </div>
            <div className="game-card-cta">GIOCA →</div>
          </button>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => { setStep("name"); setError(""); }}>← Cambia nome</button>
      </div>
    );
  }

  // ── Step azioni ────────────────────────────────────────────
  const gameTitle = isBS ? "BATTLESHIP" : isC4 ? "CONNECT 4" : "TIC TAC TOE";

  return (
    <div className="home-page">
      {hero}
      <div className="home-card">
        <div className="game-actions-header">
          <button className="btn btn-ghost btn-sm" onClick={() => { setStep("select"); setMode(null); setError(""); }}>← Giochi</button>
          <span className="game-actions-title">{gameTitle}</span>
          <span className="game-actions-player">{playerName}</span>
        </div>

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
              <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>{loading ? "Creando…" : "✦ Crea la stanza"}</button>
              <button className="btn btn-ghost" onClick={() => { setMode(null); setError(""); }}>← Indietro</button>
            </div>
          </div>
        )}

        {mode === "join" && (
          <div className="mode-section">
            <div className="input-group">
              <label className="input-label">Codice stanza</label>
              <input className="input-field input-code" type="text" placeholder="es. AB3XY7"
                value={joinCode} maxLength={6}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && handleJoin()} />
            </div>
            <div className="action-buttons">
              <button className="btn btn-primary" onClick={handleJoin} disabled={loading}>{loading ? "Entrando…" : "⟶ Entra"}</button>
              <button className="btn btn-ghost" onClick={() => { setMode(null); setError(""); }}>← Indietro</button>
            </div>
          </div>
        )}

        {mode === "bot" && (
          <div className="mode-section">
            {/* Difficoltà */}
            <div className="bot-option-group">
              <p className="bot-option-label">🤖 Difficoltà</p>
              <div className="bot-difficulty-btns">
                <button className={`btn ${botDifficulty==="easy"?"btn-primary":"btn-ghost"}`} onClick={() => setBotDifficulty("easy")}>😊 Facile</button>
                <button className={`btn ${botDifficulty==="hard"?"btn-primary":"btn-ghost"}`} onClick={() => setBotDifficulty("hard")}>💀 Difficile</button>
              </div>
              {botDifficulty === "hard" && !isBS && <p className="bot-hard-warning">⚠️ Il bot gioca in modo ottimale!</p>}
            </div>

            {/* Griglia */}
            <div className="bot-option-group">
              <p className="bot-option-label">🔲 Griglia</p>
              <div className="timer-options">
                {(isBS ? BS_GRID_OPTIONS : isC4 ? C4_GRID_OPTIONS : TTT_GRID_OPTIONS).map(opt => (
                  <button key={opt.value}
                    className={`timer-option ${(isBS ? botBsGrid : isC4 ? botC4Grid : botTttGrid) === opt.value ? "selected" : ""}`}
                    onClick={() => isBS ? setBotBsGrid(opt.value) : isC4 ? setBotC4Grid(opt.value) : setBotTttGrid(opt.value)}>
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
                  <button key={opt.value} className={`timer-option ${botTimer===opt.value?"selected":""}`} onClick={() => setBotTimer(opt.value)}>
                    <span className="timer-label">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Random — solo Tris e C4 */}
            {!isBS && (
              <div className="bot-option-group">
                <p className="bot-option-label">🎲 Random</p>
                <div className="timer-options">
                  {RANDOM_OPTIONS.map(opt => (
                    <button key={opt.value} className={`timer-option ${botRandom===opt.value?"selected":""}`} onClick={() => setBotRandom(opt.value)}>
                      <span className="timer-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Toggle modalità */}
            <div className="bot-option-group">
              {!isC4 && !isBS && (
                <button className={`ability-toggle ${botAbilities?"enabled":""}`} onClick={() => setBotAbilities(!botAbilities)}>
                  {botAbilities ? "✓ Abilità ATTIVE" : "⚡ Attiva Abilità Speciali"}
                </button>
              )}
              {isC4 && (
                <>
                  <button className={`ability-toggle ${botPowerUps?"enabled":""}`} onClick={() => setBotPowerUps(!botPowerUps)}>
                    {botPowerUps ? "✓ Power-up ATTIVI" : "⚡ Attiva Power-up"}
                  </button>
                  <button className={`ability-toggle ${botGravity?"enabled":""}`} style={{marginTop:"8px"}} onClick={() => setBotGravity(!botGravity)}>
                    {botGravity ? "✓ Gravity ATTIVA" : "🌀 Attiva Gravity"}
                  </button>
                  <button className={`ability-toggle ${botPopOut?"enabled":""}`} style={{marginTop:"8px"}} onClick={() => setBotPopOut(!botPopOut)}>
                    {botPopOut ? "✓ Pop Out ATTIVO" : "🎯 Attiva Pop Out"}
                  </button>
                </>
              )}
              {isBS && (
                <>
                  <button className={`ability-toggle ${botPowerUps?"enabled":""}`} onClick={() => setBotPowerUps(!botPowerUps)}>
                    {botPowerUps ? "✓ Power-up ATTIVI" : "⚡ Attiva Power-up"}
                  </button>
                  <button className={`ability-toggle ${botFogOfWar?"enabled":""}`} style={{marginTop:"8px"}} onClick={() => setBotFogOfWar(!botFogOfWar)}>
                    {botFogOfWar ? "✓ Nebbia ATTIVA" : "🌫️ Attiva Nebbia di Guerra"}
                  </button>
                </>
              )}
            </div>

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
