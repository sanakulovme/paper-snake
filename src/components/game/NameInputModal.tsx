import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NameInputModalProps {
  onStart: (name: string) => void;
}

export const NameInputModal = ({ onStart }: NameInputModalProps) => {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onStart(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      {/* Animated background grid */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--primary) / 0.1) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--primary) / 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 animate-fade-in">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-display font-black text-glow tracking-wider text-primary mb-2">
            PAPER
          </h1>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground tracking-widest">
            SNAKE
          </h2>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Enter your name
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player"
              maxLength={15}
              autoFocus
              className="text-center text-xl"
            />
          </div>

          <Button
            type="submit"
            variant="game"
            size="xl"
            className="w-full"
            disabled={!name.trim()}
          >
            Start Game
          </Button>
        </form>

        {/* Instructions */}
        <div className="mt-8 text-center text-sm text-muted-foreground space-y-1">
          <p>Use <span className="text-primary font-semibold">Arrow Keys</span> to move</p>
          <p>Capture territory by closing your trail</p>
          <p>Don't hit the edges!</p>
        </div>
      </div>
    </div>
  );
};
