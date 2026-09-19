import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"

export function LoginForm() {
  const { signIn, resetPassword } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!email.trim() || !password) {
      setError("Enter your email and password")
      return
    }
    setSubmitting(true)
    const { error } = await signIn(email, password, remember)
    setSubmitting(false)
    if (error) setError(error)
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above first, then click “Forgot password?”")
      return
    }
    setError(null)
    setNotice(null)
    setResetting(true)
    const { error } = await resetPassword(email)
    setResetting(false)
    if (error) setError(error)
    else setNotice(`If an account exists for ${email}, a password reset link is on its way. Check your inbox and spam folder.`)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          placeholder="Enter your email"
          autoComplete="email"
          required
          aria-invalid={!!error}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-password">Password</Label>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            minLength={6}
            aria-invalid={!!error}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-9"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <label className="text-muted-foreground flex items-center gap-2">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="border-input accent-primary size-3.5 rounded-sm"
          />
          Remember me
        </label>
        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={resetting}
          className="text-primary font-medium hover:underline disabled:opacity-50"
        >
          {resetting ? "Sending…" : "Forgot password?"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="text-risk-low text-sm">
          {notice}
        </p>
      )}

      <Button type="submit" className="mt-1" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  )
}
