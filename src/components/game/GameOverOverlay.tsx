import { Button } from "@/components/ui/button";

interface GameOverOverlayProps {
  score: number;
  onRestart: () => void;
}

export const GameOverOverlay = ({ score, onRestart }: GameOverOverlayProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm animate-fade-in">
      <div className="text-center space-y-6 px-6">
        <h2 className="text-5xl md:text-6xl font-display font-black text-destructive tracking-wider">
          GAME OVER
        </h2>
        
        <div className="space-y-2">
          <p className="text-lg text-muted-foreground uppercase tracking-wider">
            Territory Captured
          </p>
          <p className="text-4xl font-display font-bold text-primary text-glow">
            {score.toFixed(1)}%
          </p>
        </div>

        <Button
          onClick={onRestart}
          variant="game"
          size="xl"
          className="mt-4"
        >
          Play Again
        </Button>
      </div>
    </div>
  );
};
