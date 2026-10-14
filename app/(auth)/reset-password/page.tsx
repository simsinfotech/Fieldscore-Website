"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { TbLoader2, TbLock, TbEye, TbEyeOff, TbCircleCheck } from "react-icons/tb"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [initError, setInitError] = useState("")
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false

    async function initRecoverySession() {
      if (typeof window === "undefined") return

      const url = new URL(window.location.href)
      const code = url.searchParams.get("code")

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (exchangeError) {
          setInitError("This reset link is invalid or has expired. Please request a new one.")
          return
        }
        window.history.replaceState({}, "", "/reset-password")
        setSessionReady(true)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) {
        setSessionReady(true)
      } else {
        setInitError("No active recovery session. Please click the reset link from your email again.")
      }
    }

    initRecoverySession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setSessionReady(true)
        }
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!sessionReady) {
      setError("Recovery session not ready. Please wait a moment or click the reset link again.")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      setError(updateError.message)
    } else {
      await supabase.auth.signOut()
      setSuccess(true)
      setTimeout(() => {
        router.push("/login")
      }, 3000)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#060B18]">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="orb w-[400px] h-[400px] bg-cyan-500/15 -top-24 -left-24" />
        <div className="orb w-[350px] h-[350px] bg-blue-600/15 -bottom-32 -right-24" style={{ animationDelay: "3s" }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <Image src="/IMG_9578.PNG" alt="FieldScore" width={80} height={80} className="mx-auto h-20 w-20 object-cover rounded-2xl border border-[#1A2B45] mb-5" />
          <h1 className="text-3xl font-black text-[#F1F5F9]">
            Field<span className="text-[#00E5FF]">Score</span>
          </h1>
          <p className="text-sm text-[#8094B0] mt-2">Set your new password</p>
        </div>

        {/* Card */}
        <div className="relative overflow-hidden bg-[#0D1B2A] rounded-[2rem] border border-[#1A2B45]">
          <div className="px-5 py-6 sm:p-8">
            {initError ? (
              <div className="space-y-5 text-center">
                <div className="flex justify-center">
                  <div className="h-16 w-16 rounded-2xl bg-[#1A2B45] flex items-center justify-center">
                    <TbLock className="h-8 w-8 text-[#F1F5F9]" />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#F1F5F9]">Link invalid or expired</h2>
                  <p className="text-sm text-[#8094B0] mt-2">{initError}</p>
                </div>
                <Button
                  onClick={() => router.push("/login")}
                  className="btn-primary w-full h-12 text-sm"
                >
                  Back to sign in
                </Button>
              </div>
            ) : success ? (
              <div className="space-y-5 text-center">
                <div className="flex justify-center">
                  <div className="h-16 w-16 rounded-2xl bg-[#00BCD4]/15 border border-[#1A2B45] flex items-center justify-center">
                    <TbCircleCheck className="h-8 w-8 text-[#00E5FF]" />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#F1F5F9]">Password updated!</h2>
                  <p className="text-sm text-[#8094B0] mt-1">
                    Your password has been changed successfully. Redirecting to login...
                  </p>
                </div>
              </div>
            ) : !sessionReady ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <TbLoader2 className="h-8 w-8 animate-spin text-[#00E5FF]" />
                <p className="text-sm text-[#8094B0]">Verifying your reset link...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="text-center mb-2">
                  <h2 className="text-lg font-bold text-[#F1F5F9]">New password</h2>
                  <p className="text-sm text-[#8094B0] mt-1">Enter your new password below</p>
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#CBD5E1]">New password</label>
                  <div className={`relative group rounded-xl border transition-colors ${
                    focused === "password"
                      ? "border-[#00BCD4] bg-[#0D1B2A]"
                      : "border-[#1A2B45] bg-[#0A1628]"
                  }`}>
                    <TbLock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A6080]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      required
                      minLength={6}
                      className="w-full bg-transparent pl-11 pr-11 py-3.5 text-sm text-[#F1F5F9] outline-none placeholder:text-[#4A6080]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4A6080] hover:text-[#CBD5E1] transition-colors"
                    >
                      {showPassword ? <TbEyeOff className="h-4 w-4" /> : <TbEye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#CBD5E1]">Confirm password</label>
                  <div className={`relative group rounded-xl border transition-colors ${
                    focused === "confirm"
                      ? "border-[#00BCD4] bg-[#0D1B2A]"
                      : "border-[#1A2B45] bg-[#0A1628]"
                  }`}>
                    <TbLock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A6080]" />
                    <input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onFocus={() => setFocused("confirm")}
                      onBlur={() => setFocused(null)}
                      required
                      className="w-full bg-transparent pl-11 pr-11 py-3.5 text-sm text-[#F1F5F9] outline-none placeholder:text-[#4A6080]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4A6080] hover:text-[#CBD5E1] transition-colors"
                    >
                      {showConfirm ? <TbEyeOff className="h-4 w-4" /> : <TbEye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full h-12 text-sm"
                >
                  {loading ? (
                    <TbLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <TbLock className="mr-2 h-4 w-4" />
                  )}
                  {loading ? "Updating..." : "Update password"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
