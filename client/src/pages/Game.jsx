// ============================================================
// pages/Game.jsx — Timer + Random + Abilità + Punteggio + Bot
// ============================================================
import { useState, useEffect, useRef } from "react";
import socket from "../socket/socket";
import TicTacToeBoard from "../components/TicTacToeBoard";

// ── TimerBar ─────────────────────────────────────────────────
function TimerBar({ timerSeconds, turnStartedAt, currentTurn, myId }) {
  const [progress, setProgress] = useState(100);
  const [phase, setPhase] = useState("green");
  const rafRef = useRef(null);

  useEffect(() => {
    if (!timerSeconds || !turnStartedAt) { setProgress(100); setPhase("green"); return; }
    const totalMs = timerSeconds * 1000;
    const tick = () => {
      const remaining = Math.max(0, totalMs - (Date.now() - turnStartedAt));
      const pct = (remaining / totalMs) * 100;
      setProgress(pct);
      setPhase(remaining > totalMs * 0.5 ? "green" : remaining > totalMs * 0.25 ? "yellow" : "red");
      if (remaining > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [timerSeconds, turnStartedAt]);

  if (!timerSeconds) return null;
  return (
    <div className="timer-bar-wrapper">
      <div className="timer-bar-labels">
        <span className="timer-bar-who">{currentTurn === myId ? "⚡ Il tuo turno" : "⏳ Turno avversario"}</span>
        <span className={`timer-bar-seconds timer-${phase}`}>{Math.ceil((progress / 100) * timerSeconds)}s</span>
      </div>
      <div className="timer-bar-track">
        <div className={`timer-bar-fill timer-fill-${phase} ${phase === "red" ? "timer-pulse" : ""}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

// ── AbilityButton ────────────────────────────────────────────
function AbilityButton({ icon, label, uses, onClick, disabled, selecting }) {
  return (
    <button
      className={`ability-btn ${uses === 0 ? "ability-used" : ""} ${selecting ? "ability-selecting" : ""} ${disabled ? "ability-disabled" : ""}`}
      onClick={onClick}
      disabled={uses === 0 || disabled}
      title={label}
    >
      <span className="ability-icon">{icon}</span>
      <span className="ability-label">{label}</span>
      <span className="ability-uses">{uses > 0 ? "1× " : "✗"}</span>
    </button>
  );
}

// ── ScoreDisplay ─────────────────────────────────────────────
function ScoreDisplay({ gameState, roomCode }) {
  const myId = socket.id;
  const score = gameState.score || {};

  const me  = gameState.players.find((p) => p.id === myId);
  const opp = gameState.players.find((p) => p.id !== myId);

  const myScore  = score[myId]      ?? 0;
  const oppScore = score[opp?.id]   ?? 0;

  const prevMyScore  = useRef(myScore);
  const prevOppScore = useRef(oppScore);
  const [myGlow,  setMyGlow]  = useState(false);
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

  return (
    <div className="score-display">
      <div className={`score-side score-left ${myGlow ? "score-glow-blue" : ""}`}>
        <span className="score-name-small">{me?.name || "Tu"}</span>
        <span className="score-number score-blue">{myScore}</span>
      </div>
      <div className="score-center">
        <span className="room-code-label">{roomCode ? `#${roomCode}` : "VS"}</span>
      </div>
      <div className={`score-side score-right ${oppGlow ? "score-glow-red" : ""}`}>
        <span className="score-name-small">{opp?.name || "Avversario"}</span>
        <span className="score-number score-red">{oppScore}</span>
      </div>
    </div>
  );
}

// ── Game page ─────────────────────────────────────────────────
export default function Game({ initialGameState, player, roomCode, isBot = false, onLeave }) {
  const [gameState,      setGameState]      = useState(initialGameState);
  const [message,        setMessage]        = useState("");
  const [skippedMsg,     setSkippedMsg]     = useState("");
  const [deviationAnim,  setDeviationAnim]  = useState(null);
  const [notification,   setNotification]   = useState("");
  const [botThinking,    setBotThinking]    = useState(false);
  const [selectingAbility, setSelectingAbility] = useState(null);

  useEffect(() => { updateMessage(initialGameState); }, []);

  useEffect(() => {
    const handleGameUpdate = ({ gameState: gs, deviated, intendedIndex, actualIndex }) => {
      setBotThinking(false);
      setGameState(gs); updateMessage(gs); setSkippedMsg("");
      if (deviated) {
        setDeviationAnim({ intended: intendedIndex, actual: actualIndex });
        setTimeout(() => setDeviationAnim(null), 700);
      }
      // Se tocca al bot dopo l'aggiornamento, mostra "pensa..."
      if (isBot && gs.status === "playing" && gs.currentTurn !== socket.id) {
        setBotThinking(true);
      }
    };
    const handleGameStarted = ({ gameState: gs }) => {
      setGameState(gs); updateMessage(gs); setBotThinking(false);
      setSelectingAbility(null);
    };
    const handleAbilityUsed = ({ playerId, abilityName, gameState: gs }) => {
      setBotThinking(false);
      setGameState(gs); updateMessage(gs);
      const names = { scambia: "🔄 Scambia", bomba: "💣 Bomba", fantasma: "👁️ Fantasma" };
      const who = playerId === socket.id ? "Hai usato" : "L'avversario ha usato";
      showNotification(`${who} ${names[abilityName]}!`);
      setSelectingAbility(null);
      if (isBot && gs.status === "playing" && gs.currentTurn !== socket.id) {
        setBotThinking(true);
      }
    };
    const handleTurnSkipped = ({ skippedPlayerId, gameState: gs }) => {
      setGameState(gs); updateMessage(gs);
      setSkippedMsg(skippedPlayerId === socket.id ? "Hai esaurito il tempo! Turno saltato." : "L'avversario ha esaurito il tempo! Tocca a te.");
      setTimeout(() => setSkippedMsg(""), 2500);
      if (isBot && gs.status === "playing" && gs.currentTurn !== socket.id) {
        setBotThinking(true);
      }
    };
    const handleGameAborted = ({ message: msg }) => setMessage(msg);
    const handleRematchReady = ({ room }) => onLeave("lobby", room);

    socket.on("game_update",    handleGameUpdate);
    socket.on("game_started",   handleGameStarted);
    socket.on("ability_used",   handleAbilityUsed);
    socket.on("turn_skipped",   handleTurnSkipped);
    socket.on("game_aborted",   handleGameAborted);
    socket.on("rematch_ready",  handleRematchReady);

    return () => {
      socket.off("game_update",   handleGameUpdate);
      socket.off("game_started",  handleGameStarted);
      socket.off("ability_used",  handleAbilityUsed);
      socket.off("turn_skipped",  handleTurnSkipped);
      socket.off("game_aborted",  handleGameAborted);
      socket.off("rematch_ready", handleRematchReady);
    };
  }, [onLeave, isBot]);

  function updateMessage(gs) {
    if (gs.status === "finished") {
      if (gs.winner === "draw") setMessage("Pareggio!");
      else if (gs.winner === socket.id) setMessage("🎉 Hai vinto!");
      else setMessage(isBot ? "🤖 Il bot ha vinto!" : "Hai perso. Ritenta!");
      return;
    }
    if (isBot) {
      setMessage(gs.currentTurn === socket.id ? "È il tuo turno!" : "🤖 Il bot sta pensando…");
    } else {
      setMessage(gs.currentTurn === socket.id ? "È il tuo turno!" : `Turno di ${gs.players.find(p => p.id !== socket.id)?.name}…`);
    }
  }

  function showNotification(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(""), 2500);
  }

  const handleCellClick = (index) => {
    if (selectingAbility === "scambia" || selectingAbility === "bomba") {
      socket.emit("use_ability", { abilityName: selectingAbility, targetIndex: index });
      setSelectingAbility(null);
    } else if (selectingAbility === "fantasma") {
      socket.emit("use_ability", { abilityName: "fantasma", index });
      setSelectingAbility(null);
    } else {
      socket.emit("player_move", { index });
    }
  };

  const handleAbilityClick = (abilityName) => {
    if (selectingAbility === abilityName) {
      setSelectingAbility(null);
    } else {
      setSelectingAbility(abilityName);
      const hints = {
        scambia: "🔄 Clicca una cella dell'avversario da convertire",
        bomba:   "💣 Clicca una cella dell'avversario da rimuovere",
        fantasma:"👁️ Clicca una cella vuota per la mossa nascosta",
      };
      showNotification(hints[abilityName]);
    }
  };

  const myPlayer   = gameState.players.find((p) => p.id === socket.id);
  const isMyTurn   = gameState.currentTurn === socket.id && gameState.status === "playing";
  const isFinished = gameState.status === "finished";
  const iWon       = isFinished && gameState.winner === socket.id;
  const isDraw     = isFinished && gameState.winner === "draw";

  const myAbilities  = gameState.abilitiesEnabled ? (gameState.abilities?.[socket.id] || {}) : null;
  const oppAbilities = gameState.abilitiesEnabled
    ? (gameState.abilities?.[gameState.players.find(p => p.id !== socket.id)?.id] || {})
    : null;

  const hasTimer  = gameState.timerSeconds > 0;
  const hasRandom = gameState.randomChance > 0;

  return (
    <div className="game-page">
      <div className="game-header">
        <button className="btn btn-ghost btn-sm" onClick={() => onLeave("home")}>✕ Abbandona</button>
        <h2 className="game-title">TIC TAC TOE</h2>
        <div className="my-symbol">
          <span className={`symbol-badge ${myPlayer?.symbol === "X" ? "x" : "o"}`}>
            Sei {myPlayer?.symbol === "X" ? "✕" : "◯"}
          </span>
        </div>
      </div>

      {/* Punteggio con codice stanza (o "VS" per bot) */}
      <ScoreDisplay gameState={gameState} roomCode={roomCode} />

      {isBot && (
        <div className="bot-indicator">
          🤖 Stai giocando contro il Bot
        </div>
      )}

      {(hasTimer || hasRandom || gameState.abilitiesEnabled) && (
        <div className="mode-badges">
          {hasTimer      && <span className="mode-badge">⏱ {gameState.timerSeconds}s</span>}
          {hasRandom     && <span className="mode-badge mode-badge-random">🎲 {gameState.randomChance === 0.2 ? "Leggero" : gameState.randomChance === 0.4 ? "Caotico" : "Anarchia"}</span>}
          {gameState.abilitiesEnabled && <span className="mode-badge mode-badge-ability">⚡ Abilità</span>}
        </div>
      )}

      <div className="scoreboard">
        {gameState.players.map((p) => (
          <div key={p.id} className={`score-player ${gameState.currentTurn === p.id && !isFinished ? "active-turn" : ""}`}>
            <span className="score-symbol">{p.symbol === "X" ? "✕" : "◯"}</span>
            <span className="score-name">{p.id === socket.id ? "Tu" : p.name}</span>
            {oppAbilities && p.id !== socket.id && (
              <span className="opp-abilities-left">
                {Object.values(gameState.abilities[p.id] || {}).filter(v => v > 0).length}⚡
              </span>
            )}
          </div>
        ))}
      </div>

      <TimerBar timerSeconds={gameState.timerSeconds} turnStartedAt={gameState.turnStartedAt} currentTurn={gameState.currentTurn} myId={socket.id} />

      {notification  && <div className="skipped-msg notification-msg">{notification}</div>}
      {skippedMsg    && <div className="skipped-msg">{skippedMsg}</div>}
      {deviationAnim && <div className="skipped-msg deviation-msg">🎲 Mossa deviata!</div>}

      <div className={`status-banner ${isFinished ? (iWon ? "banner-win" : isDraw ? "banner-draw" : "banner-lose") : isMyTurn ? "banner-your-turn" : "banner-wait"}`}>
        {selectingAbility ? "Seleziona una cella…" : message}
      </div>

      {myAbilities && isMyTurn && !isFinished && (
        <div className="abilities-panel">
          <AbilityButton icon="🔄" label="Scambia" uses={myAbilities.scambia ?? 1}
            onClick={() => handleAbilityClick("scambia")}
            selecting={selectingAbility === "scambia"} disabled={!isMyTurn} />
          <AbilityButton icon="💣" label="Bomba" uses={myAbilities.bomba ?? 1}
            onClick={() => handleAbilityClick("bomba")}
            selecting={selectingAbility === "bomba"} disabled={!isMyTurn} />
          <AbilityButton icon="👁️" label="Fantasma" uses={myAbilities.fantasma ?? 1}
            onClick={() => handleAbilityClick("fantasma")}
            selecting={selectingAbility === "fantasma"} disabled={!isMyTurn} />
        </div>
      )}

      <TicTacToeBoard
        board={gameState.board}
        winLine={gameState.winLine}
        onCellClick={handleCellClick}
        disabled={!isMyTurn && !selectingAbility}
        deviationAnim={deviationAnim}
        selectingAbility={selectingAbility}
        gameState={gameState}
        myId={socket.id}
      />

      {isFinished && (
        <div className="game-over-actions">
          <button className="btn btn-primary" onClick={() => socket.emit("request_rematch")}>↺ Rivincita</button>
          <button className="btn btn-ghost"   onClick={() => onLeave("home")}>⌂ Home</button>
        </div>
      )}
    </div>
  );
}
