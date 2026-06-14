import axios from "axios";
import { BACKEND_URL } from "../../../config";
import { ChatRoom } from "../../../components/ChatsRoom";

async function getRoomId(slug: string): Promise<string | null> {
  try {
    const response = await axios.get(`${BACKEND_URL}/room/${slug}`);
    console.log(response.data);
    const roomId = response.data.room?.id;
    return roomId !== undefined && roomId !== null ? String(roomId) : null;
  } catch (error) {
    console.error("Failed to fetch room ID:", error);
    return null;
  }
}

export default async function ChatRoom1({
  params,
}: {
  params: {
    slug: string;
  };
}) {
  const slug = (await params).slug;
  console.log(slug);
  const id = await getRoomId(slug);

  if (id === null) {
    return (
      <div className="w-screen h-screen flex flex-col justify-center items-center bg-neutral-950 text-white p-4 font-sans text-center">
        <h1 className="text-2xl font-bold text-rose-500 mb-2">Room Not Found</h1>
        <p className="text-neutral-400 max-w-sm">
          The room slug <code className="bg-neutral-900 px-2 py-1 rounded text-neutral-200">"{slug}"</code> does not exist or the backend server is unreachable.
        </p>
      </div>
    );
  }

  return <ChatRoom id={id}></ChatRoom>;
}
