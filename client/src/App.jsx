// ============================================================
// App.jsx — Router principale con selezione gioco
// ============================================================
import { useState, useCallback } from "react";
import Home       from "./pages/Home";
import GameSelect from "./pages/GameSelect";
import Lobby      from "./pages/Lobby";
import Game       from "./pages/Game";
import "./styles/main.css";

const SCREEN = {
  HOME:         "home",
  GAME_SELECT:  "game_select",
  GAME_ACTIONS: "game_actions",
  LOBBY:        "lobby",
  GAME:         "game",
};

export default function App() {
  const [screen,       setScreen]       = useState(SCREEN.HOME);
  const [playerName,   setPlayerName]   = useState("");
  const [selectedGame, setSelectedGame] = useState(null); // "ttt" | "c4"
  const [roomCode,     setRoomCode]     = useState(null);
  const [player,       setPlayer]       = useState(null);
  const [room,         setRoom]         = useState(null);
  const [gameState,    setGameState]    = useState(null);
  const [isBot,        setIsBot]        = useState(false);

  // Home → GameSelect
  const handleNameConfirmed = useCallback((name) => {
    setPlayerName(name);
    setScreen(SCREEN.GAME_SELECT);
  }, []);

  // GameSelect → GameActions
  const handleSelectGame = useCallback((game) => {
    setSelectedGame(game);
    setScreen(SCREEN.GAME_ACTIONS);
  }, []);

  // GameActions → Lobby (multiplayer)
  const handleRoomJoined = useCallback(({ roomCode: code, player: p, isHost, room: r }) => {
    setRoomCode(code);
    setPlayer({ ...p, isHost });
    setRoom(r || { code, players: [p] });
    setIsBot(false);
    setScreen(SCREEN.LOBBY);
  }, []);

  // GameActions → Game (bot)
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

  // Navigazione indietro / abbandono
  const handleLeave = useCallback((dest = "home", newRoom = null) => {
    if (dest === "lobby" && newRoom) {
      setRoom(newRoom);
      setGameState(null);
      setIsBot(false);
      setScreen(SCREEN.LOBBY);
    } else if (dest === "game_select") {
      setRoomCode(null);
      setPlayer(null);
      setRoom(null);
      setGameState(null);
      setIsBot(false);
      setScreen(SCREEN.GAME_SELECT);
    } else {
      // home completo reset
      setRoomCode(null);
      setPlayer(null);
      setRoom(null);
      setGameState(null);
      setIsBot(false);
      setSelectedGame(null);
      setPlayerName("");
      setScreen(SCREEN.HOME);
    }
  }, []);

  return (
    <div className="app-wrapper">
      <div className="scanlines" aria-hidden="true" />

      {/* 1. Inserisci nome */}
      {screen === SCREEN.HOME && (
        <Home onNameConfirmed={handleNameConfirmed} />
      )}

      {/* 2. Scegli il gioco */}
      {screen === SCREEN.GAME_SELECT && (
        <GameSelect
          playerName={playerName}
          onSelectGame={handleSelectGame}
          onBack={() => handleLeave("home")}
        />
      )}

      {/* 3. Crea stanza / entra / bot (Home riutilizzata con playerName già noto) */}
      {screen === SCREEN.GAME_ACTIONS && (
        <Home
          playerName={playerName}
          selectedGame={selectedGame}
          onRoomJoined={handleRoomJoined}
          onBotGame={handleBotGame}
          onBack={() => setScreen(SCREEN.GAME_SELECT)}
        />
      )}

      {/* 4. Lobby */}
      {screen === SCREEN.LOBBY && (
        <Lobby
          roomCode={roomCode}
          player={player}
          initialRoom={room}
          onGameStart={handleGameStart}
          onLeave={() => setScreen(SCREEN.GAME_ACTIONS)}
        />
      )}

      {/* 5. Partita */}
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
