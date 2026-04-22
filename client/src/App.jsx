// ============================================================
// App.jsx — Router principale
// ============================================================
import { useState, useCallback } from "react";
import Home  from "./pages/Home";
import Lobby from "./pages/Lobby";
import Game  from "./pages/Game";
import "./styles/main.css";

const SCREEN = {
  HOME:  "home",
  LOBBY: "lobby",
  GAME:  "game",
};

export default function App() {
  const [screen,    setScreen]    = useState(SCREEN.HOME);
  const [roomCode,  setRoomCode]  = useState(null);
  const [player,    setPlayer]    = useState(null);
  const [room,      setRoom]      = useState(null);
  const [gameState, setGameState] = useState(null);
  const [isBot,     setIsBot]     = useState(false);

  // Home → Lobby (multiplayer)
  const handleRoomJoined = useCallback(({ roomCode: code, player: p, isHost, room: r }) => {
    setRoomCode(code);
    setPlayer({ ...p, isHost });
    setRoom(r || { code, players: [p] });
    setIsBot(false);
    setScreen(SCREEN.LOBBY);
  }, []);

  // Home → Game (bot)
  const handleBotGame = useCallback(({ gameState: gs }) => {
    setGameState(gs);
    setIsBot(true);
    setScreen(SCREEN.GAME);
  }, []);

  // Lobby → Game
  const handleGameStart = useCallback((gs) => {
    setGameState(gs);
    setIsBot(false);
    setScreen(SCREEN.GAME);
  }, []);

  // Torna indietro
  const handleLeave = useCallback((dest = "home", newRoom = null) => {
    if (dest === "lobby" && newRoom) {
      setRoom(newRoom);
      setGameState(null);
      setIsBot(false);
      setScreen(SCREEN.LOBBY);
    } else {
      setRoomCode(null);
      setPlayer(null);
      setRoom(null);
      setGameState(null);
      setIsBot(false);
      setScreen(SCREEN.HOME);
    }
  }, []);

  return (
    <div className="app-wrapper">
      <div className="scanlines" aria-hidden="true" />

      {screen === SCREEN.HOME && (
        <Home onRoomJoined={handleRoomJoined} onBotGame={handleBotGame} />
      )}

      {screen === SCREEN.LOBBY && (
        <Lobby
          roomCode={roomCode}
          player={player}
          initialRoom={room}
          onGameStart={handleGameStart}
          onLeave={() => handleLeave("home")}
        />
      )}

      {screen === SCREEN.GAME && gameState && (
        <Game
          initialGameState={gameState}
          player={player}
          roomCode={roomCode}
          isBot={isBot}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}
