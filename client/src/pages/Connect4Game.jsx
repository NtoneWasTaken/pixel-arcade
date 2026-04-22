// ============================================================
// pages/Connect4Game.jsx — Schermata partita Connect 4
// ============================================================
import { useState, useEffect, useRef } from "react";
import socket from "../socket/socket";
import Connect4Board from "../components/Connect4Board";
import ChatBox from "../components/ChatBox";

// ── TimerBar (identica a Game.jsx) ───────────────────────────
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

// ── ScoreDisplay ─────────────────────────────────────────────
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

// ── Connect4Game ──────────────────────────────────────────────
export default function Connect4Game({ initialGameState, roomCode, isBot = false, onLeave }) {
  const [gameState,     setGameState]     = useState(initialGameState);
  const [message,       setMessage]       = useState("");
  const [skippedMsg,    setSkippedMsg]    = useState("");
  const [notification,  setNotification]  = useState("");
  const [deviationAnim, setDeviationAnim] = useState(null);

  const myPlayer = gameState.players.find(p => p.id === socket.id);
  const mySymbol = myPlayer?.symbol;

  useEffect(() => { updateMessage(initialGameState); }, []);

  useEffect(() => {
    const handleGameUpdate = ({ gameState: gs, deviated, intendedCol, actualCol, row }) => {
      setGameState(gs);
      updateMessage(gs);
      setSkippedMsg("");
      // Passa sempre deviationAnim con row/col per l'animazione caduta
      setDeviationAnim({ deviated, intendedCol, actualCol, row });
      setTimeout(() => setDeviationAnim(null), 600);
      if (deviated) showNotification("🎲 Mossa deviata!");
    };
    const handleGameStarted = ({ gameState: gs }) => {
      setGameState(gs); updateMessage(gs);
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
    socket.on("turn_skipped",  handleTurnSkipped);
    socket.on("game_aborted",  handleGameAborted);
    socket.on("rematch_ready", handleRematchReady);

    return () => {
      socket.off("game_update",   handleGameUpdate);
      socket.off("game_started",  handleGameStarted);
      socket.off("turn_skipped",  handleTurnSkipped);
      socket.off("game_aborted",  handleGameAborted);
      socket.off("rematch_ready", handleRematchReady);
    };
  }, [onLeave]);

  function updateMessage(gs) {
    if (gs.status === "finished") {
      if (gs.winner === "draw")      setMessage("Pareggio!");
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

  const isMyTurn   = gameState.currentTurn === socket.id && gameState.status === "playing";
  const isFinished = gameState.status === "finished";
  const iWon       = isFinished && gameState.winner === socket.id;
  const isDraw     = isFinished && gameState.winner === "draw";
  const hasTimer   = gameState.timerSeconds > 0;
  const hasRandom  = gameState.randomChance > 0;

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

      {(hasTimer || hasRandom) && (
        <div className="mode-badges">
          {hasTimer  && <span className="mode-badge">⏱ {gameState.timerSeconds}s</span>}
          {hasRandom && <span className="mode-badge mode-badge-random">🎲 {gameState.randomChance === 0.2 ? "Leggero" : gameState.randomChance === 0.4 ? "Caotico" : "Anarchia"}</span>}
        </div>
      )}

      {/* Scoreboard turno */}
      <div className="scoreboard">
        {gameState.players.map(p => (
          <div key={p.id} className={`score-player ${gameState.currentTurn === p.id && !isFinished ? "active-turn" : ""}`}>
            <span className={`c4-dot ${p.symbol === "R" ? "c4-dot-r" : "c4-dot-y"}`} />
            <span className="score-name">{p.id === socket.id ? "Tu" : p.name}</span>
          </div>
        ))}
      </div>

      <TimerBar timerSeconds={gameState.timerSeconds} turnStartedAt={gameState.turnStartedAt} currentTurn={gameState.currentTurn} myId={socket.id} />

      {notification && <div className="skipped-msg notification-msg">{notification}</div>}
      {skippedMsg   && <div className="skipped-msg">{skippedMsg}</div>}

      <div className={`status-banner ${isFinished ? (iWon ? "banner-win" : isDraw ? "banner-draw" : "banner-lose") : isMyTurn ? "banner-your-turn" : "banner-wait"}`}>
        {message}
      </div>

      <Connect4Board
        board={gameState.board}
        winCells={gameState.winCells}
        onColClick={handleColClick}
        disabled={!isMyTurn}
        deviationAnim={deviationAnim}
        mySymbol={mySymbol}
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
