"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Mail, Lock, Check } from "lucide-react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      router.push(data.redirect || "/my-dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#060B18] flex">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-10">
            <Image src="/IMG_9578.PNG" alt="FieldScore icon" width={48} height={48} className="h-12 w-12 rounded-xl" />
            <Image src="/image.png" alt="FieldScore" width={130} height={30} className="h-6 w-auto" />
          </Link>

          <h1 className="text-3xl font-black text-[#F1F5F9] mb-2">Welcome back</h1>
          <p className="text-[#8094B0] mb-8">Sign in to your FieldScore account</p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#CBD5E1] mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A6080]" />
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field !pl-11"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#CBD5E1] mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A6080]" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field !pl-11 !pr-11"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4A6080] hover:text-[#CBD5E1] transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-sm text-[#8094B0]">
                <input type="checkbox" className="w-4 h-4 rounded border-[#1A2B45] accent-[#00E5FF]" />
                Remember me
              </label>
              <Link href="/reset-password" className="text-sm text-[#00E5FF] hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 !py-3.5 rounded-xl text-base mt-2 disabled:opacity-50"
            >
              {loading ? "Signing in..." : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-[#8094B0]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#00E5FF] hover:underline font-semibold">
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Right - Decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#060B18] via-[#0A1628] to-[#0D1B2A]">
        <div className="absolute inset-0 dot-pattern opacity-10" />
        <div className="orb w-[400px] h-[400px] bg-cyan-500/15 bottom-20 right-20" />
        <div className="orb w-[300px] h-[300px] bg-blue-600/15 top-20 left-20" style={{ animationDelay: "3s" }} />
        <div className="relative z-10 max-w-md text-center px-8">
          <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-8 border border-cyan-500/20 overflow-hidden">
            <Image src="/IMG_9578.PNG" alt="FieldScore" width={80} height={80} className="w-16 h-16 object-contain" />
          </div>
          <h2 className="text-3xl font-black mb-4 text-[#F1F5F9]">Your Team, Supercharged</h2>
          <p className="text-[#8094B0] leading-relaxed mb-8">
            Track attendance, manage leads, monitor calls, and drive performance — all in one place.
          </p>
          <div className="space-y-3 text-left max-w-xs mx-auto">
            {["Real-time team activity tracking", "AI-powered lead management", "Complete sales pipeline visibility"].map((item) => (
              <div key={item} className="flex items-center gap-3 text-[#CBD5E1] text-sm">
                <div className="w-5 h-5 rounded-full bg-cyan-500/15 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-cyan-400" />
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
