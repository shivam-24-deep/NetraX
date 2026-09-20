import type { User } from "@supabase/supabase-js"

// Google sign-in stores the account's profile photo in user_metadata as
// `avatar_url` (Supabase's normalized field) and `picture` (Google's own).
// Email/password accounts have neither, so they fall back to initials.

function metaString(user: User | null, key: string): string | undefined {
  const value = user?.user_metadata?.[key]
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

export function displayNameOf(user: User | null): string {
  return metaString(user, "full_name") ?? metaString(user, "name") ?? user?.email?.split("@")[0] ?? "Analyst"
}

/** Only https images are used, so a crafted profile field can never point at another scheme. */
export function avatarUrlOf(user: User | null): string | undefined {
  const url = metaString(user, "avatar_url") ?? metaString(user, "picture")
  return url?.startsWith("https://") ? url : undefined
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]
  return letters.toUpperCase()
}
