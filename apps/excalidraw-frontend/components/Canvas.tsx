import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { Circle, Pencil, RectangleHorizontalIcon } from "lucide-react";
import { Game } from "@/draw/Game";

export type Tool = 'circle' | 'pencil' | 'rectangle'

export function Canvas({ roomId, socket }: { roomId: string, socket: WebSocket }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>('circle')
  const [game, setGame] = useState<Game>()

  useEffect(() => {
    game?.setTool(selectedTool)
  }, [selectedTool, game])

  useEffect(() => {
    if (canvasRef.current) {
      const g = new Game(canvasRef.current, roomId, socket);
      setGame(g);

      return () => {
        g.destroy();
      }
    }
  }, [canvasRef])

  return (
    <div style={{
      overflow: 'hidden',
      height: '100vh'
    }}>
      <canvas ref={canvasRef} height={window.innerHeight} width={window.innerWidth}></canvas>
      <TopBar setSelectedTool={setSelectedTool} selectedTool={selectedTool} />
    </div>
  )
}

function TopBar({ selectedTool, setSelectedTool }: {
  selectedTool: Tool,
  setSelectedTool: (s: Tool) => void
}) {
  return (
    <div style={{
      position: 'fixed',
      top: 10,
      left: 10
    }}>
      <div className="flex gap-5">
        <IconButton
          activated={selectedTool === 'pencil'}
          icon={<Pencil />}
          onClick={() => { setSelectedTool('pencil') }}>
        </IconButton>

        <IconButton
          activated={selectedTool === 'rectangle'}
          icon={<RectangleHorizontalIcon />}
          onClick={() => { setSelectedTool('rectangle') }}>
        </IconButton>

        <IconButton
          activated={selectedTool === 'circle'}
          icon={<Circle />}
          onClick={() => { setSelectedTool('circle') }}>
        </IconButton>
      </div>
    </div>
  )
}