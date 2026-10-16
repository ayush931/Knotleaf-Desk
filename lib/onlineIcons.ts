export const ICONIFY = "https://api.iconify.design";
export const validIconId = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
export function iconUrl(id: string, preview = false) {
  if (!validIconId(id)) throw new Error("Invalid icon ID.");
  return `${ICONIFY}/${id.replace(":", "/")}.svg${preview ? "?color=%23e2e8f0" : ""}`;
}
async function request(url: string, signal: AbortSignal, fetcher = fetch) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) controller.abort();
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 12_000);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 429 ? "The icon service is busy. Try again shortly." : "Could not load icons. Try again.");
    const body = await response.text();
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    return body;
  } catch (error) {
    if (timedOut) throw new Error("The icon service took too long. Check your connection and retry.");
    throw error;
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
}
export async function searchOnlineIcons(query: string, signal: AbortSignal, fetcher = fetch): Promise<string[]> {
  const body = await request(`${ICONIFY}/search?query=${encodeURIComponent(query.trim())}&limit=24`, signal, fetcher);
  let data;
  try { data = JSON.parse(body); } catch { throw new Error("The icon service returned an invalid search response."); }
  if (!data || !Array.isArray(data.icons)) throw new Error("The icon service returned an invalid search response.");
  return [...new Set(data.icons.filter(validIconId))] as string[];
}
export function fetchOnlineIcon(id: string, signal: AbortSignal, fetcher = fetch) { return request(iconUrl(id), signal, fetcher); }
