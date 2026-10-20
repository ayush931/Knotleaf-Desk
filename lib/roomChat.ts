export const CHAT_LIMIT = 100;
export const CHAT_TEXT_LIMIT = 2000;
export interface RoomMessage {
  id: string;
  author: number;
  name: string;
  text: string;
  at: number;
}
export interface RoomChatProps {
  messages: RoomMessage[];
  connected: boolean;
  onSend: (text: string) => void;
}
export function isRoomMessage(value: unknown): value is RoomMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<RoomMessage>;
  return (
    typeof message.id === "string" &&
    message.id.length > 0 &&
    message.id.length <= 80 &&
    typeof message.author === "number" &&
    Number.isSafeInteger(message.author) &&
    message.author >= 0 &&
    typeof message.name === "string" &&
    message.name.trim().length > 0 &&
    message.name.length <= 40 &&
    typeof message.text === "string" &&
    message.text.trim().length > 0 &&
    message.text.length <= CHAT_TEXT_LIMIT &&
    typeof message.at === "number" &&
    Number.isSafeInteger(message.at) &&
    message.at >= 0 &&
    message.at <= 8640000000000000
  );
}
