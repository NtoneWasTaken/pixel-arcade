// ============================================================
// App.jsx — Router completo con polish (loading, transizioni, toast)
// ============================================================
import { useState, useCallback, useEffect } from "react";
import socket          from "./socket/socket";
import Home            from "./pages/Home";
import Lobby           from "./pages/Lobby";
import Game            from "./pages/Game";
import Connect4Game    from "./pages/Connect4Game";
import ShipPlacement   from "./pages/ShipPlacement";
import BattleshipGame  from "./pages/BattleshipGame";
import LoadingScreen   from "./components/LoadingScreen";
import PageTransition  from "./components/PageTransition";
import { ToastProvider } from "./components/Toast";
import "./styles/main.css";

const SCREEN = {
  HOME:      "home",
  LOBBY:     "lobby",
  PLACEMENT: "placement",
  GAME:      "game",
};

// Titoli dinamici per ogni schermata
const TITLES = {
  home:      "Pixel Arcade — Multiplayer",
  lobby:     "Lobby — Pixel Arcade",
  placement: "Posiziona le navi — Pixel Arcade",
  game:      "In partita — Pixel Arcade",
};

export default function App() {
  const [screen,          setScreen]          = useState(SCREEN.HOME);
  const [roomCode,        setRoomCode]        = useState(null);
  const [player,          setPlayer]          = useState(null);
  const [room,            setRoom]            = useState(null);
  const [gameState,       setGameState]       = useState(null);
  const [gameType,        setGameType]        = useState(null);
  const [selectedGame,    setSelectedGame]    = useState(null);
  const [isBot,           setIsBot]           = useState(false);
  const [bsPlacementData, setBsPlacementData] = useState(null);

  // Loading screen — cold start
  const [serverReady,     setServerReady]     = useState(false);
  const [connecting,      setConnecting]      = useState(true);

  // ── Connessione socket con cold start detection ────────────
  useEffect(() => {
    socket.connect();

    const onConnect = () => {
      setServerReady(true);
      setConnecting(false);
    };

    const onConnectError = () => {
      // Continua a mostrare il loading, socket riproverà automaticamente
      setConnecting(true);
    };

    socket.on("connect",       onConnect);
    socket.on("connect_error", onConnectError);

    // Timeout massimo 90s — se non si connette mostra errore
    const timeout = setTimeout(() => {
      if (!socket.connected) {
        setConnecting(false);
        setServerReady(false);
      }
    }, 90000);

    return () => {
      socket.off("connect",       onConnect);
      socket.off("connect_error", onConnectError);
      clearTimeout(timeout);
    };
  }, []);

  // ── Titolo dinamico ────────────────────────────────────────
  useEffect(() => {
    document.title = TITLES[screen] || TITLES.home;
  }, [screen]);

  // ── Handlers ──────────────────────────────────────────────

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
    if (gt === "bs") {
      setBsPlacementData({ shipConfig: gs.shipConfig || [], gridSize: gs.gridSize });
      setScreen(SCREEN.PLACEMENT);
    } else {
      setScreen(SCREEN.GAME);
    }
  }, []);

  const handleGameStart = useCallback((gs, gt) => {
    setGameState(gs);
    setGameType(gt || "ttt");
    setIsBot(false);
    if (gt === "bs") {
      setBsPlacementData({ shipConfig: gs.shipConfig || [], gridSize: gs.gridSize });
      setScreen(SCREEN.PLACEMENT);
    } else {
      setScreen(SCREEN.GAME);
    }
  }, []);

  const handleShipsConfirmed = useCallback((ships) => {
    socket.emit("place_ships_bs", { ships });

    const handleBattleStart = ({ gameState: gs }) => {
      setGameState(gs);
      setScreen(SCREEN.GAME);
      socket.off("battle_start", handleBattleStart);
    };
    socket.on("battle_start", handleBattleStart);
  }, []);

  const handleLeave = useCallback((dest = "home", newRoom = null) => {
    if (dest === "lobby" && newRoom) {
      setRoom(newRoom);
      setGameState(null);
      setIsBot(false);
      setBsPlacementData(null);
      setScreen(SCREEN.LOBBY);
    } else {
      setRoomCode(null);
      setPlayer(null);
      setRoom(null);
      setGameState(null);
      setGameType(null);
      setSelectedGame(null);
      setIsBot(false);
      setBsPlacementData(null);
      setScreen(SCREEN.HOME);
    }
  }, []);

  // ── Loading screen cold start ──────────────────────────────
  if (!serverReady) {
    return (
      <div className="app-wrapper">
        <div className="scanlines" aria-hidden="true" />
        <LoadingScreen />
      </div>
    );
  }

  // ── App principale ─────────────────────────────────────────
  return (
    <ToastProvider>
      <div className="app-wrapper">
        <div className="scanlines" aria-hidden="true" />

        <PageTransition screenKey={screen}>
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

          {screen === SCREEN.PLACEMENT && gameState && bsPlacementData && (
            <ShipPlacement
              gameState={gameState}
              shipConfig={bsPlacementData.shipConfig}
              gridSize={bsPlacementData.gridSize}
              onConfirm={handleShipsConfirmed}
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

          {screen === SCREEN.GAME && gameState && gameType === "bs" && (
            <BattleshipGame
              initialGameState={gameState}
              roomCode={roomCode}
              isBot={isBot}
              onLeave={handleLeave}
            />
          )}
        </PageTransition>
      </div>
    </ToastProvider>
  );
}
