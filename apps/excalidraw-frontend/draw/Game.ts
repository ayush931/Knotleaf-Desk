import { Tool } from "@/components/Canvas";
import { getExistingShapes } from "./http";

export type Shape = (
  | {
      type: "rectangle";
      x: number;
      y: number;
      height: number;
      width: number;
    }
  | {
      type: "circle";
      centerX: number;
      centerY: number;
      radius: number;
    }
  | {
      type: "pencil";
      points: { x: number; y: number }[];
    }
) & { id: string };

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private existingShape: Shape[] = [];
  private roomId: string;
  socket: WebSocket;
  private clicked: boolean = false;
  private startX: number = 0;
  private startY: number = 0;
  private selectedTool: Tool = "circle";
  private currentPoints: { x: number; y: number }[] = [];

  constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.init();
    this.roomId = roomId;
    this.socket = socket;
    this.initHandlers();
    this.initMouseHandlers();
  }

  setTool(tool: Tool) {
    this.selectedTool = tool;
  }

  async init() {
    const shapes = await getExistingShapes(this.roomId);
    this.existingShape = shapes.filter((shape: unknown): shape is Shape => {
      if (!shape) return false;
      const s = shape as Shape;
      // Assign an ID if it doesn't have one (e.g., legacy shapes in DB)
      if (!s.id) {
        s.id = Math.random().toString(36).substring(2, 9);
      }
      return true;
    });
    this.clearCanvas();
  }

  destroy() {
    this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
    this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
    this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
  }

  initHandlers() {
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "chat") {
        const messageData = JSON.parse(message.message);
        if (messageData.shape) {
          const shape: Shape = messageData.shape;
          // State diffing: only append and draw if it's a new shape
          const exists = this.existingShape.some((x) => x.id === shape.id);
          if (!exists) {
            this.existingShape.push(shape);
            this.drawShape(shape);
          }
        }
      }
    };
  }

  drawShape(shape: Shape) {
    this.ctx.strokeStyle = "rgba(255, 255, 255)";
    this.ctx.lineWidth = 2;

    if (shape.type === "rectangle") {
      this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.type === "circle") {
      this.ctx.beginPath();
      this.ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.closePath();
    } else if (shape.type === "pencil") {
      if (shape.points && shape.points.length > 0) {
        this.ctx.beginPath();
        this.ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          this.ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        this.ctx.stroke();
        this.ctx.closePath();
      }
    }
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "rgba(0, 0, 0)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.existingShape.forEach((shape) => {
      this.drawShape(shape);
    });
  }

  mouseDownHandler = (e: MouseEvent) => {
    this.clicked = true;
    const rect = this.canvas.getBoundingClientRect();
    this.startX = e.clientX - rect.left;
    this.startY = e.clientY - rect.top;

    if (this.selectedTool === "pencil") {
      this.currentPoints = [{ x: this.startX, y: this.startY }];
    }
  };

  mouseUpHandler = (e: MouseEvent) => {
    this.clicked = false;
    const rect = this.canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    const width = currentX - this.startX;
    const height = currentY - this.startY;

    const selectedTool = this.selectedTool;
    let shape: Shape | null = null;

    if (selectedTool === "rectangle") {
      shape = {
        id: Math.random().toString(36).substring(2, 9),
        type: "rectangle",
        x: width >= 0 ? this.startX : currentX,
        y: height >= 0 ? this.startY : currentY,
        width: Math.abs(width),
        height: Math.abs(height),
      };
    } else if (selectedTool === "circle") {
      const radius = Math.max(Math.abs(height), Math.abs(width)) / 2;
      const centerX = this.startX + (width >= 0 ? radius : -radius);
      const centerY = this.startY + (height >= 0 ? radius : -radius);
      shape = {
        id: Math.random().toString(36).substring(2, 9),
        type: "circle",
        radius: radius,
        centerX: centerX,
        centerY: centerY,
      };
    } else if (selectedTool === "pencil") {
      this.currentPoints.push({ x: currentX, y: currentY });
      shape = {
        id: Math.random().toString(36).substring(2, 9),
        type: "pencil",
        points: [...this.currentPoints],
      };
      this.currentPoints = [];
    }

    if (!shape) {
      return;
    }

    this.existingShape.push(shape);
    this.clearCanvas();

    this.socket.send(
      JSON.stringify({
        type: "chat",
        message: JSON.stringify({
          shape,
        }),
        roomId: this.roomId,
      }),
    );
  };

  mouseMoveHandler = (e: MouseEvent) => {
    if (this.clicked) {
      const rect = this.canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      const width = currentX - this.startX;
      const height = currentY - this.startY;

      this.clearCanvas();

      this.ctx.strokeStyle = "rgba(255, 255, 255)";
      this.ctx.lineWidth = 2;

      const selectedTool = this.selectedTool;
      if (selectedTool === "rectangle") {
        this.ctx.strokeRect(this.startX, this.startY, width, height);
      } else if (selectedTool === "circle") {
        const radius = Math.max(Math.abs(height), Math.abs(width)) / 2;
        const centerX = this.startX + (width >= 0 ? radius : -radius);
        const centerY = this.startY + (height >= 0 ? radius : -radius);
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.closePath();
      } else if (selectedTool === "pencil") {
        this.currentPoints.push({ x: currentX, y: currentY });
        this.ctx.beginPath();
        this.ctx.moveTo(this.currentPoints[0].x, this.currentPoints[0].y);
        for (let i = 1; i < this.currentPoints.length; i++) {
          this.ctx.lineTo(this.currentPoints[i].x, this.currentPoints[i].y);
        }
        this.ctx.stroke();
        this.ctx.closePath();
      }
    }
  };

  initMouseHandlers() {
    this.canvas.addEventListener("mousedown", this.mouseDownHandler);
    this.canvas.addEventListener("mouseup", this.mouseUpHandler);
    this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
  }
}
