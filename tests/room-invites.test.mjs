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

test('short room and video links retain the full UUID capability and join behavior',async()=>{
 const {shortRoomCode,roomIdFromCode}=await import('../lib/shortRoomCode.ts');
 for(let i=0;i<500;i++){const id=crypto.randomUUID(),code=shortRoomCode(id);expect(code).toHaveLength(22);expect(roomIdFromCode(code)).toBe(id);}
 const code=shortRoomCode(id);
 expect(parseRoomInvite(`https://desk.example/r/${code}`,'https://desk.example')).toMatchObject({id,call:false});
 expect(parseRoomInvite(`https://desk.example/v/${code}`,'https://desk.example')).toMatchObject({id,call:true,href:`https://desk.example/canvas/${id}?classroom=1`});
 expect(parseRoomInvite(`https://desk.example/r/${code}`,'https://desk.example',true).call).toBe(true);
 for(const input of ['bad','.'.repeat(22),'A'.repeat(22),code+'x',code.slice(0,21)+'B'])expect(roomIdFromCode(input)).toBeNull();
 expect(()=>parseRoomInvite('https://user:secret@desk.example/v/'+code,'https://desk.example')).toThrow('valid');
 expect(()=>parseRoomInvite('https://desk.example/v/invalid','https://desk.example')).toThrow('valid');
});
