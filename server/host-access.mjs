import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export function hostTokenHash(token) {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token)
    ? createHash("sha256").update(token).digest("hex")
    : null;
}
export function issueHostAccess() {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hostTokenHash(token) };
}
export function verifyHostToken(token, hash) {
  const candidate = hostTokenHash(token);
  return (
    !!candidate &&
    typeof hash === "string" &&
    /^[a-f0-9]{64}$/.test(hash) &&
    timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"))
  );
}
