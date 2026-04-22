// ============================================================
// pages/GameSelect.jsx — Selezione gioco
// ============================================================

export default function GameSelect({ playerName, onSelectGame }) {
  return (
    <div className="game-select-page">
      <div className="game-select-hero">
        <h1 className="hero-title">
          <span className="title-accent">PIXEL</span>
          <span className="title-main">ARCADE</span>
        </h1>
        <p className="game-select-welcome">Ciao, <span className="player-name-accent">{playerName}</span>! Scegli un gioco.</p>
      </div>

      <div className="game-select-grid">

        {/* Tic Tac Toe */}
        <button className="game-card game-card-ttt" onClick={() => onSelectGame("ttt")}>
          <div className="game-card-preview">
            <div className="ttt-preview-grid">
              <span className="ttt-pre x">✕</span>
              <span className="ttt-pre o">◯</span>
              <span className="ttt-pre x">✕</span>
              <span className="ttt-pre empty" />
              <span className="ttt-pre o">◯</span>
              <span className="ttt-pre empty" />
              <span className="ttt-pre empty" />
              <span className="ttt-pre x">✕</span>
              <span className="ttt-pre o">◯</span>
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
            </div>
          </div>
          <div className="game-card-cta">GIOCA →</div>
        </button>

        {/* Connect 4 */}
        <button className="game-card game-card-c4" onClick={() => onSelectGame("c4")}>
          <div className="game-card-preview">
            <div className="c4-preview-grid">
              {[
                null, null, null, null, null, null, null,
                null, null, null, null, null, null, null,
                null, null, null, "r",  null, null, null,
                null, null, "r",  "y",  null, null, null,
                null, "r",  "y",  "y",  "r",  null, null,
                "y",  "r",  "y",  "r",  "y",  "r",  null,
              ].map((cell, i) => (
                <span key={i} className={`c4-pre ${cell === "r" ? "c4-pre-r" : cell === "y" ? "c4-pre-y" : "c4-pre-empty"}`} />
              ))}
            </div>
          </div>
          <div className="game-card-info">
            <h2 className="game-card-title">CONNECT 4</h2>
            <p className="game-card-desc">Allinea 4 pedine con modalità Blitz, Random e Bot</p>
            <div className="game-card-tags">
              <span className="game-tag">⏱ Blitz</span>
              <span className="game-tag">🎲 Random</span>
              <span className="game-tag">🤖 Bot</span>
            </div>
          </div>
          <div className="game-card-cta">GIOCA →</div>
        </button>

      </div>
    </div>
  );
}
