// ============================================================
// components/TimerBar.jsx — Barra timer animata verde→giallo→rosso
// ============================================================
import { useEffect, useState, useRef } from "react";

export default function TimerBar({ timerSeconds, turnStartedAt, currentTurn, myId }) {
  const [progress, setProgress] = useState(100); // 100% = pieno, 0% = scaduto
  const [phase, setPhase] = useState("green");   // green | yellow | red
  const rafRef = useRef(null);

  useEffect(() => {
    // Se non c'è timer attivo, non mostrare nulla
    if (!timerSeconds || timerSeconds === 0 || !turnStartedAt) {
      setProgress(100);
      setPhase("green");
      return;
    }

    const totalMs = timerSeconds * 1000;

    const tick = () => {
      const elapsed = Date.now() - turnStartedAt;
      const remaining = Math.max(0, totalMs - elapsed);
      const pct = (remaining / totalMs) * 100;

      setProgress(pct);

      // Cambia colore in base al tempo rimanente
      if (remaining > totalMs * 0.5) {
        setPhase("green");
      } else if (remaining > totalMs * 0.25) {
        setPhase("yellow");
      } else {
        setPhase("red");
      }

      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [timerSeconds, turnStartedAt]);

  // Non mostrare la barra se il timer è disattivato
  if (!timerSeconds || timerSeconds === 0) return null;

  const isMyTurn = currentTurn === myId;

  return (
    <div className="timer-bar-wrapper">
      <div className="timer-bar-labels">
        <span className="timer-bar-who">
          {isMyTurn ? "⚡ Il tuo turno" : "⏳ Turno avversario"}
        </span>
        <span className={`timer-bar-seconds timer-${phase}`}>
          {Math.ceil((progress / 100) * timerSeconds)}s
        </span>
      </div>
      <div className="timer-bar-track">
        <div
          className={`timer-bar-fill timer-fill-${phase} ${phase === "red" ? "timer-pulse" : ""}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}