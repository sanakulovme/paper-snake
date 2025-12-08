import { useEffect, useRef, useState, useCallback } from "react";
import * as martinez from "martinez-polygon-clipping";

// === TYPES ===
type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Point = [number, number];
type Polygon = Point[][];
type MultiPolygon = Polygon[];

interface GameState {
  // Snake position (grid coordinates)
  x: number;
  y: number;
  // Current movement direction
  direction: Direction;
  // Queued direction (for smooth input)
  nextDirection: Direction;
  // Trail points when outside territory
  trail: Point[];
  // All claimed territories as polygons
  territories: MultiPolygon;
  // Is snake currently outside its territory?
  isOutside: boolean;
  // Game status
  isGameOver: boolean;
}

// === CONSTANTS ===
const CELL_SIZE = 10;
const SNAKE_SPEED = 100; // ms per grid move
const INITIAL_TERRITORY_SIZE = 5; // 5x5 cells starting territory

// Colors (matching design system)
const COLORS = {
  background: "#000000",
  grid: "#141414",
  snake: "#00E5CC", // hsl(174, 100%, 50%)
  snakeGlow: "rgba(0, 229, 204, 0.5)",
  territory: "#00E5CC",
  trail: "rgba(0, 229, 204, 0.4)",
  text: "#00E5CC",
};

interface PaperSnakeGameProps {
  playerName: string;
  onGameOver: (score: number) => void;
}

export const PaperSnakeGame = ({ playerName, onGameOver }: PaperSnakeGameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const lastMoveTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Calculate grid dimensions
  const gridWidth = Math.floor(dimensions.width / CELL_SIZE);
  const gridHeight = Math.floor(dimensions.height / CELL_SIZE);

  // === INITIALIZE GAME STATE ===
  const initGameState = useCallback((): GameState => {
    const startX = Math.floor(gridWidth / 2);
    const startY = Math.floor(gridHeight / 2);
    const halfSize = Math.floor(INITIAL_TERRITORY_SIZE / 2);

    // Create initial territory as a square polygon
    const initialTerritory: Polygon = [[
      [startX - halfSize, startY - halfSize],
      [startX + halfSize + 1, startY - halfSize],
      [startX + halfSize + 1, startY + halfSize + 1],
      [startX - halfSize, startY + halfSize + 1],
      [startX - halfSize, startY - halfSize], // Close the polygon
    ]];

    return {
      x: startX,
      y: startY,
      direction: "RIGHT",
      nextDirection: "RIGHT",
      trail: [],
      territories: [initialTerritory],
      isOutside: false,
      isGameOver: false,
    };
  }, [gridWidth, gridHeight]);

  // === POINT IN POLYGON CHECK ===
  const isPointInPolygon = (point: Point, polygon: Polygon): boolean => {
    const [x, y] = point;
    let inside = false;

    for (const ring of polygon) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];

        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
    }

    return inside;
  };

  // === CHECK IF POINT IS IN ANY TERRITORY ===
  const isInTerritory = (point: Point, territories: MultiPolygon): boolean => {
    return territories.some(polygon => isPointInPolygon(point, polygon));
  };

  // === MERGE NEW AREA WITH EXISTING TERRITORIES ===
  const mergeWithTerritories = (
    existingTerritories: MultiPolygon,
    newPolygon: Polygon
  ): MultiPolygon => {
    if (existingTerritories.length === 0) {
      return [newPolygon];
    }

    try {
      // Union all existing territories first
      let merged: MultiPolygon = existingTerritories;

      // Then union with the new polygon
      const result = martinez.union(
        merged as martinez.Geometry,
        [newPolygon] as martinez.Geometry
      );

      if (result && result.length > 0) {
        return result as MultiPolygon;
      }
    } catch (e) {
      console.warn("Polygon merge failed, using simple approach");
    }

    // Fallback: just add the new polygon
    return [...existingTerritories, newPolygon];
  };

  // === CREATE POLYGON FROM TRAIL ===
  const createPolygonFromTrail = (
    trail: Point[],
    territories: MultiPolygon,
    currentPos: Point
  ): Polygon | null => {
    if (trail.length < 2) return null;

    // Find where the trail connects back to territory
    const trailWithEnd = [...trail, currentPos];
    
    // Create a closed polygon from the trail
    // The trail goes from territory edge, around, and back to territory
    const polygonPoints: Point[] = [...trailWithEnd];
    
    // Close the polygon by going back along the territory edge
    // For simplicity, we'll create a polygon from just the trail points
    if (polygonPoints.length < 3) return null;

    // Ensure the polygon is closed
    const firstPoint = polygonPoints[0];
    const lastPoint = polygonPoints[polygonPoints.length - 1];
    
    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
      polygonPoints.push([firstPoint[0], firstPoint[1]]);
    }

    return [polygonPoints];
  };

  // === HANDLE KEYBOARD INPUT ===
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStateRef.current || gameStateRef.current.isGameOver) return;

      const state = gameStateRef.current;
      let newDir: Direction | null = null;

      switch (e.key) {
        case "ArrowUp":
          if (state.direction !== "DOWN") newDir = "UP";
          break;
        case "ArrowDown":
          if (state.direction !== "UP") newDir = "DOWN";
          break;
        case "ArrowLeft":
          if (state.direction !== "RIGHT") newDir = "LEFT";
          break;
        case "ArrowRight":
          if (state.direction !== "LEFT") newDir = "RIGHT";
          break;
      }

      if (newDir) {
        e.preventDefault();
        state.nextDirection = newDir;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // === HANDLE RESIZE ===
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // === MAIN GAME LOOP ===
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize game state
    gameStateRef.current = initGameState();
    lastMoveTimeRef.current = performance.now();

    const gameLoop = (currentTime: number) => {
      const state = gameStateRef.current;
      if (!state || state.isGameOver) return;

      // Calculate territory percentage for score
      const totalCells = gridWidth * gridHeight;
      let territoryCells = 0;
      
      // Count cells in territory (approximate)
      for (const polygon of state.territories) {
        for (const ring of polygon) {
          // Simple bounding box area approximation
          if (ring.length > 2) {
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            for (const [x, y] of ring) {
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }
            territoryCells += (maxX - minX) * (maxY - minY);
          }
        }
      }

      // === UPDATE LOGIC ===
      if (currentTime - lastMoveTimeRef.current >= SNAKE_SPEED) {
        lastMoveTimeRef.current = currentTime;

        // Apply queued direction
        state.direction = state.nextDirection;

        // Calculate new position
        let newX = state.x;
        let newY = state.y;

        switch (state.direction) {
          case "UP": newY--; break;
          case "DOWN": newY++; break;
          case "LEFT": newX--; break;
          case "RIGHT": newX++; break;
        }

        // Check wall collision (game over)
        if (newX < 0 || newX >= gridWidth || newY < 0 || newY >= gridHeight) {
          state.isGameOver = true;
          onGameOver((territoryCells / totalCells) * 100);
          return;
        }

        // Check if we hit our own trail (game over)
        const hitTrail = state.trail.some(([tx, ty]) => tx === newX && ty === newY);
        if (hitTrail) {
          state.isGameOver = true;
          onGameOver((territoryCells / totalCells) * 100);
          return;
        }

        const wasOutside = state.isOutside;
        const currentPos: Point = [state.x, state.y];
        const newPos: Point = [newX, newY];
        const nowInTerritory = isInTerritory(newPos, state.territories);

        // Track trail when outside territory
        if (state.isOutside && !nowInTerritory) {
          // Still outside, add to trail
          if (state.trail.length === 0 || 
              state.trail[state.trail.length - 1][0] !== state.x ||
              state.trail[state.trail.length - 1][1] !== state.y) {
            state.trail.push(currentPos);
          }
        } else if (!state.isOutside && !nowInTerritory) {
          // Just left territory, start trail
          state.trail = [currentPos];
          state.isOutside = true;
        } else if (wasOutside && nowInTerritory && state.trail.length > 0) {
          // Returned to territory! Complete the area
          state.trail.push(currentPos);
          state.trail.push(newPos);

          // Create and merge the new polygon
          const newPolygon = createPolygonFromTrail(state.trail, state.territories, newPos);
          if (newPolygon) {
            state.territories = mergeWithTerritories(state.territories, newPolygon);
          }

          // Reset trail
          state.trail = [];
          state.isOutside = false;
        }

        if (nowInTerritory) {
          state.isOutside = false;
        }

        // Update position
        state.x = newX;
        state.y = newY;
      }

      // === RENDER ===
      // Clear canvas
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw subtle grid
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= gridWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL_SIZE, 0);
        ctx.lineTo(x * CELL_SIZE, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= gridHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL_SIZE);
        ctx.lineTo(canvas.width, y * CELL_SIZE);
        ctx.stroke();
      }

      // Draw territories (solid color)
      ctx.fillStyle = COLORS.territory;
      for (const polygon of state.territories) {
        for (const ring of polygon) {
          if (ring.length < 3) continue;
          ctx.beginPath();
          ctx.moveTo(ring[0][0] * CELL_SIZE, ring[0][1] * CELL_SIZE);
          for (let i = 1; i < ring.length; i++) {
            ctx.lineTo(ring[i][0] * CELL_SIZE, ring[i][1] * CELL_SIZE);
          }
          ctx.closePath();
          ctx.fill();
        }
      }

      // Draw trail (semi-transparent)
      if (state.trail.length > 0) {
        ctx.strokeStyle = COLORS.trail;
        ctx.lineWidth = CELL_SIZE * 0.8;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(
          state.trail[0][0] * CELL_SIZE + CELL_SIZE / 2,
          state.trail[0][1] * CELL_SIZE + CELL_SIZE / 2
        );
        for (let i = 1; i < state.trail.length; i++) {
          ctx.lineTo(
            state.trail[i][0] * CELL_SIZE + CELL_SIZE / 2,
            state.trail[i][1] * CELL_SIZE + CELL_SIZE / 2
          );
        }
        // Connect to current position
        ctx.lineTo(
          state.x * CELL_SIZE + CELL_SIZE / 2,
          state.y * CELL_SIZE + CELL_SIZE / 2
        );
        ctx.stroke();

        // Draw trail fill (polygon area preview)
        ctx.fillStyle = COLORS.trail;
        ctx.beginPath();
        ctx.moveTo(state.trail[0][0] * CELL_SIZE, state.trail[0][1] * CELL_SIZE);
        for (let i = 1; i < state.trail.length; i++) {
          ctx.lineTo(state.trail[i][0] * CELL_SIZE, state.trail[i][1] * CELL_SIZE);
        }
        ctx.lineTo(state.x * CELL_SIZE, state.y * CELL_SIZE);
        ctx.closePath();
        ctx.fill();
      }

      // Draw snake head with glow
      const headX = state.x * CELL_SIZE + CELL_SIZE / 2;
      const headY = state.y * CELL_SIZE + CELL_SIZE / 2;

      // Glow effect
      ctx.shadowColor = COLORS.snakeGlow;
      ctx.shadowBlur = 15;

      ctx.fillStyle = COLORS.snake;
      ctx.beginPath();
      ctx.arc(headX, headY, CELL_SIZE * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Reset shadow
      ctx.shadowBlur = 0;

      // Draw player name above snake
      ctx.fillStyle = COLORS.text;
      ctx.font = "bold 12px Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(playerName, headX, headY - CELL_SIZE);

      // Draw HUD
      const score = (territoryCells / totalCells) * 100;
      ctx.fillStyle = COLORS.text;
      ctx.font = "bold 16px Orbitron, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${score.toFixed(1)}%`, 20, 20);

      // Continue loop
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dimensions, gridWidth, gridHeight, initGameState, onGameOver, playerName]);

  return (
    <canvas
      ref={canvasRef}
      width={dimensions.width}
      height={dimensions.height}
      className="fixed inset-0 touch-none"
    />
  );
};
