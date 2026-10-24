"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, LoaderCircle, UserRound, X } from "lucide-react";
import { authClient } from "@/lib/authClient";

type Config = { enabled: boolean; google: boolean };
const accountTriggerClass = "flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2 text-xs font-medium text-white hover:bg-blue-500 active:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500";
const buttonClass = "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-neutral-700 px-2 text-xs text-neutral-200 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50";

export function AccountButton() {
  const [config, setConfig] = useState<Config | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/config", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(setConfig).catch(() => {});
    return () => controller.abort();
  }, []);
  return config?.enabled ? <AccountControl config={config} /> : <UnavailableAccount loading={!config} />;
}

function UnavailableAccount({ loading }: { loading: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={accountTriggerClass} aria-label="Sign in" title="Sign in" onClick={() => setOpen(true)}><UserRound className="h-3.5 w-3.5" /><span className="hidden min-[420px]:inline">Sign in</span></button>
    <AccountDialog open={open} onClose={() => setOpen(false)} title="Sign in">
      <p role="status" className="text-sm text-neutral-400">{loading ? "Could not load sign-in. Close this dialog and refresh to try again." : "Sign-in is not available on this installation yet. You can continue working locally."}</p>
    </AccountDialog>
  </>;
}

function AccountControl({ config }: { config: Config }) {
  const { data: session, isPending, error: sessionError, refetch } = authClient.useSession();
  const [oauthFailure] = useState(() => typeof window !== "undefined" && new URL(window.location.href).searchParams.has("auth_error"));
  const [open, setOpen] = useState(oauthFailure);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState(oauthFailure ? "Google sign-in did not finish. Try again, or sign in with your email and password." : "");
  const [field, setField] = useState("");
  const pending = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("auth_error")) return;
    url.searchParams.delete("auth_error");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      pending.current = false; setBusy(false); setGoogleBusy(false);
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  const close = () => { if (!pending.current) { setOpen(false); setPassword(""); setVisible(false); setError(""); setField(""); } };
  const fail = (message: string, invalid = "") => {
    setError(message); setField(invalid);
    if (invalid === "email") emailRef.current?.focus();
    if (invalid === "password") passwordRef.current?.focus();
    if (invalid === "name") nameRef.current?.focus();
  };
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setField("");
    try { await action(); } catch { fail("Could not reach sign-in. Check your connection and try again."); }
    finally { pending.current = false; setBusy(false); }
  };
  const inputClass = "mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50";
  const errors = (key: string) => ({ "aria-invalid": field === key, "aria-describedby": field === key ? `${id}-error` : key === "password" && mode === "signup" ? `${id}-requirements` : undefined });

  return <>
    <button type="button" className={accountTriggerClass} title={session ? "Your account" : "Sign in"} aria-label={session ? `Account: ${session.user.email}` : "Sign in"} onClick={() => setOpen(true)}>
      <UserRound className="h-3.5 w-3.5" /><span className="hidden max-w-24 truncate min-[420px]:inline">{session ? "Account" : "Sign in"}</span>
    </button>
    <AccountDialog open={open} onClose={close} title={session ? "Your account" : mode === "signup" ? "Create an account" : "Sign in to Knotleaf Desk"}>
      {isPending && !busy ? <p role="status" className="text-sm text-neutral-400">Checking your session…</p> : sessionError && !busy ? <div className="space-y-3"><p role="alert" className="text-sm text-rose-300">{sessionError.status >= 500 ? "Sign-in is temporarily unavailable on the server. Try again shortly." : "Could not check your session. Check your connection and try again."}</p><button className={buttonClass} onClick={() => refetch()}>Try again</button></div> : session ? <div className="space-y-4">
        <p className="break-words text-sm text-neutral-200">{session.user.name}<br /><span className="text-neutral-400">{session.user.email}</span></p>
        <p className="text-xs text-neutral-400">Boards and notes stay on this device. Signing out keeps your local work.</p>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <button disabled={busy} className={buttonClass} onClick={() => run(async () => {
          const result = await authClient.signOut();
          if (result.error) fail("Could not sign out. Try again.");
          else { setPassword(""); setOpen(false); }
        })}>{busy ? "Signing out…" : "Sign out"}</button>
      </div> : <>
        <p className="mb-4 text-sm text-neutral-400">{mode === "signup" ? "Use Google or create an account with your email." : "Continue with Google or your email and password."}</p>
        <div className="flex justify-center"><button type="button" aria-label="Continue with Google" aria-busy={googleBusy} disabled={busy || !config.google} className="inline-flex h-10 w-[252px] max-w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 active:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50" onClick={async () => {
          if (pending.current) return;
          pending.current = true; setBusy(true); setGoogleBusy(true); setError(""); setField("");
          try {
          const callbackURL = window.location.pathname + window.location.search + window.location.hash;
          const failure = new URL(window.location.href); failure.searchParams.set("auth_error", "google");
          const result = await authClient.signIn.social({ provider: "google", callbackURL, errorCallbackURL: failure.pathname + failure.search + failure.hash, disableRedirect: true });
          if (result.error || !result.data?.url) throw new Error("Google sign-in unavailable");
          window.location.assign(result.data.url);
          // Keep this state until navigation; resetting here flashes the entire form.
          } catch {
            fail("Could not start Google sign-in. Try again.");
            pending.current = false; setBusy(false); setGoogleBusy(false);
          }
        }}><span className="flex h-[18px] w-[18px] items-center justify-center">{googleBusy ? <LoaderCircle aria-hidden="true" className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none" /> : <GoogleMark />}</span><span className="min-w-[150px] text-center">{googleBusy ? "Connecting…" : "Continue with Google"}</span></button></div>
        {!config.google && <p className="mt-2 text-xs text-neutral-400">Google sign-in is not configured on this installation.</p>}
        <div className="my-4 flex items-center gap-3 text-xs text-neutral-500"><span className="h-px flex-1 bg-neutral-800" />or<span className="h-px flex-1 bg-neutral-800" /></div>
        <form noValidate inert={googleBusy} aria-busy={busy && !googleBusy} className="space-y-3" onSubmit={event => {
          event.preventDefault();
          if (pending.current || event.nativeEvent instanceof KeyboardEvent && event.nativeEvent.isComposing) return;
          if (mode === "signup" && !name.trim()) { fail("Enter your name.", "name"); return; }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { fail("Enter a valid email address.", "email"); return; }
          if (!password || mode === "signup" && (password.length < 12 || password.length > 128)) { fail(mode === "signup" ? "Use a password between 12 and 128 characters." : "Enter your password.", "password"); return; }
          void run(async () => {
            const result = mode === "signup" ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password }) : await authClient.signIn.email({ email: email.trim(), password });
            if (result.error) {
              fail(result.error.status === 429 ? "Too many attempts. Wait a minute and try again." : result.error.status >= 500 ? "Sign-in is unavailable. Try again shortly." : mode === "signup" ? "Could not create this account. If you already have an account, sign in using your original method." : "Email or password is incorrect. Try again using your original sign-in method.");
            } else { setPassword(""); setVisible(false); setOpen(false); }
          });
        }}>
          {mode === "signup" && <div><label htmlFor={`${id}-name`} className="text-xs text-neutral-300">Name</label><input ref={nameRef} id={`${id}-name`} autoComplete="name" value={name} onChange={event => setName(event.target.value)} maxLength={100} disabled={busy && !googleBusy} className={inputClass} {...errors("name")} /></div>}
          <div><label htmlFor={`${id}-email`} className="text-xs text-neutral-300">Email</label><input ref={emailRef} id={`${id}-email`} type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} disabled={busy && !googleBusy} className={inputClass} {...errors("email")} /></div>
          <div><label htmlFor={`${id}-password`} className="text-xs text-neutral-300">Password</label>
            {mode === "signup" && <p id={`${id}-requirements`} className="mt-1 text-xs text-neutral-400">Use 12–128 characters. Spaces and passphrases are welcome.</p>}
            <div className="relative"><input ref={passwordRef} id={`${id}-password`} type={visible ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} maxLength={128} disabled={busy && !googleBusy} className={`${inputClass} pr-12`} {...errors("password")} /><button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} disabled={busy && !googleBusy} onClick={() => setVisible(value => !value)} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
          </div>
          <div className="min-h-5"><p id={`${id}-error`} role="alert" className="text-xs text-rose-300">{error}</p></div>
          <button type="submit" disabled={busy && !googleBusy} className="h-10 w-full rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-50">{busy && !googleBusy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
          <button type="button" disabled={busy && !googleBusy} onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setField(""); setPassword(""); setVisible(false); }} className="w-full rounded-lg py-2 text-xs text-neutral-400 hover:text-white">{mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
        </form>
        <p className="mt-3 text-xs leading-relaxed text-neutral-500">Boards and notes stay on this device. Your account does not sync or protect local boards.</p>
      </>}
    </AccountDialog>
  </>;
}

function GoogleMark() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48" className="shrink-0">
    <path fill="#4285F4" d="M43.6 24.5c0-1.5-.1-3-.4-4.4H24v8.3h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15.2Z" />
    <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20.4 20.4 0 0 0 24 44Z" />
    <path fill="#FBBC05" d="M12.6 27.5a12.2 12.2 0 0 1 0-7V15.2H5.8a20 20 0 0 0 0 17.6l6.8-5.3Z" />
    <path fill="#EA4335" d="M24 12.1c3 0 5.6 1 7.7 3l5.8-5.8A19.5 19.5 0 0 0 24 4 20.4 20.4 0 0 0 5.8 15.2l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z" />
  </svg>;
}

function AccountDialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); trigger?.focus(); };
  }, [open]);
  if (!open) return null;
  return createPortal(<dialog ref={ref} aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose} className="m-auto max-h-[calc(100dvh-2rem)] w-[min(400px,calc(100vw-2rem))] cursor-default overflow-y-auto rounded-xl border border-neutral-700 bg-[#18181b] p-5 text-neutral-100 shadow-2xl">
    <div className="mb-4 flex items-start justify-between gap-3"><h2 id={id} className="text-base font-semibold">{title}</h2><button type="button" onClick={onClose} aria-label="Close account dialog" className="-mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white"><X className="h-4 w-4" /></button></div>
    {children}
  </dialog>, document.body);
}
