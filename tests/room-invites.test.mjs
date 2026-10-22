import { test, expect } from "bun:test";
import { parseRoomInvite } from "../lib/roomInvites.ts";
const id = "13273f26-6320-490d-a3f4-5c38cafb32fa";
test("call joining accepts an ID or invite and opens the call panel on either host", () => {
  expect(
    parseRoomInvite(id.toUpperCase(), "https://desk.example", true),
  ).toMatchObject({
    id,
    href: `https://desk.example/canvas/${id}?classroom=1`,
    call: true,
  });
  expect(
    parseRoomInvite(
      `https://other.example/canvas/${id}/`,
      "https://desk.example",
      true,
    ).href,
  ).toBe(`https://other.example/canvas/${id}?classroom=1`);
  expect(
    parseRoomInvite(
      `https://desk.example/canvas/${id}?classroom=1`,
      "https://desk.example",
    ).call,
  ).toBe(true);
});
test("joining rejects unsafe URLs, invalid paths, embedded credentials and partial IDs", () => {
  for (const input of [
    "javascript:alert(1)",
    `https://desk.example/not-canvas/${id}`,
    `https://user:password@desk.example/canvas/${id}`,
    `prefix ${id}`,
    id.slice(1),
  ])
    expect(() => parseRoomInvite(input, "https://desk.example")).toThrow(
      "valid",
    );
});
