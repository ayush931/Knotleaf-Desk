import { test, expect } from "bun:test";
import pg from "pg";
import { createRoomStore } from "../server/database.mjs";
test("healthy PostgreSQL checks use one query and availability does not fetch scene bytes", async () => {
  const Original = pg.Pool,
    queries = [];
  const expiresAt = new Date(Date.now() + 86400000).toISOString();
  pg.Pool = class {
    async query(sql) {
      queries.push(sql);
      return {
        rows: sql.startsWith("SELECT") ? [{ state: "scene", expiresAt }] : [],
      };
    }
    async end() {}
  };
  const store = createRoomStore("postgres://test:test@localhost/test");
  try {
    await store.ready();
    queries.length = 0;
    expect((await store.load(crypto.randomUUID())).state).toBe("scene");
    expect(queries).toHaveLength(1);
    expect(queries[0]).not.toContain("DELETE");
    queries.length = 0;
    await store.status(crypto.randomUUID());
    expect(queries).toHaveLength(1);
    expect(queries[0]).not.toContain("state_base64");
  } finally {
    await store.close();
    pg.Pool = Original;
  }
});
