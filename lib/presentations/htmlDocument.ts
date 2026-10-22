import { installTextAnnotations } from "./annotations.mjs";
export function isolatedDocument(
  source: string,
  scripts: boolean,
  token?: string,
) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = `default-src 'none'; img-src data: blob: https: http:; media-src data: blob: https: http:; style-src 'unsafe-inline' https: http:; font-src data: https: http:; frame-src https:; script-src ${scripts ? "'unsafe-inline' https:" : `'nonce-${nonce}'`}; connect-src 'none'; base-uri 'none'; form-action 'none'`;
  let runtime = "";
  if (token) {
    const value = JSON.stringify(token).replace(/</g, "\\u003c");
    runtime = `<script nonce="${nonce}">(()=>{const token=${value};const install=${installTextAnnotations.toString()};const start=()=>{const notes=install(document.body,value=>parent.postMessage({type:'knotleaf-annotation',token,value},'*'));addEventListener('message',event=>{if(event.source!==parent||event.data?.token!==token)return;if(event.data.type==='knotleaf-marks'&&Array.isArray(event.data.marks))notes.setMarks(event.data.marks);else if(event.data.type==='knotleaf-clear-selection')notes.clearSelection();else if(event.data.type==='knotleaf-print')window.print();});parent.postMessage({type:'knotleaf-annotation-ready',token},'*');};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})()</script>`;
  }
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width,initial-scale=1">${source}${runtime}`;
}
