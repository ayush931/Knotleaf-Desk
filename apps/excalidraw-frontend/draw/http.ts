import { HTTP_BACKEND } from "@/app/config";
import axios from "axios";

export async function getExistingShapes(roomId: string) {
  const res = await axios.get(`${HTTP_BACKEND}/chats/${roomId}`);
  const messages = res.data.message;

  const shapes = messages.map((x: { message: string }) => {
    const messageData = JSON.parse(x.message);
    return messageData.shape;
  });

  return shapes;
}
