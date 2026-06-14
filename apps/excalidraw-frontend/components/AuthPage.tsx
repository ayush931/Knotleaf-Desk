"use client";

import { useState } from "react";
import { HTTP_BACKEND } from "@/app/config";
import axios from "axios";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, ArrowRight } from "lucide-react";

export function AuthPage({ isSignIn }: { isSignIn: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignIn) {
        const res = await axios.post(`${HTTP_BACKEND}/signin`, {
          email,
          password,
        });
        localStorage.setItem("token", res.data.token);
        router.push("/");
      } else {
        await axios.post(`${HTTP_BACKEND}/signup`, {
          name,
          email,
          password,
        });
        router.push("/signin");
      }
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
        setError(
          data?.message ||
            "Something went wrong. Please check your credentials and try again.",
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen flex justify-center items-center bg-neutral-950 text-white p-4 relative overflow-hidden font-sans">
      {/* Background blur rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-neutral-900/40 backdrop-blur-xl border border-neutral-800 p-8 rounded-3xl shadow-2xl z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight bg-linear-to-r from-white to-neutral-400 bg-clip-text text-transparent">
            {isSignIn ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-neutral-400 mt-2 text-sm">
            {isSignIn
              ? "Sign in to access your collaborative whiteboards"
              : "Sign up to start designing with teams in real-time"}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-2xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isSignIn && (
            <div>
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5 pl-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 w-5 h-5" />
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-neutral-900 border border-neutral-800 rounded-2xl focus:outline-none focus:border-blue-500 transition duration-200 placeholder:text-neutral-600 text-neutral-200"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5 pl-1">
              Username
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 w-5 h-5" />
              <input
                type="text"
                required
                placeholder="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-neutral-900 border border-neutral-800 rounded-2xl focus:outline-none focus:border-blue-500 transition duration-200 placeholder:text-neutral-600 text-neutral-200"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5 pl-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 w-5 h-5" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-neutral-900 border border-neutral-800 rounded-2xl focus:outline-none focus:border-blue-500 transition duration-200 placeholder:text-neutral-600 text-neutral-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-semibold rounded-2xl transition duration-200 flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-500/25"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {isSignIn ? "Sign In" : "Sign Up"}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-neutral-400">
          {isSignIn ? (
            <p>
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="text-blue-500 hover:underline font-semibold transition"
              >
                Sign up
              </Link>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <Link
                href="/signin"
                className="text-blue-500 hover:underline font-semibold transition"
              >
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
