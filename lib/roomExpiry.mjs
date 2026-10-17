export const ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000;
export function roomExpiresAt(createdAt) {
  const created = typeof createdAt === 'number' ? createdAt : Date.parse(createdAt);
  return Number.isFinite(created) ? created + ROOM_LIFETIME_MS : 0;
}
