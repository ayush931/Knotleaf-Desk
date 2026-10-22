import { test, expect } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRoomStore } from "../server/database.mjs";
import { createStoredRoom } from "../server/room-http.mjs";
import {
  saveRoomHostAccess,
  getRoomHostAccess,
  clearRoomHostAccess,
} from "../lib/roomAccess.ts";
test("creator host capability is private, hashed in storage, scoped to its room and survives store restart", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "knotleaf-host-")),
    store = createRoomStore(null, directory);
  try {
    const room = await createStoredRoom(
      store,
      { title: "Host access", elements: [], markdownNotes: "" },
      "https://desk.example",
    );
    expect(room.hostToken).toMatch(/^[a-f0-9]{64}$/);
    expect(room.path).not.toContain(room.hostToken);
    const raw = await readFile(path.join(directory, room.id + ".json"), "utf8");
    expect(raw).not.toContain(room.hostToken);
    expect(JSON.parse(raw).hostTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await store.verifyHost(room.id, room.hostToken)).toBe(true);
    expect(await store.verifyHost(room.id, "0".repeat(64))).toBe(false);
    expect(await store.verifyHost(crypto.randomUUID(), room.hostToken)).toBe(
      false,
    );
    const restored = createRoomStore(null, directory);
    expect(await restored.verifyHost(room.id, room.hostToken)).toBe(true);
    await restored.close();
  } finally {
    await store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("host access stays separate from boards and expires with the room", () => {
  const old = Object.getOwnPropertyDescriptor(globalThis, "localStorage"),
    records = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => records.get(key) || null,
      setItem: (key, value) => records.set(key, value),
      removeItem: (key) => records.delete(key),
    },
  });
  try {
    const id = crypto.randomUUID(),
      token = "a".repeat(64);
    expect(
      saveRoomHostAccess(
        id,
        token,
        new Date(Date.now() + 86400000).toISOString(),
      ),
    ).toBe(true);
    expect(getRoomHostAccess(id)).toBe(token);
    expect([...records.keys()]).toEqual([`knotleaf.room-host.${id}`]);
    clearRoomHostAccess(id);
    expect(getRoomHostAccess(id)).toBeUndefined();
    expect(records.has(`knotleaf.room-host.${id}`)).toBe(false);
    const expired = crypto.randomUUID();
    records.set(
      `knotleaf.room-host.${expired}`,
      JSON.stringify({ token, expiresAt: Date.now() - 1 }),
    );
    expect(getRoomHostAccess(expired)).toBeUndefined();
    expect(records.has(`knotleaf.room-host.${expired}`)).toBe(false);
  } finally {
    if (old) Object.defineProperty(globalThis, "localStorage", old);
    else delete globalThis.localStorage;
  }
});
