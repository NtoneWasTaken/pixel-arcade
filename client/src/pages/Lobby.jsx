// ============================================================
// pages/Lobby.jsx — Tris + Connect 4
// ============================================================
import { useState, useEffect, useRef } from "react";
import socket from "../socket/socket";
import ChatBox from "../components/ChatBox";

const TIMER_OPTIONS = [
  { label: "Nessun timer", value: 0,  icon: "∞"   },
  { label: "10 secondi",   value: 10, icon: "10s"  },
  { label: "5 secondi",    value: 5,  icon: "5s"   },
];

const RANDOM_OPTIONS = [
  { label: "Disattivato", value: 0,   icon: "—"      },
  { label: "Leggero",     value: 0.2, icon: "🎲"     },
  { label: "Caotico",     value: 0.4, icon: "🎲🎲"   },
  { label: "Anarchia",    value: 0.6, icon: "🎲🎲🎲" },
];

const GRID_OPTIONS = [
  { label: "3×3", value: 3, desc: "Classico"   },
  { label: "4×4", value: 4, desc: "Strategico" },
  { label: "5×5", value: 5, desc: "Epico"      },
];

function ScoreDisplay({ room, myId }) {
  const players = room?.players || [];
  const score   = room?.score   || {};
  const me  = players.find(p => p.id === myId);
  const opp = players.find(p => p.id !== myId);
  const myScore  = score[myId]    ?? 0;
  const oppScore = score[opp?.id] ?? 0;

  const prevMy  = useRef(myScore);
  const prevOpp = useRef(oppScore);
  const [myGlow,  setMyGlow]  = useState(false);
  const [oppGlow, setOppGlow] = useState(false);

  useEffect(() => {
    if (myScore > prevMy.current) { setMyGlow(true); setTimeout(() => setMyGlow(false), 900); }
    prevMy.current = myScore;
  }, [myScore]);

  useEffect(() => {
    if (oppScore > prevOpp.current) { setOppGlow(true); setTimeout(() => setOppGlow(false), 900); }
    prevOpp.current = oppScore;
  }, [oppScore]);

  if (players.length < 2) return null;

  return (
    <div className="score-display">
      <div className={`score-side score-left ${myGlow ? "score-glow-blue" : ""}`}>
        <span className="score-name-small">{me?.name  || "Tu"}</span>
        <span className="score-number score-blue">{myScore}</span>
      </div>
      <div className="score-center">
        <span className="room-code-label">#{room?.code}</span>
      </div>
      <div className={`score-side score-right ${oppGlow ? "score-glow-red" : ""}`}>
        <span className="score-name-small">{opp?.name || "Avversario"}</span>
        <span className="score-number score-red">{oppScore}</span>
      </div>
    </div>
  );
}

export default function Lobby({ roomCode, player, initialRoom, selectedGame, onGameStart, onLeave }) {
  const [room,             setRoom]             = useState(initialRoom || { players: [player], code: roomCode });
  const [error,            setError]            = useState("");
  const [copied,           setCopied]           = useState(false);
  const [timerSeconds,     setTimerSeconds]     = useState(0);
  const [randomChance,     setRandomChance]     = useState(0);
  const [abilitiesEnabled, setAbilitiesEnabled] = useState(false);
  const [gridSize,         setGridSize]         = useState(3);

  const isC4 = selectedGame === "c4";

  useEffect(() => {
    const handlePlayerJoined = ({ room: r }) => setRoom(r);
    const handleGameStarted  = ({ gameState, gameType }) => onGameStart(gameState, gameType);
    const handlePlayerLeft   = ({ room: r, message }) => { setRoom(r); setError(message); };
    const handleError        = ({ message }) => setError(message);

    socket.on("player_joined", handlePlayerJoined);
    socket.on("game_started",  handleGameStarted);
    socket.on("player_left",   handlePlayerLeft);
    socket.on("error",         handleError);

    return () => {
      socket.off("player_joined", handlePlayerJoined);
      socket.off("game_started",  handleGameStarted);
      socket.off("player_left",   handlePlayerLeft);
      socket.off("error",         handleError);
    };
  }, [onGameStart]);

  const handleStart = () => {
    setError("");
    if (isC4) {
      socket.emit("start_game_c4", { timerSeconds, randomChance });
    } else {
      socket.emit("start_game", { timerSeconds, randomChance, abilitiesEnabled, gridSize });
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHost   = player?.isHost;
  const canStart = room.players.length === 2;
  const hasTwo   = room.players.length === 2;

  return (
    <div className="lobby-page">
      <div className="lobby-header">
        <button className="btn btn-ghost btn-sm" onClick={onLeave}>← Esci</button>
        <h2 className="lobby-title">{isC4 ? "CONNECT 4" : "TIC TAC TOE"}</h2>
        <div />
      </div>

      <ScoreDisplay room={room} myId={socket.id} />

      {!hasTwo && (
        <div className="room-code-block">
          <p className="code-label">Codice stanza</p>
          <div className="code-display">
            <span className="code-text">{roomCode}</span>
            <button className="btn btn-ghost btn-sm" onClick={copyCode}>
              {copied ? "✓ Copiato!" : "Copia"}
            </button>
          </div>
          <p className="code-hint">Condividi questo codice con il tuo avversario</p>
        </div>
      )}

      <div className="players-section">
        <h3 className="section-title">Giocatori ({room.players.length}/2)</h3>
        <div className="players-list">
          {room.players.map((p, i) => (
            <div key={p.id} className={`player-slot filled ${p.id === socket.id ? "me" : ""}`}>
              <span className="player-symbol">
                {isC4 ? (i === 0 ? "🔴" : "🟡") : (i === 0 ? "✕" : "◯")}
              </span>
              <span className="player-name">{p.name}</span>
              <span className="player-badges">
                {p.isHost && <span className="badge">Host</span>}
                {p.id === socket.id && <span className="badge badge-me">Tu</span>}
              </span>
            </div>
          ))}
          {!hasTwo && (
            <div className="player-slot empty">
              <span className="player-waiting">In attesa di un giocatore…</span>
              <span className="waiting-dot" />
            </div>
          )}
        </div>
      </div>

      {isHost ? (
        <>
          {/* Griglia — solo Tris */}
          {!isC4 && (
            <div className="timer-section">
              <h3 className="section-title">🔲 Griglia</h3>
              <div className="timer-options">
                {GRID_OPTIONS.map(opt => (
                  <button key={opt.value}
                    className={`timer-option ${gridSize === opt.value ? "selected" : ""}`}
                    onClick={() => setGridSize(opt.value)}>
                    <span className="timer-icon">{opt.label}</span>
                    <span className="timer-label">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timer */}
          <div className="timer-section">
            <h3 className="section-title">⏱ Modalità Timer</h3>
            <div className="timer-options">
              {TIMER_OPTIONS.map(opt => (
                <button key={opt.value}
                  className={`timer-option ${timerSeconds === opt.value ? "selected" : ""}`}
                  onClick={() => setTimerSeconds(opt.value)}>
                  <span className="timer-icon">{opt.icon}</span>
                  <span className="timer-label">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Random */}
          <div className="timer-section">
            <h3 className="section-title">🎲 Modalità Random</h3>
            <div className="timer-options">
              {RANDOM_OPTIONS.map(opt => (
                <button key={opt.value}
                  className={`timer-option ${randomChance === opt.value ? "selected" : ""}`}
                  onClick={() => setRandomChance(opt.value)}>
                  <span className="timer-icon">{opt.icon}</span>
                  <span className="timer-label">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Abilità — solo Tris */}
          {!isC4 && (
            <div className="timer-section">
              <h3 className="section-title">⚡ Abilità Speciali</h3>
              <div className="abilities-preview">
                <div className="ability-preview-item"><span>🔄</span><span>Scambia</span></div>
                <div className="ability-preview-item"><span>💣</span><span>Bomba</span></div>
                <div className="ability-preview-item"><span>👁️</span><span>Fantasma</span></div>
              </div>
              <button
                className={`ability-toggle ${abilitiesEnabled ? "enabled" : ""}`}
                onClick={() => setAbilitiesEnabled(!abilitiesEnabled)}
              >
                {abilitiesEnabled ? "✓ Abilità ATTIVE" : "Attiva Abilità Speciali"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="timer-section">
          <p className="waiting-msg">L&apos;host sta configurando la partita…</p>
        </div>
      )}

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

      {hasTwo && <ChatBox myId={socket.id} />}
    </div>
  );
}
