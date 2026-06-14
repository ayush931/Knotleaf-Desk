import { prismaClient } from "@repo/db/client";
import { JWT_TOKEN } from "@repo/backend-common/config";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";

const wss = new WebSocketServer({ port: 8080 });

interface User {
  ws: WebSocket;
  rooms: string[];
  userId: string;
}

const users: User[] = [];

function checkUser(token: string): string | null {
  try {
    const decode = jwt.verify(token, JWT_TOKEN);

    if (typeof decode === "string") {
      return null;
    }

    if (!decode || !decode.userId) {
      return null;
    }

    return decode.userId;
  } catch (error) {
    return null;
  }
}

wss.on("connection", (ws, request) => {
  const url = request.url;
  if (!url) return;

  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token") || "";
  const userId = checkUser(token);

  if (userId === null) {
    ws.close();
    return;
  }

  users.push({
    userId,
    rooms: [],
    ws,
  });

  ws.on("message", async (data) => {
    const parsedData = JSON.parse(data as unknown as string);

    if (parsedData.type === "join_room") {
      const user = users.find((x) => x.ws === ws);
      user?.rooms.push(parsedData.roomId);
    }

    if (parsedData.type === "leave_room") {
      const user = users.find((x) => x.ws === ws);
      if (!user) {
        return;
      }

      user.rooms = user.rooms.filter((r) => r !== parsedData.roomId);
    }

    if (parsedData.type === "chat") {
      const roomId = parsedData.roomId;
      const message = parsedData.message;

      await prismaClient.chat.create({
        data: {
          roomId: Number(roomId),
          message,
          userId,
        },
      });

      users.forEach((user) => {
        if (user.rooms.includes(roomId)) {
          user.ws.send(
            JSON.stringify({
              type: "chat",
              message: message,
              roomId,
            }),
          );
        }
      });
    }
  });
});
