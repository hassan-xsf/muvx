"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { MuvxLogo } from "@/components/brand/muvx-logo"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { SignupSkeleton } from "@/components/auth/signup-skeleton"
import { Loader2, Truck, ArrowRight } from "lucide-react"

function SignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Capture ?next= from URL so an invite-link recipient who clicks
  // "Create account" can be routed back to /invite/[id] after signup
  // (instead of being dropped on /onboarding). Also pre-fill the email
  // State first so the deep-link effect below can reference setEmail.
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Capture ?next= from URL so an invite-link recipient who clicks
  // "Create account" can be routed back to /invite/[id] after signup
  // (instead of being dropped on /onboarding). Also pre-fill the email
  // when ?email= is present (the invite-acceptance deep link uses
  // /signup?email=...&next=/invite/[id]).
  const [nextPath, setNextPath] = useState<string | null>(null)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === "undefined") return
    const next = searchParams.get("next")
    if (next && next.startsWith("/")) {
      console.log("[SIGNUP] post-signup redirect →", next)
      setNextPath(next)
    }
    const prefillEmail = searchParams.get("email")
    if (prefillEmail && prefillEmail.includes("@")) {
      console.log("[SIGNUP] pre-filling email from query:", prefillEmail)
      setEmail((cur) => (cur ? cur : prefillEmail))
    }
  }, [searchParams])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    console.log("[SIGNUP] Starting email signup for:", email)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      setLoading(false)
      return
    }

    try {
      // Email allow/block check — runs before we hit Better Auth so
      // the user gets a friendly message instead of a vague 400.
      console.log("[SIGNUP] checking email policy for", email)
      const policyRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (policyRes.ok) {
        const policy = (await policyRes.json()) as {
          ok: boolean
          reason: string | null
        }
        if (!policy.ok) {
          const msg =
            policy.reason === "blocked_email"
              ? "This email is blocked from signing up. Contact support if you believe this is a mistake."
              : policy.reason === "blocked_domain"
                ? "Signups from this email domain are not allowed."
                : "Your email is not on the signup allowlist for this workspace."
          console.warn(`[SIGNUP] blocked: ${policy.reason}`)
          setError(msg)
          setLoading(false)
          return
        }
      }

      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      })
      if (result.error) {
        console.error("[SIGNUP] Send OTP error:", result.error)
        setError(result.error.message || "Failed to send verification code")
        setLoading(false)
        return
      }
      // Forward `next` so /signup/verify can redirect after sign-up.
      // Stored in localStorage because the OTP-verify step is its own
      // route and we can't pass state across it cleanly.
      localStorage.setItem(
        "signup_data",
        JSON.stringify({ email, name, password }),
      )
      if (nextPath) {
        localStorage.setItem("signup_next", nextPath)
      } else {
        localStorage.removeItem("signup_next")
      }
      console.log("[SIGNUP] ✅ OTP sent", { nextPath })
      router.push("/signup/verify")
    } catch (err) {
      console.error("[SIGNUP] Signup error:", err)
      setError("An unexpected error occurred")
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setError("")
    setGoogleLoading(true)
    console.log("[SIGNUP] Initiating Google signup...")
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/auth-redirect",
      })
      if (result.error) {
        console.error("[SIGNUP] Google signup error:", result.error)
        setError(result.error.message || "Google sign-up failed")
        setGoogleLoading(false)
      }
    } catch (err) {
      console.error("[SIGNUP] Google signup exception:", err)
      setError("An unexpected error occurred with Google sign-up")
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col">
      {/* Top bar */}
      <header className="w-full bg-[#fbf8f3]">
        <div className="mx-auto flex max-w-[1440px] items-center gap-10 px-6 py-[22px] md:px-16">
          <Link href="/" className="flex items-center transition-opacity hover:opacity-90">
            <MuvxLogo variant="horizontal" className="h-8 w-auto" />
          </Link>
          <div className="ml-auto flex items-center gap-6">
            <span className="hidden sm:block font-geist-mono text-[10px] font-medium tracking-[0.04em] text-brand-muted-soft">
              GET EARLY ACCESS
            </span>
            <Link
              href="/login"
              className="font-geist text-sm font-medium text-[#4a4e57] hover:text-brand-ink transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12 md:px-16">
        <div className="w-full max-w-[480px]">
          {/* Eyebrow */}
          <div className="mb-6 flex items-center gap-2.5">
            <span className="size-[7px] shrink-0 rounded-full bg-brand-accent" />
            <span className="font-geist-mono text-[11px] font-medium uppercase tracking-[0.04em] text-brand-ink">
              CREATE ACCOUNT
            </span>
            <span className="font-geist-mono text-[11px] tracking-[0.04em] text-brand-muted-soft">
              · NO CREDIT CARD REQUIRED
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-serif text-[clamp(40px,5vw,56px)] leading-[0.96] tracking-[-0.04em] text-brand-ink mb-2">
            Start moving <span className="italic text-brand-accent">freight</span> in minutes.
          </h1>
          <p className="text-[#4a4e57] font-geist mb-8">
            Dispatch, drivers, documents, and dollars — all in one TMS.
          </p>

          <Card className="border-brand-rule bg-[#fffefb] shadow-[0_10px_30px_rgba(58,46,30,0.06)]">
            <div className="p-7">
              {error && (
                <div className="mb-5 p-3 text-sm text-brand-accent bg-brand-accent/[0.08] border border-brand-accent/30 rounded-xl">
                  {error}
                </div>
              )}

              {/* Google */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 border-brand-rule hover:bg-[#fbf8f3] bg-brand-card font-geist"
                onClick={handleGoogleSignup}
                disabled={googleLoading || loading}
              >
                {googleLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting to Google...
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    Continue with Google
                  </>
                )}
              </Button>

              <div className="relative my-6 flex items-center">
                <div className="flex-1 border-t border-brand-rule" />
                <span className="px-3 text-xs font-geist-mono tracking-[0.04em] text-brand-muted-soft uppercase">
                  or
                </span>
                <div className="flex-1 border-t border-brand-rule" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="font-geist-mono text-[10px] font-medium tracking-[0.04em] text-brand-muted-soft uppercase">
                    Full name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 border-brand-rule focus-visible:ring-brand-ink/10 focus-visible:border-brand-ink bg-brand-card"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="font-geist-mono text-[10px] font-medium tracking-[0.04em] text-brand-muted-soft uppercase">
                    Work email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 border-brand-rule focus-visible:ring-brand-ink/10 focus-visible:border-brand-ink bg-brand-card"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="font-geist-mono text-[10px] font-medium tracking-[0.04em] text-brand-muted-soft uppercase">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 border-brand-rule focus-visible:ring-brand-ink/10 focus-visible:border-brand-ink bg-brand-card"
                    required
                    minLength={8}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="font-geist-mono text-[10px] font-medium tracking-[0.04em] text-brand-muted-soft uppercase">
                    Confirm password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 border-brand-rule focus-visible:ring-brand-ink/10 focus-visible:border-brand-ink bg-brand-card"
                    required
                    minLength={8}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 rounded-full bg-brand-ink hover:bg-brand-ink-soft font-geist text-brand-cream mt-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending verification code...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </Card>

          <p className="text-center text-xs text-brand-muted-soft mt-6 font-geist leading-relaxed">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="text-brand-ink hover:underline">Terms</Link>
            {" "}and{" "}
            <Link href="/privacy" className="text-brand-ink hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupSkeleton />}>
      <SignupContent />
    </Suspense>
  )
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}
