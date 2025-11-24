import { Tool } from "@/components/Canvas"
import { getExistingShapes } from "./http"

type Shape = {
  type: 'rectangle',
  x: number,
  y: number,
  height: number,
  width: number
} | {
  type: 'circle',
  centerX: number,
  centerY: number,
  radius: number
} | {
  type: 'pencil',
  centerX: number,
  centerY: number,
  endX: number,
  endY: number
}

export class Game {

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private existingShape: Shape[] = []
  private roomId: string
  socket: WebSocket
  private clicked: boolean = false
  private startX: number = 0;
  private startY: number = 0;
  private selectedTool: Tool = 'circle'

  constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.init();
    this.roomId = roomId;
    this.socket = socket;
    this.initHandlers();
    this.initMouseHandlers();
  }

  setTool(tool: Tool) {
    this.selectedTool = tool
  }

  async init() {
    this.existingShape = await getExistingShapes(this.roomId)
    this.clearCanvas();
  }

  destroy() {
    this.canvas.removeEventListener('mousedown', this.mouseDownHandler)
    this.canvas.removeEventListener('mouseup', this.mouseUpHandler)
    this.canvas.removeEventListener('mousemove', this.mouseMoveHandler)
  }

  initHandlers() {
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'chat') {
        const messageData = JSON.parse(message.message);
        if (messageData.shape) {
          this.existingShape.push(messageData.shape);
          this.clearCanvas()
        }
      }
    }
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = 'rgba(0, 0, 0)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.existingShape.forEach((shape) => {
      if (shape && shape.type === 'rectangle') {
        this.ctx.strokeStyle = 'rgba(255, 255, 255)';
        this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
      }
      else if (shape && shape.type === 'circle') {
        this.ctx.beginPath();
        this.ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.closePath();
      }
    })
  }

  mouseDownHandler = (e) => {
    this.clicked = true
    this.startX = e.clientX;
    this.startY = e.clientY
  }

  mouseUpHandler = (e) => {
    this.clicked = false;
    const width = e.clientX - this.startX;
    const height = e.clientY - this.startY;

    const selectedTool = this.selectedTool
    let shape: Shape | null = null

    if (selectedTool === 'rectangle') {
      shape = {
        type: 'rectangle',
        x: this.startX,
        y: this.startY,
        height,
        width
      }
    }
    else if (selectedTool === 'circle') {
      const radius = Math.max(height, width) / 2;
      shape = {
        type: 'circle',
        radius: radius,
        centerX: this.startX + radius,
        centerY: this.startY + radius
      }
    }

    if (!shape) {
      return;
    }

    this.existingShape.push(shape);

    this.socket.send(JSON.stringify({
      type: 'chat',
      message: JSON.stringify({
        shape
      }),
      roomId: this.roomId
    }))
  }

  mouseMoveHandler = (e) => {
    if (this.clicked) {
      const width = e.clientX - this.startX;
      const height = e.clientY - this.startY;
      this.clearCanvas();
      this.ctx.strokeStyle = 'rgba(255, 255, 255)';
      const selectedTool = this.selectedTool
      if (selectedTool === 'rectangle') {
        this.ctx.strokeRect(this.startX, this.startY, width, height);
      }
      else if (selectedTool === 'circle') {
        const radius = Math.max(height, width) / 2;
        const centerX = this.startX + radius;
        const centerY = this.startY + radius;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.closePath();
      }
    }
  }

  initMouseHandlers() {
    this.canvas.addEventListener('mousedown', this.mouseDownHandler)
    this.canvas.addEventListener('mouseup', this.mouseUpHandler)
    this.canvas.addEventListener('mousemove', this.mouseMoveHandler)
  }
}