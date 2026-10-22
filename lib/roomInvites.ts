const ROOM_ID =
  /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
export const isRoomInviteId = (id: string) => ROOM_ID.test(id);
export function parseRoomInvite(
  value: string,
  origin: string,
  openCall = false,
) {
  const input = value.trim();
  let url: URL;
  try {
    url = ROOM_ID.test(input)
      ? new URL(`/canvas/${input.toLowerCase()}`, origin)
      : new URL(input);
  } catch {
    throw new Error("Paste a valid room link or room ID.");
  }
  const match = url.pathname.match(/^\/canvas\/([^/]+)\/?$/);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !match ||
    !ROOM_ID.test(match[1])
  )
    throw new Error("Paste a valid room link or room ID.");
  const id = match[1].toLowerCase();
  url.pathname = `/canvas/${id}`;
  const call = openCall || url.searchParams.get("classroom") === "1";
  if (call) url.searchParams.set("classroom", "1");
  return { id, href: url.href, origin: url.origin, call };
}
