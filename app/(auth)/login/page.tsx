"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Eye, EyeOff, ArrowRight, Mail, Lock, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen bg-brand-bg flex">
      {/* Left - Decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#060B18] via-[#0A1628] to-[#0D1B2A]">
        <div className="absolute inset-0 dot-pattern opacity-10" />
        <div className="orb w-[400px] h-[400px] bg-cyan-500/15 top-20 right-20" />
        <div className="orb w-[300px] h-[300px] bg-blue-600/15 bottom-20 left-20" style={{ animationDelay: "3s" }} />
        <div className="relative z-10 max-w-md text-center px-8">
          <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-8 border border-cyan-500/20 overflow-hidden">
            <Image src="/IMG_9578.PNG" alt="FieldScore" width={80} height={80} className="w-16 h-16 object-contain" />
          </div>
          <h2 className="text-3xl font-black mb-4 text-brand-text">Manage Sales Like a Pro</h2>
          <p className="text-brand-dim leading-relaxed">
            Track leads, monitor your field team, manage pipelines, and close deals faster with FieldScore.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              { value: "1.2K+", label: "Leads" },
              { value: "67", label: "Won" },
              { value: "18.4%", label: "Conv. Rate" },
            ].map((s) => (
              <div key={s.label} className="bg-brand-card/60 backdrop-blur-sm rounded-2xl p-4 border border-brand-border">
                <p className="text-xl font-black text-cyan-400">{s.value}</p>
                <p className="text-xs text-brand-dim mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-10">
            <Image src="/IMG_9578.PNG" alt="FieldScore icon" width={48} height={48} className="h-12 w-12 rounded-xl" />
            <Image src="/image.png" alt="FieldScore" width={130} height={30} className="h-6 w-auto" />
          </Link>

          <h1 className="text-3xl font-black text-brand-text mb-2">Welcome back</h1>
          <p className="text-brand-dim mb-8">Sign in to your account to continue</p>

          <form onSubmit={(e) => { e.preventDefault(); window.location.href = "/dashboard"; }} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-brand-body mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input type="email" placeholder="you@company.com" className="input-field !pl-11" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-brand-body">Password</label>
                <a href="#" className="text-xs text-brand-primary hover:underline font-medium">Forgot password?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="input-field !pl-11 !pr-11"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-body transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="remember" className="w-4 h-4 rounded border-brand-border accent-brand-primary" />
              <label htmlFor="remember" className="text-sm text-brand-dim">Remember me</label>
            </div>

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 !py-3.5 rounded-xl text-base">
              Sign In <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-brand-border" /></div>
              <div className="relative flex justify-center text-sm"><span className="px-4 bg-brand-bg text-brand-muted">Or continue with</span></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button className="btn-secondary flex items-center justify-center gap-2 !py-3 rounded-xl text-sm">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google
              </button>
              <button className="btn-secondary flex items-center justify-center gap-2 !py-3 rounded-xl text-sm">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0078D4"><path d="M3 3h8.5v8.5H3V3zm9.5 0H21v8.5h-8.5V3zM3 12.5h8.5V21H3v-8.5zm9.5 0H21V21h-8.5v-8.5z"/></svg>
                Microsoft
              </button>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-brand-dim">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-brand-primary hover:underline font-semibold">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
