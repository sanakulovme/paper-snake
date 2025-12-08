import { useState, useCallback } from "react";
import { NameInputModal } from "@/components/game/NameInputModal";
import { PaperSnakeGame } from "@/components/game/PaperSnakeGame";
import { GameOverOverlay } from "@/components/game/GameOverOverlay";

type GamePhase = "name" | "playing" | "gameover";

const Index = () => {
  const [phase, setPhase] = useState<GamePhase>("name");
  const [playerName, setPlayerName] = useState("");
  const [finalScore, setFinalScore] = useState(0);
  const [gameKey, setGameKey] = useState(0);

  const handleStart = useCallback((name: string) => {
    setPlayerName(name);
    setPhase("playing");
  }, []);

  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
    setPhase("gameover");
  }, []);

  const handleRestart = useCallback(() => {
    setGameKey((k) => k + 1);
    setPhase("playing");
  }, []);

  return (
    <main className="relative h-full w-full overflow-hidden bg-background">
      {/* Game canvas is always rendered for smooth transitions */}
      {phase !== "name" && (
        <PaperSnakeGame
          key={gameKey}
          playerName={playerName}
          onGameOver={handleGameOver}
        />
      )}

      {/* Overlays */}
      {phase === "name" && <NameInputModal onStart={handleStart} />}
      {phase === "gameover" && (
        <GameOverOverlay score={finalScore} onRestart={handleRestart} />
      )}
    </main>
  );
};

export default Index;
