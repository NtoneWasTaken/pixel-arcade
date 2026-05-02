// ============================================================
// components/LoadingScreen.jsx — Cold start Render
// ============================================================
import { useState, useEffect } from "react";

export default function LoadingScreen({ onReady }) {
  const [dots,     setDots]     = useState(".");
  const [seconds,  setSeconds]  = useState(0);
  const [progress, setProgress] = useState(0);
  const MAX_WAIT = 60; // secondi massimi attesa

  useEffect(() => {
    // Dots animati
    const dotsInterval = setInterval(() => {
      setDots(d => d.length >= 3 ? "." : d + ".");
    }, 500);

    // Contatore secondi e progress bar
    const secInterval = setInterval(() => {
      setSeconds(s => {
        const next = s + 1;
        setProgress(Math.min(95, (next / MAX_WAIT) * 100));
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(dotsInterval);
      clearInterval(secInterval);
    };
  }, []);

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <span className="loading-pixel">🕹️</span>
        </div>
        <h1 className="loading-title">
          <span className="title-accent">PIXEL</span>
          <span className="title-main">ARCADE</span>
        </h1>
        <p className="loading-msg">Avvio del server in corso{dots}</p>

        <div className="loading-bar-track">
          <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>

        <p className="loading-sub">
          {seconds < 5
            ? "Connessione al server…"
            : seconds < 20
            ? "Il server si sta svegliando (piano gratuito)"
            : seconds < 45
            ? "Ci vuole ancora un momento…"
            : "Quasi pronto!"}
        </p>

        {seconds > 30 && (
          <p className="loading-hint">
            Suggerimento: il server va in sleep dopo 15 minuti di inattività.<br />
            Il primo avvio può richiedere fino a 60 secondi.
          </p>
        )}
      </div>
    </div>
  );
}
