// ============================================================
// App.jsx — Router con Tris + Connect 4
// ============================================================
import { useState, useCallback } from "react";
import Home         from "./pages/Home";
import Lobby        from "./pages/Lobby";
import Game         from "./pages/Game";
import Connect4Game from "./pages/Connect4Game";
import "./styles/main.css";

const SCREEN = {
  HOME:  "home",
  LOBBY: "lobby",
  GAME:  "game",
};

export default function App() {
  const [screen,       setScreen]       = useState(SCREEN.HOME);
  const [roomCode,     setRoomCode]     = useState(null);
  const [player,       setPlayer]       = useState(null);
  const [room,         setRoom]         = useState(null);
  const [gameState,    setGameState]    = useState(null);
  const [gameType,     setGameType]     = useState(null); // "ttt" | "c4"
  const [selectedGame, setSelectedGame] = useState(null);
  const [isBot,        setIsBot]        = useState(false);

  const handleRoomJoined = useCallback(({ roomCode: code, player: p, isHost, room: r, game }) => {
    setRoomCode(code);
    setPlayer({ ...p, isHost });
    setRoom(r || { code, players: [p] });
    setSelectedGame(game);
    setIsBot(false);
    setScreen(SCREEN.LOBBY);
  }, []);

  const handleBotGame = useCallback(({ gameState: gs, gameType: gt }) => {
    setGameState(gs);
    setGameType(gt);
    setIsBot(true);
    setScreen(SCREEN.GAME);
  }, []);

  const handleGameStart = useCallback((gs, gt) => {
    setGameState(gs);
    setGameType(gt || "ttt");
    setIsBot(false);
    setScreen(SCREEN.GAME);
  }, []);

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
      setGameType(null);
      setSelectedGame(null);
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
          selectedGame={selectedGame}
          onGameStart={handleGameStart}
          onLeave={() => handleLeave("home")}
        />
      )}

      {screen === SCREEN.GAME && gameState && gameType === "ttt" && (
        <Game
          initialGameState={gameState}
          player={player}
          roomCode={roomCode}
          isBot={isBot}
          onLeave={handleLeave}
        />
      )}

      {screen === SCREEN.GAME && gameState && gameType === "c4" && (
        <Connect4Game
          initialGameState={gameState}
          roomCode={roomCode}
          isBot={isBot}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}
