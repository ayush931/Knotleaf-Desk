import { THEME_CSS } from "./themeStyles";
import { DESIGN_CSS } from "./designStyles";
// The same slide rules are used by live preview, presenter, and exports.
const BASE_CSS =
  `
.kl-slide{box-sizing:border-box;width:1280px;height:720px;padding:64px 76px;overflow:hidden;background:var(--deck-bg);background-image:var(--deck-wash);color:var(--deck-ink);font:30px/1.45 Arial,sans-serif;position:relative;text-align:left;overflow-wrap:anywhere}
.kl-slide *{box-sizing:border-box}.kl-slide h1,.kl-slide h2,.kl-slide h3{font-family:var(--deck-heading);font-weight:700;letter-spacing:-.035em;line-height:1.12;margin:0 0 28px;color:var(--deck-ink)}
.kl-slide h1{font-size:88px;max-width:1050px}.kl-slide h2{font-size:58px}.kl-slide h3{font-size:38px}.kl-slide p{margin:0 0 22px}.kl-slide ul,.kl-slide ol{padding-left:38px;margin:16px 0 24px}.kl-slide li{margin:10px 0}.kl-slide strong,.kl-slide a{color:var(--deck-accent)}.kl-slide a{text-decoration:underline}.kl-slide blockquote{margin:24px 0;padding:12px 28px;border-left:4px solid var(--deck-accent);color:var(--deck-muted)}
.kl-slide pre{font:23px/1.5 var(--deck-code,monospace);padding:24px;background:#0003;border:1px solid #8884;border-radius:12px;white-space:pre-wrap;tab-size:2;overflow:hidden;margin:20px 0}.kl-slide code{font-family:var(--deck-code,monospace)}.kl-slide :not(pre)>code{font-size:.85em;background:#8882;border-radius:4px;padding:2px 6px}.kl-slide img{display:block;max-width:100%;max-height:450px;object-fit:contain;margin:20px auto}.kl-slide table{border-collapse:collapse;font-size:26px;width:100%}.kl-slide th,.kl-slide td{border-bottom:1px solid #8885;padding:12px;text-align:left}.kl-slide hr{border:0;border-top:1px solid #8885;margin:24px 0}.kl-slide svg{max-width:100%;max-height:460px;display:block;margin:auto}.kl-slide .kl-math{overflow:hidden;text-align:center;margin:24px 0}.kl-slide .hljs-keyword,.kl-slide .hljs-selector-tag{color:var(--deck-accent)}.kl-slide .hljs-string,.kl-slide .hljs-number{color:var(--deck-muted)}.kl-slide [data-step]{display:contents}.kl-slide [data-hidden=true]{visibility:hidden}.kl-slide[data-layout=center]{display:flex;flex-direction:column;justify-content:center;text-align:center}.kl-slide[data-layout=center] ul,.kl-slide[data-layout=center] ol{text-align:left;align-self:center}.kl-slide[data-layout=split]{column-count:2;column-gap:64px}.kl-slide[data-layout=split] h1,.kl-slide[data-layout=split] h2{column-span:all}.kl-slide[data-layout=split]>*{break-inside:avoid}.kl-slide .kl-error{color:#f87171;font-size:22px;white-space:pre-wrap}
` +
  DESIGN_CSS +
  THEME_CSS;

export const SLIDE_CSS = BASE_CSS.replace(
  /(font-size:|font:)(\d+(?:\.\d+)?)px/g,
  "$1calc($2px * var(--deck-scale,1))",
);
