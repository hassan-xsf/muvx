"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowLeft, Mail } from "lucide-react"
import Link from "next/link"

export default function VerifySignupPage() {
  const router = useRouter()
  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [resending, setResending] = useState(false)

  useEffect(() => {
    // Get email from localStorage (set on signup page)
    const signupData = localStorage.getItem("signup_data")
    if (signupData) {
      try {
        const { email: storedEmail } = JSON.parse(signupData)
        setEmail(storedEmail)
      } catch {
        // ignore parse error
      }
    }
  }, [])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (otp.length !== 6) {
      setError("Please enter a 6-digit code")
      setLoading(false)
      return
    }

    try {
      // Verify the email OTP
      const result = await authClient.emailOtp.verifyEmail({
        email,
        otp,
      })

      if (result.error) {
        setError(result.error.message || "Invalid verification code")
        setLoading(false)
        return
      }

      // Get the signup data (email) and any ?next= forwarded
      // from the signup page. If the user came in via an invite link,
      // signup_next points back at /invite/[id] and we honor it after
      // the account exists instead of dropping them on /onboarding.
      const signupData = localStorage.getItem("signup_data")
      const signupNext = localStorage.getItem("signup_next")
      localStorage.removeItem("signup_data")
      localStorage.removeItem("signup_next")

      // Account was already created on /signup; the OTP only verifies it.
      if (signupData) {
        // Honor the deep link if present and safe (same-origin path).
        // Falls back to /onboarding when no ?next= was forwarded.
        const destination =
          signupNext && signupNext.startsWith("/") ? signupNext : "/onboarding"
        console.log(`[SIGNUP-VERIFY] → ${destination}`)
        router.push(destination)
      } else {
        router.push("/login")
      }
    } catch (err) {
      setError("An unexpected error occurred")
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      })
    } catch (err) {
      console.error("Failed to resend:", err)
    }
    setResending(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-gray-600 mt-2">
            Enter the 6-digit code we sent to
            <br />
            <strong>{email || "your email"}</strong>
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <form onSubmit={handleVerify} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-widest font-mono"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Create Account"
              )}
            </Button>

            <div className="text-center text-sm">
              <span className="text-gray-600">Didn&apos;t receive the code? </span>
              <Button
                type="button"
                variant="link"
                onClick={handleResend}
                disabled={resending}
                className="p-0 h-auto text-sm"
              >
                {resending ? "Sending..." : "Resend code"}
              </Button>
            </div>

            <div className="text-center">
              <Link
                href="/signup"
                className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-3 w-3" />
                Use different email
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
