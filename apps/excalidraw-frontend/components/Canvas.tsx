import { useEffect, useRef, useState, memo } from "react";
import { IconButton } from "./IconButton";
import { Circle, Pencil, Square } from "lucide-react";
import { Game } from "@/draw/Game";

export type Tool = "circle" | "pencil" | "rectangle";

export function Canvas({
  roomId,
  socket,
}: {
  roomId: string;
  socket: WebSocket;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>("circle");
  const [game, setGame] = useState<Game>();
  const [dimensions, setDimensions] = useState(() => {
    if (typeof window !== "undefined") {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    return { width: 0, height: 0 };
  });

  // Safe SSR sizing and window resize handling
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update active drawing tool
  useEffect(() => {
    game?.setTool(selectedTool);
  }, [selectedTool, game]);

  // Instantiate canvas game logic
  useEffect(() => {
    if (canvasRef.current) {
      const g = new Game(canvasRef.current, roomId, socket);
      setGame(g);

      return () => {
        g.destroy();
      };
    }
  }, [canvasRef, roomId, socket]);

  // Redraw when screen sizes change
  useEffect(() => {
    if (game && dimensions.width > 0 && dimensions.height > 0) {
      game.clearCanvas();
    }
  }, [dimensions, game]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-950 select-none">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block w-full h-full cursor-crosshair"
      />
      <TopBar selectedTool={selectedTool} setSelectedTool={setSelectedTool} />
    </div>
  );
}

interface TopBarProps {
  selectedTool: Tool;
  setSelectedTool: (s: Tool) => void;
}

const TopBar = memo(function TopBar({
  selectedTool,
  setSelectedTool,
}: TopBarProps) {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-neutral-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-neutral-800 shadow-2xl">
        <IconButton
          activated={selectedTool === "pencil"}
          icon={<Pencil className="w-5 h-5" />}
          onClick={() => setSelectedTool("pencil")}
        />

        <IconButton
          activated={selectedTool === "rectangle"}
          icon={<Square className="w-5 h-5" />}
          onClick={() => setSelectedTool("rectangle")}
        />

        <IconButton
          activated={selectedTool === "circle"}
          icon={<Circle className="w-5 h-5" />}
          onClick={() => setSelectedTool("circle")}
        />
      </div>
    </div>
  );
});

TopBar.displayName = "TopBar";
