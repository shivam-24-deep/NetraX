import type { User } from "@supabase/supabase-js"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { avatarUrlOf, displayNameOf, initialsOf } from "@/lib/user-display"
import { cn } from "@/lib/utils"

/** The user's Google profile photo when they signed in with Google, otherwise their initials. */
export function UserAvatar({ user, className, fallbackClassName }: { user: User | null; className?: string; fallbackClassName?: string }) {
  const name = displayNameOf(user)
  const url = avatarUrlOf(user)
  return (
    <Avatar className={className}>
      {url && (
        // no-referrer: Google's image host refuses some requests that carry another site's Referer
        <AvatarImage src={url} alt={name} referrerPolicy="no-referrer" />
      )}
      <AvatarFallback className={cn("text-xs", fallbackClassName)}>{initialsOf(name)}</AvatarFallback>
    </Avatar>
  )
}
