// ============================================================
// pages/BattleshipGame.jsx — Schermata partita Battleship
// ============================================================
import { useState, useEffect, useRef } from "react";
import socket from "../socket/socket";
import BattleshipBoard from "../components/BattleshipBoard";
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

export default function BattleshipGame({ initialGameState, roomCode, isBot = false, onLeave }) {
  const [gameState,        setGameState]        = useState(initialGameState);
  const [message,          setMessage]          = useState("");
  const [notification,     setNotification]     = useState("");
  const [skippedMsg,       setSkippedMsg]       = useState("");
  const [lastHit,          setLastHit]          = useState(null);
  const [selectingPowerUp, setSelectingPowerUp] = useState(null);
  // Stato per bomba 2x2 — prima selezione
  const [bombTarget,       setBombTarget]       = useState(null);

  const myId  = socket.id;
  const oppId = gameState.players.find(p => p.id !== myId)?.id;

  const myBoard  = gameState.boards?.[myId];
  const oppBoard = gameState.boards?.[oppId];

  useEffect(() => { updateMessage(initialGameState); }, []);

  useEffect(() => {
    const handleAttackResult = ({ row, col, hit, sunk, shipId, gameState: gs }) => {
      setGameState(gs);
      updateMessage(gs);
      if (hit) {
        setLastHit({ row, col });
        setTimeout(() => setLastHit(null), 1000);
        showNotification(sunk ? `🚢 Nave affondata!` : `💥 Colpito!`);
      } else {
        showNotification("💧 Acqua!");
      }
    };

    const handlePowerUpUsed = ({ powerUpName, results, hasShip, gameState: gs }) => {
      setGameState(gs);
      updateMessage(gs);
      setSelectingPowerUp(null);
      setBombTarget(null);
      const names = { bomba2x2: "💥 Bomba 2×2", radar: "📡 Radar", siluro: "🎯 Siluro" };
      if (powerUpName === "radar") {
        showNotification(hasShip ? "📡 Radar: c'è una nave in quest'area!" : "📡 Radar: area libera!");
      } else {
        const hits = (results || []).filter(r => r.hit).length;
        showNotification(`${names[powerUpName]} — ${hits} colpi a segno!`);
      }
    };

    const handleTurnSkipped = ({ skippedPlayerId, gameState: gs }) => {
      setGameState(gs); updateMessage(gs);
      setSkippedMsg(skippedPlayerId === myId ? "Hai esaurito il tempo! Turno saltato." : "L'avversario ha esaurito il tempo! Tocca a te.");
      setTimeout(() => setSkippedMsg(""), 2500);
    };

    const handleGameAborted  = ({ message: msg }) => setMessage(msg);
    const handleRematchReady = ({ room }) => onLeave("lobby", room);
    const handleGameStarted  = ({ gameState: gs }) => { setGameState(gs); updateMessage(gs); };

    socket.on("attack_result",  handleAttackResult);
    socket.on("powerup_used_bs", handlePowerUpUsed);
    socket.on("turn_skipped",   handleTurnSkipped);
    socket.on("game_aborted",   handleGameAborted);
    socket.on("rematch_ready",  handleRematchReady);
    socket.on("game_started",   handleGameStarted);

    return () => {
      socket.off("attack_result",  handleAttackResult);
      socket.off("powerup_used_bs", handlePowerUpUsed);
      socket.off("turn_skipped",   handleTurnSkipped);
      socket.off("game_aborted",   handleGameAborted);
      socket.off("rematch_ready",  handleRematchReady);
      socket.off("game_started",   handleGameStarted);
    };
  }, [onLeave, myId]);

  function updateMessage(gs) {
    if (gs.phase === "finished") {
      if (gs.winner === myId) setMessage("🎉 Hai vinto! Flotta avversaria affondata!");
      else setMessage(isBot ? "🤖 Il bot ha vinto!" : "Hai perso. La tua flotta è affondata!");
      return;
    }
    if (gs.currentTurn === myId) setMessage("È il tuo turno! Spara!");
    else setMessage(isBot ? "🤖 Il bot sta attaccando…" : `Turno di ${gs.players.find(p => p.id !== myId)?.name}…`);
  }

  function showNotification(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(""), 2500);
  }

  const handleCellClick = (row, col) => {
    if (selectingPowerUp === "bomba2x2") {
      socket.emit("use_powerup_bs", { powerUpName: "bomba2x2", row, col });
      setSelectingPowerUp(null);
      setBombTarget(null);
      return;
    }
    socket.emit("attack_bs", { row, col });
  };

  const handlePowerUpClick = (name) => {
    if (selectingPowerUp === name) { setSelectingPowerUp(null); return; }
    if (name === "radar") {
      setSelectingPowerUp("radar");
      showNotification("📡 Clicca una cella per rivelare l'area 3×3");
    } else if (name === "bomba2x2") {
      setSelectingPowerUp("bomba2x2");
      showNotification("💥 Clicca la cella in alto a sinistra dell'area 2×2");
    } else if (name === "siluro") {
      setSelectingPowerUp("siluro");
      showNotification("🎯 Clicca un numero di riga o lettera di colonna per il siluro");
    }
  };

  const handleRadarClick = (row, col) => {
    if (selectingPowerUp !== "radar") return;
    socket.emit("use_powerup_bs", { powerUpName: "radar", row, col });
    setSelectingPowerUp(null);
  };

  const handleRowColSelect = (isRow, index) => {
    if (selectingPowerUp !== "siluro") return;
    socket.emit("use_powerup_bs", { powerUpName: "siluro", isRow, index });
    setSelectingPowerUp(null);
  };

  const handleBoardClick = (row, col) => {
    if (selectingPowerUp === "radar") { handleRadarClick(row, col); return; }
    handleCellClick(row, col);
  };

  const isMyTurn   = gameState.currentTurn === myId && gameState.phase === "playing";
  const isFinished = gameState.phase === "finished";
  const iWon       = isFinished && gameState.winner === myId;
  const hasPowerUps = gameState.powerUpsEnabled;
  const myPowerUps  = hasPowerUps ? (gameState.powerUps?.[myId] || {}) : null;
  const oppPowerUps = hasPowerUps ? (gameState.powerUps?.[oppId] || {}) : null;
  const hasTimer    = gameState.timerSeconds > 0;

  // Contatore navi affondate
  const myShipsSunk  = myBoard?.ships?.filter(s => s.sunk).length  || 0;
  const myShipsTotal = myBoard?.ships?.length || 0;
  const oppShipsSunk = oppBoard?.ships?.filter(s => s.sunk).length || 0;
  const oppShipsTotal = gameState.shipConfig?.length || 0;

  const gridLabels = { "8x8": "8×8", "10x10": "10×10", "12x12": "12×12" };

  return (
    <div className="game-page">
      <div className="game-header">
        <button className="btn btn-ghost btn-sm" onClick={() => onLeave("home")}>✕ Abbandona</button>
        <h2 className="game-title">BATTLESHIP</h2>
        <div className="my-symbol">
          <span className="bs-symbol">🚢</span>
        </div>
      </div>

      <ScoreDisplay gameState={gameState} roomCode={roomCode} />
      {isBot && <div className="bot-indicator">🤖 Stai giocando contro il Bot</div>}

      {/* Badge modalità */}
      {(hasTimer || hasPowerUps || gameState.fogOfWarEnabled || gameState.gridSize !== "10x10") && (
        <div className="mode-badges">
          {gameState.gridSize && gameState.gridSize !== "10x10" && (
            <span className="mode-badge mode-badge-grid">{gridLabels[gameState.gridSize]}</span>
          )}
          {hasTimer        && <span className="mode-badge">⏱ {gameState.timerSeconds}s</span>}
          {hasPowerUps     && <span className="mode-badge mode-badge-powerup">⚡ Power-up</span>}
          {gameState.fogOfWarEnabled && <span className="mode-badge mode-badge-fog">🌫️ Nebbia</span>}
        </div>
      )}

      {/* Navi status */}
      <div className="bs-fleet-status">
        <div className="bs-fleet-mine">
          <span className="bs-fleet-label">La tua flotta</span>
          <span className="bs-fleet-count">{myShipsTotal - myShipsSunk}/{myShipsTotal} 🚢</span>
        </div>
        <div className="bs-fleet-opp">
          <span className="bs-fleet-label">Flotta avversaria</span>
          <span className="bs-fleet-count">{oppShipsTotal - oppShipsSunk}/{oppShipsTotal} 🚢</span>
        </div>
      </div>

      <TimerBar timerSeconds={gameState.timerSeconds} turnStartedAt={gameState.turnStartedAt} currentTurn={gameState.currentTurn} myId={myId} />

      {notification && <div className="skipped-msg notification-msg">{notification}</div>}
      {skippedMsg   && <div className="skipped-msg">{skippedMsg}</div>}

      <div className={`status-banner ${isFinished ? (iWon ? "banner-win" : "banner-lose") : isMyTurn ? "banner-your-turn" : "banner-wait"}`}>
        {selectingPowerUp ? "Seleziona il bersaglio…" : message}
      </div>

      {/* Power-up panel */}
      {myPowerUps && isMyTurn && !isFinished && (
        <div className="abilities-panel">
          <PowerUpButton icon="💥" label="Bomba 2×2" uses={myPowerUps.bomba2x2 ?? 1}
            onClick={() => handlePowerUpClick("bomba2x2")}
            selecting={selectingPowerUp === "bomba2x2"} disabled={!isMyTurn} />
          <PowerUpButton icon="📡" label="Radar" uses={myPowerUps.radar ?? 1}
            onClick={() => handlePowerUpClick("radar")}
            selecting={selectingPowerUp === "radar"} disabled={!isMyTurn} />
          <PowerUpButton icon="🎯" label="Siluro" uses={myPowerUps.siluro ?? 1}
            onClick={() => handlePowerUpClick("siluro")}
            selecting={selectingPowerUp === "siluro"} disabled={!isMyTurn} />
        </div>
      )}

      {/* Le due griglie */}
      <div className="bs-boards-container">
        <div className="bs-board-section">
          <h3 className="bs-board-title">La tua griglia</h3>
          <BattleshipBoard
            board={myBoard}
            size={gameState.size}
            isMyBoard={true}
            disabled={true}
            lastHit={null}
          />
        </div>

        <div className="bs-board-section">
          <h3 className="bs-board-title">
            {isMyTurn ? "⚡ Attacca!" : "Griglia avversaria"}
          </h3>
          <BattleshipBoard
            board={oppBoard}
            size={gameState.size}
            isMyBoard={false}
            onCellClick={handleBoardClick}
            disabled={!isMyTurn || !!selectingPowerUp}
            lastHit={lastHit}
            selectingPowerUp={selectingPowerUp}
            onRowColSelect={handleRowColSelect}
          />
        </div>
      </div>

      {isFinished && (
        <div className="game-over-actions">
          <button className="btn btn-primary" onClick={() => socket.emit("request_rematch")}>↺ Rivincita</button>
          <button className="btn btn-ghost"   onClick={() => onLeave("home")}>⌂ Home</button>
        </div>
      )}

      {!isBot && <ChatBox myId={myId} />}
    </div>
  );
}
