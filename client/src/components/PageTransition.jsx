// ============================================================
// components/PageTransition.jsx — Dissolvenza tra schermate
// ============================================================
import { useState, useEffect, useRef } from "react";

export default function PageTransition({ children, screenKey }) {
  const [visible,  setVisible]  = useState(false);
  const [content,  setContent]  = useState(children);
  const prevKey = useRef(screenKey);

  useEffect(() => {
    if (screenKey !== prevKey.current) {
      // Fade out
      setVisible(false);
      const t = setTimeout(() => {
        setContent(children);
        prevKey.current = screenKey;
        // Fade in
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setVisible(true));
        });
      }, 150);
      return () => clearTimeout(t);
    } else {
      setVisible(true);
    }
  }, [screenKey, children]);

  return (
    <div className={`page-transition ${visible ? "page-visible" : "page-hidden"}`}>
      {content}
    </div>
  );
}
