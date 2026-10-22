import { test, expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCollaborationServer } from "../server/collaboration.mjs";
test("warmup prepares storage without creating an invite and status checks avoid loading the document", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "knotleaf-warm-"));
  let warmed = 0,
    created = 0,
    status = 0,
    loaded = 0;
  const store = {
    async ready() {
      warmed++;
    },
    async create() {
      created++;
    },
    async status() {
      status++;
      return { expiresAt: new Date(Date.now() + 86400000).toISOString() };
    },
    async load() {
      loaded++;
      return null;
    },
    async purgeExpired() {
      return [];
    },
  };
  const service = createCollaborationServer({
    port: 0,
    directory,
    roomStore: store,
    pathPrefix: "/collaboration/",
    origins: ["https://desk.example"],
  });
  const address = await service.listen(),
    base = `http://127.0.0.1:${address.port}`;
  try {
    const response = await fetch(base + "/api/rooms", {
      method: "POST",
      headers: {
        origin: "https://desk.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ warmup: true }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ready: true,
      websocketUrl: "/collaboration",
    });
    expect(warmed).toBe(1);
    expect(created).toBe(0);
    const denied = await fetch(base + "/api/rooms", {
      method: "POST",
      headers: {
        origin: "https://wrong.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ warmup: true }),
    });
    expect(denied.status).toBe(403);
    expect(warmed).toBe(1);
    const checked = await fetch(base + "/api/rooms/" + crypto.randomUUID());
    expect(checked.status).toBe(200);
    expect(status).toBe(1);
    expect(loaded).toBe(0);
  } finally {
    await service.close();
    await rm(directory, { recursive: true, force: true });
  }
});
