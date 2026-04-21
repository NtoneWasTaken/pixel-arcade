// ============================================================
// pages/Lobby.jsx — Timer + Random + Abilità Speciali + Punteggio
// ============================================================
import { useState, useEffect, useRef } from "react";
import socket from "../socket/socket";

const TIMER_OPTIONS = [
  { label: "Nessun timer", value: 0, icon: "∞" },
  { label: "10 secondi", value: 10, icon: "10s" },
  { label: "5 secondi", value: 5, icon: "5s" },
];

const RANDOM_OPTIONS = [
  { label: "Disattivato", value: 0, icon: "—" },
  { label: "Leggero", value: 0.2, icon: "🎲" },
  { label: "Caotico", value: 0.4, icon: "🎲🎲" },
  { label: "Anarchia", value: 0.6, icon: "🎲🎲🎲" },
];

// ── ScoreDisplay (stesso componente di Game.jsx) ─────────────
function ScoreDisplay({ room, myId }) {
  const players = room?.players || [];
  const score = room?.score || {};

  const me = players.find((p) => p.id === myId);
  const opp = players.find((p) => p.id !== myId);

  const myScore = score[myId] ?? 0;
  const oppScore = score[opp?.id] ?? 0;

  const prevMyScore = useRef(myScore);
  const prevOppScore = useRef(oppScore);
  const [myGlow, setMyGlow] = useState(false);
  const [oppGlow, setOppGlow] = useState(false);

  useEffect(() => {
    if (myScore > prevMyScore.current) {
      setMyGlow(true);
      setTimeout(() => setMyGlow(false), 900);
    }
    prevMyScore.current = myScore;
  }, [myScore]);

  useEffect(() => {
    if (oppScore > prevOppScore.current) {
      setOppGlow(true);
      setTimeout(() => setOppGlow(false), 900);
    }
    prevOppScore.current = oppScore;
  }, [oppScore]);

  // Mostra solo se ci sono 2 giocatori
  if (players.length < 2) return null;

  return (
    <div className="score-display">
      {/* Punteggio mio — sempre a sinistra, blu */}
      <div className={`score-side score-left ${myGlow ? "score-glow-blue" : ""}`}>
        <span className="score-name-small">{me?.name || "Tu"}</span>
        <span className="score-number score-blue">{myScore}</span>
      </div>

      {/* Codice stanza al centro */}
      <div className="score-center">
        <span className="room-code-label">#{room?.code}</span>
      </div>

      {/* Punteggio avversario — sempre a destra, rosso */}
      <div className={`score-side score-right ${oppGlow ? "score-glow-red" : ""}`}>
        <span className="score-name-small">{opp?.name || "Avversario"}</span>
        <span className="score-number score-red">{oppScore}</span>
      </div>
    </div>
  );
}

export default function Lobby({ roomCode, player, initialRoom, onGameStart, onLeave }) {
  const [room, setRoom] = useState(initialRoom || { players: [player], code: roomCode });
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [randomChance, setRandomChance] = useState(0);
  const [abilitiesEnabled, setAbilitiesEnabled] = useState(false);

  useEffect(() => {
    const handlePlayerJoined = ({ room: r }) => setRoom(r);
    const handleGameStarted = ({ gameState }) => onGameStart(gameState);
    const handlePlayerLeft = ({ room: r, message }) => { setRoom(r); setError(message); };
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
    socket.emit("start_game", { timerSeconds, randomChance, abilitiesEnabled });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHost = player?.isHost;
  const canStart = room.players.length === 2;

  return (
    <div className="lobby-page">
      <div className="lobby-header">
        <button className="btn btn-ghost btn-sm" onClick={onLeave}>← Esci</button>
        <h2 className="lobby-title">LOBBY</h2>
        <div />
      </div>

      {/* Punteggio — visibile solo quando ci sono 2 giocatori */}
      <ScoreDisplay room={room} myId={socket.id} />

      {/* Codice stanza — visibile solo se NON ci sono ancora 2 giocatori */}
      {room.players.length < 2 && (
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

      {isHost ? (
        <>
          {/* Timer */}
          <div className="timer-section">
            <h3 className="section-title">⏱ Modalità Timer</h3>
            <div className="timer-options">
              {TIMER_OPTIONS.map((opt) => (
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
              {RANDOM_OPTIONS.map((opt) => (
                <button key={opt.value}
                  className={`timer-option ${randomChance === opt.value ? "selected" : ""}`}
                  onClick={() => setRandomChance(opt.value)}>
                  <span className="timer-icon">{opt.icon}</span>
                  <span className="timer-label">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Abilità Speciali */}
          <div className="timer-section">
            <h3 className="section-title">⚡ Abilità Speciali</h3>
            <div className="abilities-preview">
              <div className="ability-preview-item">
                <span>🔄</span><span>Scambia</span>
              </div>
              <div className="ability-preview-item">
                <span>💣</span><span>Bomba</span>
              </div>
              <div className="ability-preview-item">
                <span>👁️</span><span>Fantasma</span>
              </div>
            </div>
            <button
              className={`ability-toggle ${abilitiesEnabled ? "enabled" : ""}`}
              onClick={() => setAbilitiesEnabled(!abilitiesEnabled)}
            >
              {abilitiesEnabled ? "✓ Abilità ATTIVE" : "Attiva Abilità Speciali"}
            </button>
          </div>
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
    </div>
  );
}
