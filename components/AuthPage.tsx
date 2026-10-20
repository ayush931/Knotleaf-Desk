"use client";

import { brandAsset } from "@/lib/brandAssets";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { HardDrive, ArrowRight, CheckCircle2 } from "lucide-react";

export function AuthPage({ isSignIn }: { isSignIn: boolean }) {
  const [userName, setUserName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("excali_user_name") || "Architect";
    }
    return "Architect";
  });
  const router = useRouter();

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem("excali_user_name", userName);
      localStorage.setItem("token", "local_session_token");
    }
    router.push("/");
  };

  return (
    <div className="w-screen h-screen flex justify-center items-center bg-neutral-950 text-white p-4 relative overflow-hidden font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-neutral-900/40 backdrop-blur-xl border border-neutral-800 p-8 rounded-3xl shadow-2xl z-10">
        <div className="text-center mb-6">
          <Image src={brandAsset("/icons/logo.svg")} alt="Knotleaf Desk" width={220} height={64} className="mx-auto mb-6" priority />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
            <HardDrive className="w-3.5 h-3.5" />
            <span>100% Local Storage Mode</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
            {isSignIn ? "Local Workspace" : "Zero-Database Setup"}
          </h2>
          <p className="text-neutral-400 mt-2 text-xs leading-relaxed">
            All your diagrams, architecture icons, and engineering Markdown docs
            are saved directly to your browser&apos;s LocalStorage. No database or cloud server needed.
          </p>
        </div>

        <form noValidate onSubmit={handleContinue} className="space-y-4">
          <div>
            <label htmlFor="display-name" className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5 pl-1">
              Your Display Name
            </label>
            <input
              id="display-name"
              type="text"
              placeholder="e.g. Lead Architect"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl focus:outline-none focus:border-blue-500 transition duration-200 placeholder:text-neutral-600 text-neutral-200 text-sm"
            />
          </div>

          <div className="p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 space-y-2 text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Eraser-style cloud icons (AWS, GCP, Azure, K8s)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Side-by-side Markdown Notes + Diagram Canvas</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Multi-board workspace &amp; high-res export</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold rounded-2xl transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 cursor-pointer text-sm"
          >
            <span>Open Knotleaf Desk</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center mt-5 text-xs text-neutral-400">
          <Link href="/" className="text-blue-400 hover:underline">
            Go directly to Knotleaf Desk
          </Link>
        </div>
      </div>
    </div>
  );
}
