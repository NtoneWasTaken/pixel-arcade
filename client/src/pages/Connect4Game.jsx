// ============================================================
// pages/Connect4Game.jsx — Connect 4 + Power-ups + Griglie
// ============================================================
import { useState, useEffect, useRef } from "react";
import socket from "../socket/socket";
import Connect4Board from "../components/Connect4Board";
import ChatBox from "../components/ChatBox";

function TimerBar({ timerSeconds, turnStartedAt, currentTurn, myId }) {
  const [progress, setProgress] = useState(100);
  const [phase,    setPhase]    = useState("green");
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

function ScoreDisplay({ gameState, roomCode }) {
  const myId  = socket.id;
  const score = gameState.score || {};
  const me    = gameState.players.find(p => p.id === myId);
  const opp   = gameState.players.find(p => p.id !== myId);
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

// ── PowerUpButton ─────────────────────────────────────────────
function PowerUpButton({ icon, label, uses, onClick, selecting, disabled }) {
  return (
    <button
      className={`ability-btn ${uses === 0 ? "ability-used" : ""} ${selecting ? "ability-selecting" : ""} ${disabled ? "ability-disabled" : ""}`}
      onClick={onClick}
      disabled={uses === 0 || disabled}
      title={label}
    >
      <span className="ability-icon">{icon}</span>
      <span className="ability-label">{label}</span>
      <span className="ability-uses">{uses > 0 ? "1×" : "✗"}</span>
    </button>
  );
}

// ── Connect4Game ──────────────────────────────────────────────
export default function Connect4Game({ initialGameState, roomCode, isBot = false, onLeave }) {
  const [gameState,       setGameState]       = useState(initialGameState);
  const [message,         setMessage]         = useState("");
  const [skippedMsg,      setSkippedMsg]      = useState("");
  const [notification,    setNotification]    = useState("");
  const [deviationAnim,   setDeviationAnim]   = useState(null);
  const [selectingPowerUp,setSelectingPowerUp]= useState(null); // null | "bomba" | "extra" | "shuffle"

  const myPlayer = gameState.players.find(p => p.id === socket.id);
  const mySymbol = myPlayer?.symbol;

  useEffect(() => { updateMessage(initialGameState); }, []);

  useEffect(() => {
    const handleGameUpdate = ({ gameState: gs, deviated, intendedCol, actualCol, row }) => {
      setGameState(gs);
      updateMessage(gs);
      setSkippedMsg("");
      setSelectingPowerUp(null);
      setDeviationAnim({ deviated, intendedCol, actualCol, row });
      setTimeout(() => setDeviationAnim(null), 600);
      if (deviated) showNotification("🎲 Mossa deviata!");
    };
    const handleGameStarted = ({ gameState: gs }) => {
      setGameState(gs); updateMessage(gs); setSelectingPowerUp(null);
    };
    const handlePowerUpUsed = ({ playerId, powerUpName, gameState: gs }) => {
      setGameState(gs); updateMessage(gs); setSelectingPowerUp(null);
      const names = { bomba: "💣 Bomba", extra: "➕ Extra", shuffle: "🔀 Shuffle" };
      const who = playerId === socket.id ? "Hai usato" : "L'avversario ha usato";
      showNotification(`${who} ${names[powerUpName]}!`);
    };
    const handleTurnSkipped = ({ skippedPlayerId, gameState: gs }) => {
      setGameState(gs); updateMessage(gs);
      setSkippedMsg(skippedPlayerId === socket.id ? "Hai esaurito il tempo! Turno saltato." : "L'avversario ha esaurito il tempo! Tocca a te.");
      setTimeout(() => setSkippedMsg(""), 2500);
    };
    const handleGameAborted  = ({ message: msg }) => setMessage(msg);
    const handleRematchReady = ({ room }) => onLeave("lobby", room);

    socket.on("game_update",   handleGameUpdate);
    socket.on("game_started",  handleGameStarted);
    socket.on("powerup_used",  handlePowerUpUsed);
    socket.on("turn_skipped",  handleTurnSkipped);
    socket.on("game_aborted",  handleGameAborted);
    socket.on("rematch_ready", handleRematchReady);

    return () => {
      socket.off("game_update",   handleGameUpdate);
      socket.off("game_started",  handleGameStarted);
      socket.off("powerup_used",  handlePowerUpUsed);
      socket.off("turn_skipped",  handleTurnSkipped);
      socket.off("game_aborted",  handleGameAborted);
      socket.off("rematch_ready", handleRematchReady);
    };
  }, [onLeave]);

  function updateMessage(gs) {
    if (gs.status === "finished") {
      if (gs.winner === "draw")         setMessage("Pareggio!");
      else if (gs.winner === socket.id) setMessage("🎉 Hai vinto!");
      else setMessage(isBot ? "🤖 Il bot ha vinto!" : "Hai perso. Ritenta!");
      return;
    }
    if (isBot) {
      setMessage(gs.currentTurn === socket.id ? "È il tuo turno!" : "🤖 Il bot sta pensando…");
    } else {
      const opp = gs.players.find(p => p.id !== socket.id);
      setMessage(gs.currentTurn === socket.id ? "È il tuo turno!" : `Turno di ${opp?.name}…`);
    }
  }

  function showNotification(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(""), 2000);
  }

  const handleColClick = (col) => {
    socket.emit("player_move_c4", { col });
  };

  // Gestisce click su cella (per power-ups bomba) o colonna (extra)
  const handleCellClick = (row, col) => {
    if (selectingPowerUp === "bomba") {
      socket.emit("use_powerup_c4", { powerUpName: "bomba", row, col });
      setSelectingPowerUp(null);
    } else if (selectingPowerUp === "extra" && row === -1) {
      socket.emit("use_powerup_c4", { powerUpName: "extra", col });
      setSelectingPowerUp(null);
    }
  };

  const handlePowerUpClick = (name) => {
    if (selectingPowerUp === name) {
      setSelectingPowerUp(null); return;
    }
    if (name === "shuffle") {
      // Shuffle non richiede selezione — usa subito
      socket.emit("use_powerup_c4", { powerUpName: "shuffle" });
      return;
    }
    setSelectingPowerUp(name);
    const hints = {
      bomba: "💣 Clicca una pedina avversaria da rimuovere",
      extra: "➕ Clicca una colonna dove inserire la tua pedina extra",
    };
    showNotification(hints[name]);
  };

  const isMyTurn   = gameState.currentTurn === socket.id && gameState.status === "playing";
  const isFinished = gameState.status === "finished";
  const iWon       = isFinished && gameState.winner === socket.id;
  const isDraw     = isFinished && gameState.winner === "draw";
  const hasTimer   = gameState.timerSeconds > 0;
  const hasRandom  = gameState.randomChance > 0;
  const hasPowerUps = gameState.powerUpsEnabled;

  const myPowerUps  = hasPowerUps ? (gameState.powerUps?.[socket.id] || {}) : null;
  const oppPowerUps = hasPowerUps ? (gameState.powerUps?.[gameState.players.find(p => p.id !== socket.id)?.id] || {}) : null;

  // Label griglia
  const gridLabels = { "6x5": "6×5", "7x6": "7×6", "8x7": "8×7" };
  const gridLabel = gridLabels[gameState.gridSize] || "7×6";
  const winLen = gameState.winLen || 4;

  return (
    <div className="game-page">
      <div className="game-header">
        <button className="btn btn-ghost btn-sm" onClick={() => onLeave("home")}>✕ Abbandona</button>
        <h2 className="game-title">CONNECT 4</h2>
        <div className="my-symbol">
          <span className={`c4-symbol-badge ${mySymbol === "R" ? "c4-badge-r" : "c4-badge-y"}`}>
            {mySymbol === "R" ? "🔴" : "🟡"}
          </span>
        </div>
      </div>

      <ScoreDisplay gameState={gameState} roomCode={roomCode} />

      {isBot && <div className="bot-indicator">🤖 Stai giocando contro il Bot</div>}

      {/* Badge modalità */}
      {(hasTimer || hasRandom || hasPowerUps || gameState.gridSize !== "7x6") && (
        <div className="mode-badges">
          {gameState.gridSize && gameState.gridSize !== "7x6" && (
            <span className="mode-badge mode-badge-grid">{gridLabel} · {winLen} in fila</span>
          )}
          {hasTimer   && <span className="mode-badge">⏱ {gameState.timerSeconds}s</span>}
          {hasRandom  && <span className="mode-badge mode-badge-random">🎲 {gameState.randomChance === 0.2 ? "Leggero" : gameState.randomChance === 0.4 ? "Caotico" : "Anarchia"}</span>}
          {hasPowerUps && <span className="mode-badge mode-badge-powerup">⚡ Power-up</span>}
        </div>
      )}

      <div className="scoreboard">
        {gameState.players.map(p => (
          <div key={p.id} className={`score-player ${gameState.currentTurn === p.id && !isFinished ? "active-turn" : ""}`}>
            <span className={`c4-dot ${p.symbol === "R" ? "c4-dot-r" : "c4-dot-y"}`} />
            <span className="score-name">{p.id === socket.id ? "Tu" : p.name}</span>
            {oppPowerUps && p.id !== socket.id && (
              <span className="opp-abilities-left">
                {Object.values(gameState.powerUps[p.id] || {}).filter(v => v > 0).length}⚡
              </span>
            )}
          </div>
        ))}
      </div>

      <TimerBar timerSeconds={gameState.timerSeconds} turnStartedAt={gameState.turnStartedAt} currentTurn={gameState.currentTurn} myId={socket.id} />

      {notification && <div className="skipped-msg notification-msg">{notification}</div>}
      {skippedMsg   && <div className="skipped-msg">{skippedMsg}</div>}

      <div className={`status-banner ${isFinished ? (iWon ? "banner-win" : isDraw ? "banner-draw" : "banner-lose") : isMyTurn ? "banner-your-turn" : "banner-wait"}`}>
        {selectingPowerUp ? "Seleziona un bersaglio…" : message}
      </div>

      {/* Pannello power-up */}
      {myPowerUps && isMyTurn && !isFinished && (
        <div className="abilities-panel">
          <PowerUpButton icon="💣" label="Bomba" uses={myPowerUps.bomba ?? 1}
            onClick={() => handlePowerUpClick("bomba")}
            selecting={selectingPowerUp === "bomba"} disabled={!isMyTurn} />
          <PowerUpButton icon="➕" label="Extra" uses={myPowerUps.extra ?? 1}
            onClick={() => handlePowerUpClick("extra")}
            selecting={selectingPowerUp === "extra"} disabled={!isMyTurn} />
          <PowerUpButton icon="🔀" label="Shuffle" uses={myPowerUps.shuffle ?? 1}
            onClick={() => handlePowerUpClick("shuffle")}
            selecting={false} disabled={!isMyTurn} />
        </div>
      )}

      <Connect4Board
        board={gameState.board}
        winCells={gameState.winCells}
        onColClick={handleColClick}
        onCellClick={handleCellClick}
        disabled={!isMyTurn && !selectingPowerUp}
        deviationAnim={deviationAnim}
        mySymbol={mySymbol}
        selectingPowerUp={selectingPowerUp}
      />

      {isFinished && (
        <div className="game-over-actions">
          <button className="btn btn-primary" onClick={() => socket.emit("request_rematch")}>↺ Rivincita</button>
          <button className="btn btn-ghost"   onClick={() => onLeave("home")}>⌂ Home</button>
        </div>
      )}

      {!isBot && <ChatBox myId={socket.id} />}
    </div>
  );
}
