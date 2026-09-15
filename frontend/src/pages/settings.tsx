import { Bell, Database, Plug, Shield, Sparkles, User as UserIcon } from "lucide-react"

import { GmailIntegrationCard } from "@/components/app/gmail-integration-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth"

export default function SettingsPage() {
  const { user } = useAuth()
  const fullName = (user?.user_metadata?.full_name as string | undefined) || ""

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your profile, preferences, and data-handling guidance.</p>
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
          <TabsTrigger value="notifications">
            <Bell className="size-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="size-3.5" />
            AI Preferences
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Database className="size-3.5" />
            Data & Privacy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription>Synced from your NetraX account.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-name">Full name</Label>
                <Input id="settings-name" defaultValue={fullName} placeholder="Jane Doe" disabled />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-email">Email</Label>
                <Input id="settings-email" defaultValue={user?.email ?? ""} disabled />
              </div>
              <Button disabled className="self-start">
                Save changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security</CardTitle>
              <CardDescription>Password and session management.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-password">New password</Label>
                <Input id="settings-password" type="password" placeholder="••••••••" disabled />
              </div>
              <Button disabled className="self-start">
                Update password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <GmailIntegrationCard />
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notifications</CardTitle>
              <CardDescription>Choose what triggers an alert.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {["New high-risk case detected", "Case moved to under review", "Weekly analytics digest"].map((label) => (
                <label key={label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  {label}
                  <input type="checkbox" defaultChecked className="size-4 accent-primary" disabled />
                </label>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Preferences</CardTitle>
              <CardDescription>Explanation style used by the investigation agent.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <label className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5">
                Plain-language explanations (recommended)
                <input type="radio" name="explain-style" defaultChecked className="size-4 accent-primary" disabled />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                Technical / analyst-style explanations
                <input type="radio" name="explain-style" className="size-4 accent-primary" disabled />
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="mt-4">
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
                NetraX is a hackathon prototype. It is not a substitute for official cybercrime reporting
                (e.g. cybercrime.gov.in) or your bank&apos;s official security and fraud-reporting channels. All
                case, threat-intelligence, and model-performance data shown in this prototype is local demo data.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
