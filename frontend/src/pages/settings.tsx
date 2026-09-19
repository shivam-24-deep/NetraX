import { Database, Loader2, Plug, Shield, Trash2, User as UserIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { GmailIntegrationCard } from "@/components/app/gmail-integration-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth"
import { deleteAllMyData, useCases } from "@/lib/mock/store"

function ProfileCard() {
  const { user, updateProfile } = useAuth()
  const current = (user?.user_metadata?.full_name as string | undefined) || ""
  const [name, setName] = useState(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError("Enter your full name")
      return
    }
    setSaving(true)
    const { error } = await updateProfile(name)
    setSaving(false)
    if (error) setError(error)
    else toast.success("Profile updated")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
        <CardDescription>Your NetraX account details.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-name">Full name</Label>
            <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-email">Email</Label>
            <Input id="settings-email" value={user?.email ?? ""} disabled readOnly />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="self-start" disabled={saving || name.trim() === current.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function SecurityCard() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    setSaving(true)
    const { error } = await updatePassword(password)
    setSaving(false)
    if (error) {
      setError(error)
      return
    }
    setPassword("")
    setConfirm("")
    toast.success("Password updated")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Security</CardTitle>
        <CardDescription>Change the password you use to sign in.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-password">New password</Label>
            <Input
              id="settings-password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-password-confirm">Confirm new password</Label>
            <Input
              id="settings-password-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="self-start" disabled={saving || !password}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function PrivacyCard() {
  const cases = useCases()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    const ok = window.confirm(
      `Permanently delete all ${cases.length} of your investigations and alerts? This cannot be undone.`,
    )
    if (!ok) return
    setDeleting(true)
    const error = await deleteAllMyData()
    setDeleting(false)
    if (error) toast.error(error)
    else toast.success("All your investigations and alerts were deleted")
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="size-4 text-risk-medium" />
            Privacy Notice
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>Please do not paste the following into any investigation:</p>
          <ul className="list-inside list-disc space-y-1">
            <li>Passwords</li>
            <li>One-time passcodes (OTPs)</li>
            <li>Bank account numbers or card details</li>
            <li>Private keys or seed phrases</li>
            <li>Other highly sensitive personal information</li>
          </ul>
          <p>
            Your investigations are stored in your own account and are not visible to other NetraX users. NetraX is a
            hackathon prototype and is not a substitute for official cybercrime reporting (e.g. cybercrime.gov.in) or
            your bank&apos;s official security and fraud-reporting channels.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your data</CardTitle>
          <CardDescription>
            You have {cases.length} stored investigation{cases.length === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting || cases.length === 0}>
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Delete all my investigations
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your profile, security, and data.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">
            <UserIcon className="size-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="size-3.5" />
            Security
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Plug className="size-3.5" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Database className="size-3.5" />
            Data & Privacy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileCard />
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <SecurityCard />
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <GmailIntegrationCard />
        </TabsContent>

        <TabsContent value="privacy" className="mt-4">
          <PrivacyCard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
