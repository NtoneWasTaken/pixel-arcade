// ============================================================
// App.jsx — Router principale (state machine: home → lobby → game)
// ============================================================
import { useState, useCallback } from "react";
import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import "./styles/main.css";

// Schermate possibili
const SCREEN = {
  HOME: "home",
  LOBBY: "lobby",
  GAME: "game",
};

export default function App() {
  const [screen, setScreen] = useState(SCREEN.HOME);
  const [roomCode, setRoomCode] = useState(null);
  const [player, setPlayer]   = useState(null);
  const [room, setRoom]       = useState(null);
  const [gameState, setGameState] = useState(null);

  // Home → Lobby
  const handleRoomJoined = useCallback(({ roomCode: code, player: p, isHost, room: r }) => {
    setRoomCode(code);
    setPlayer({ ...p, isHost });
    setRoom(r || { code, players: [p] });
    setScreen(SCREEN.LOBBY);
  }, []);

  // Lobby → Game
  const handleGameStart = useCallback((gs) => {
    setGameState(gs);
    setScreen(SCREEN.GAME);
  }, []);

  // Qualsiasi schermata → Home o Lobby
  const handleLeave = useCallback((dest = "home", newRoom = null) => {
    if (dest === "lobby" && newRoom) {
      setRoom(newRoom);
      setGameState(null);
      setScreen(SCREEN.LOBBY);
    } else {
      setRoomCode(null);
      setPlayer(null);
      setRoom(null);
      setGameState(null);
      setScreen(SCREEN.HOME);
    }
  }, []);

  return (
    <div className="app-wrapper">
      <div className="scanlines" aria-hidden="true" />

      {screen === SCREEN.HOME && (
        <Home onRoomJoined={handleRoomJoined} />
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
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}
