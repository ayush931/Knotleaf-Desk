"use client";

import { useEffect, useState } from "react";
import { HTTP_BACKEND } from "@/app/config";
import axios from "axios";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PlusCircle,
  LogIn,
  ArrowRight,
  UserPlus,
  LogOut,
  Layout,
} from "lucide-react";

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [roomSlug, setRoomSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setToken(localStorage.getItem("token"));
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomSlug.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const res = await axios.post(
        `${HTTP_BACKEND}/room`,
        { slug: roomSlug.trim().toLowerCase() },
        { headers: { Authorization: token } },
      );
      router.push(`/canvas/${res.data.roomId}`);
    } catch (err) {
      console.error(err);
      if (axios.isAxiosError(err)) {
        const data = err.response?.data;
        if (data && data.errors) {
          let issues: { path?: (string | number)[]; message: string }[] = [];
          if (Array.isArray(data.errors.issues)) {
            issues = data.errors.issues;
          } else if (typeof data.errors.message === "string") {
            try {
              const parsed = JSON.parse(data.errors.message);
              if (Array.isArray(parsed)) {
                issues = parsed;
              }
            } catch {
              // No-op
            }
          }
          if (issues.length > 0) {
            const formatted = issues
              .map((issue) => {
                const path = issue.path?.join(".") || "input";
                const fieldName = path.charAt(0).toUpperCase() + path.slice(1);
                return `${fieldName}: ${issue.message}`;
              })
              .join(" | ");
            setError(formatted);
            return;
          }
        }
        if (err.response?.status === 500) {
          setError(
            "A room with this name already exists. Try joining it instead.",
          );
        } else {
          setError(data?.message || "Failed to create room.");
        }
      } else {
        setError("Failed to create room.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomSlug.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const res = await axios.get(
        `${HTTP_BACKEND}/room/${roomSlug.trim().toLowerCase()}`,
      );
      if (res.data.room && res.data.room.id) {
        router.push(`/canvas/${res.data.room.id}`);
      } else {
        setError(
          "Room not found. Make sure the name is correct or create a new one.",
        );
      }
    } catch (err) {
      console.error(err);
      setError("Failed to find the room. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("token");
    setToken(null);
    router.push("/signin");
  };

  if (!token) {
    return (
      <div className="w-screen h-screen flex flex-col justify-center items-center bg-neutral-950 text-white p-6 relative overflow-hidden font-sans">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-3xl text-center z-10 space-y-6">
          <div className="inline-flex items-center gap-2 bg-neutral-905/60 border border-neutral-800 px-4 py-2 rounded-full text-sm font-medium text-neutral-400 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Real-Time Collaboration Active
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent">
            Collaborative Drawing, <br />
            Synchronized in Real-Time.
          </h1>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto font-light leading-relaxed">
            Create high-fidelity wireframes, brainstorm canvas shapes, and work
            together on an interactive vector board with zero latency.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
            <Link
              href="/signin"
              className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold rounded-2xl transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
            >
              Sign In
              <LogIn className="w-5 h-5" />
            </Link>
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-200 font-semibold border border-neutral-800 rounded-2xl transition duration-200 flex items-center justify-center gap-2"
            >
              Register Account
              <UserPlus className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col justify-center items-center bg-neutral-950 text-white p-6 relative overflow-hidden font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="w-full max-w-lg bg-neutral-900/40 backdrop-blur-xl border border-neutral-800 p-8 rounded-3xl shadow-2xl z-10">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <Layout className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              Board Hub
            </h2>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-rose-950/20 hover:text-rose-400 border border-neutral-750 rounded-xl text-xs font-semibold text-neutral-400 transition duration-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-2xl animate-fade-in">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2 pl-1">
              Room Identifier / Slug
            </label>
            <input
              type="text"
              required
              placeholder="e.g. brainstorming-session"
              value={roomSlug}
              onChange={(e) => setRoomSlug(e.target.value)}
              className="w-full px-4 py-3.5 bg-neutral-900 border border-neutral-800 rounded-2xl focus:outline-none focus:border-blue-500 transition duration-200 placeholder:text-neutral-600 text-neutral-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleCreateRoom}
              disabled={loading || !roomSlug.trim()}
              className="py-4 bg-neutral-900 hover:bg-neutral-800 active:scale-[0.98] border border-neutral-800 disabled:opacity-50 disabled:pointer-events-none text-neutral-250 font-semibold rounded-2xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-5 h-5 text-blue-500" />
              Create Room
            </button>

            <button
              onClick={handleJoinRoom}
              disabled={loading || !roomSlug.trim()}
              className="py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white font-semibold rounded-2xl transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 cursor-pointer"
            >
              Join Room
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
