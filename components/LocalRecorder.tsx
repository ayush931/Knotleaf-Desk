'use client';
import { useEffect, useRef, useState } from 'react';
import { Circle, Square } from 'lucide-react';
export function LocalRecorder({onActivityChange}:{onActivityChange?:(active:boolean)=>void}={}) {
  const recorder = useRef<MediaRecorder | null>(null), cleanup = useRef<(() => void) | null>(null);
  const [recording, setRecording] = useState(false), [busy, setBusy] = useState(false), [mic, setMic] = useState(true), [error, setError] = useState(''), [download, setDownload] = useState<{ url: string; name: string } | null>(null);
  useEffect(()=>{onActivityChange?.(recording||busy);},[recording,busy,onActivityChange]);
  useEffect(()=>()=>onActivityChange?.(false),[onActivityChange]);
  useEffect(() => () => { if (recorder.current?.state === 'recording') recorder.current.stop(); cleanup.current?.(); }, []);
  useEffect(() => () => { if (download) URL.revokeObjectURL(download.url); }, [download]);
  const start = async () => {
    setBusy(true); setError('');
    let screen: MediaStream | undefined, microphone: MediaStream | undefined, context: AudioContext | undefined;
    const release = () => { screen?.getTracks().forEach(t => t.stop()); microphone?.getTracks().forEach(t => t.stop()); void context?.close(); };
    try {
      if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') throw new Error('This browser cannot record the screen. Use a current desktop Chrome, Edge or Firefox over HTTPS.');
      screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (mic) microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      context = new AudioContext(); await context.resume(); const mixed = context.createMediaStreamDestination();
      for (const stream of [screen, microphone]) if (stream?.getAudioTracks().length) context.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(mixed);
      const stream = new MediaStream([...screen.getVideoTracks(), ...(screen.getAudioTracks().length || microphone ? mixed.stream.getAudioTracks() : [])]);
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t));
      const active = new MediaRecorder(stream, mimeType ? { mimeType } : undefined), chunks: Blob[] = []; let bytes = 0;
      recorder.current = active; cleanup.current = release;
      active.ondataavailable = e => { if (e.data.size) { chunks.push(e.data); bytes += e.data.size; if (bytes > 512 * 1024 * 1024 && active.state === 'recording') { setError('Recording reached the 512 MB browser memory limit and was saved. Start a new recording to continue.'); active.stop(); } } };
      active.onerror = () => { setError('Recording interrupted. Available video is saved below.'); if (active.state !== 'inactive') active.stop(); };
      active.onstop = () => { const blob = new Blob(chunks, { type: active.mimeType || 'video/webm' }); const url = URL.createObjectURL(blob), name = `knotleaf-class-${new Date().toISOString().replace(/[:.]/g, '-')}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`; setDownload({ url, name }); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); release(); cleanup.current = null; recorder.current = null; setRecording(false); };
      screen.getVideoTracks()[0].onended = () => { if (active.state === 'recording') active.stop(); };
      active.start(1000); setRecording(true);
      if (!screen.getAudioTracks().length) setError('Screen audio was not provided. Student voices will only be recorded if the browser shares tab/system audio.');
    } catch (error) { release(); setError(error instanceof Error ? error.message : 'Could not start recording.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2 border-t border-neutral-700 p-3 text-xs"><div className="flex flex-wrap items-center gap-3"><button disabled={busy} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${recording ? 'border-rose-500 text-rose-300' : 'border-neutral-600 text-neutral-200'}`} onClick={() => recording ? recorder.current?.stop() : void start()}>{recording ? <Square className="h-3 w-3" /> : <Circle className="h-3 w-3" />}{recording ? 'Stop & save recording' : busy ? 'Starting…' : 'Record locally'}</button><label className="flex items-center gap-1 text-neutral-400"><input type="checkbox" checked={mic} disabled={recording || busy} onChange={e => setMic(e.target.checked)} />Include microphone</label></div><p className="text-neutral-400">Choose this tab and enable tab audio to capture the board, call and student voices. Recording stays on this device. Tell participants before recording.</p>{recording && <p role="status" className="text-rose-300">Recording locally · keep this page open until you stop and save.</p>}{download && <a className="inline-block text-blue-400 underline" href={download.url} download={download.name}>Download last recording again</a>}{error && <p role="alert" className="text-amber-300">{error}</p>}</div>;
}
