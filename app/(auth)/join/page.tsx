"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { TbLoader2, TbMail, TbLock, TbUser, TbArrowRight, TbEye, TbEyeOff, TbCircleCheck } from "react-icons/tb"

export default function JoinPage() {
  const [token, setToken] = useState<string | null>(null)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    setToken(new URLSearchParams(window.location.search).get("token"))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!token) {
      setError("Missing invite token. Please use the link your admin shared.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, full_name: fullName, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Could not create your account")
        setLoading(false)
        return
      }
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const loginData = await loginRes.json()
      setDone(true)
      setTimeout(() => {
        window.location.href = loginRes.ok ? loginData.redirect || "/my-dashboard" : "/login"
      }, 1200)
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#060B18]">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="orb w-[400px] h-[400px] bg-cyan-500/15 -top-24 -left-24" />
        <div className="orb w-[350px] h-[350px] bg-blue-600/15 -bottom-32 -right-24" style={{ animationDelay: "3s" }} />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/IMG_9578.PNG" alt="FieldScore" width={64} height={64} className="mx-auto h-16 w-16 object-cover rounded-2xl border border-[#1A2B45] mb-5" />
          <h1 className="text-3xl font-black text-[#F1F5F9]">
            Join <span className="text-[#00E5FF]">FieldScore</span>
          </h1>
          <p className="text-sm text-[#8094B0] mt-2">Create your account to get started</p>
        </div>

        <div className="relative overflow-hidden bg-[#0D1B2A] rounded-[2rem] border border-[#1A2B45]">
          <div className="px-5 py-6 sm:p-8">
            {done ? (
              <div className="flex flex-col items-center text-center gap-3 py-6">
                <TbCircleCheck className="h-12 w-12 text-[#00E5FF]" />
                <p className="text-sm text-[#F1F5F9]">Account created! Signing you in...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <Field icon={<TbUser className="h-4 w-4 text-[#4A6080]" />} label="Full name">
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" required
                    className="w-full bg-transparent pl-11 pr-4 py-3.5 text-sm text-[#F1F5F9] outline-none placeholder:text-[#4A6080]" />
                </Field>
                <Field icon={<TbMail className="h-4 w-4 text-[#4A6080]" />} label="Email address">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required
                    className="w-full bg-transparent pl-11 pr-4 py-3.5 text-sm text-[#F1F5F9] outline-none placeholder:text-[#4A6080]" />
                </Field>
                <Field icon={<TbLock className="h-4 w-4 text-[#4A6080]" />} label="Password">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters" required minLength={6}
                    className="w-full bg-transparent pl-11 pr-11 py-3.5 text-sm text-[#F1F5F9] outline-none placeholder:text-[#4A6080]" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4A6080] hover:text-[#CBD5E1]">
                    {showPassword ? <TbEyeOff className="h-4 w-4" /> : <TbEye className="h-4 w-4" />}
                  </button>
                </Field>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <Button type="submit" disabled={loading}
                  className="btn-primary w-full h-12 text-sm">
                  {loading ? <TbLoader2 className="mr-2 h-4 w-4 animate-spin" /> : <TbArrowRight className="mr-2 h-4 w-4" />}
                  {loading ? "Creating account..." : "Create account"}
                </Button>

                <p className="text-center text-sm text-[#8094B0]">
                  Already have an account? <a href="/login" className="text-[#00E5FF] hover:underline font-medium">Sign in</a>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-[#CBD5E1]">{label}</label>
      <div className="relative group rounded-xl border border-[#1A2B45] bg-[#0A1628] transition-colors focus-within:border-[#00BCD4] focus-within:bg-[#0D1B2A]">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2">{icon}</span>
        {children}
      </div>
    </div>
  )
}
